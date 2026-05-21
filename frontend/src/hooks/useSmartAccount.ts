// FILE: frontend/src/hooks/useSmartAccount.ts
// PURPOSE: React hook providing the full gasless transaction lifecycle.
//
// ARCHITECTURE:
//   All UserOperations are submitted via the KULA backend middleware, which:
//     1. Fetches nonce from the EntryPoint
//     2. Builds callData (approve + deposit, or vote, etc.)
//     3. Calls pm_sponsorUserOperation on Pimlico → paymasterAndData
//     4. Signs with the owner EOA embedded wallet
//     5. Submits via eth_sendUserOperation
//     6. Returns userOpHash for status polling
//
//   The frontend hook signs with the Privy embedded wallet using signMessage,
//   then sends the signature + op data to the backend to complete the flow.
//   This keeps the Pimlico API key and owner private key off the browser.
//
// SUPPORTED OPERATIONS:
//   - contribute(groupId, amount)  → approve USDC + deposit in one batch
//   - voteOnAsset(proposalId, support)
//   - proposeAsset(groupId, registryAssetId, description, requestedAmount)
//   - voteOnApplicant(groupId, applicant, support)

import { useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import useKulaStore, { KulaTx } from "@/store/useKulaStore";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type OperationType =
  | "deposit"
  | "vote_asset"
  | "propose_asset"
  | "vote_applicant"
  | "payout";

export interface UseSmartAccountReturn {
  isSubmitting:  boolean;
  lastOpHash:    string | null;
  lastError:     string | null;
  contribute:    (groupId: number, amountUsdc: bigint) => Promise<string | null>;
  voteOnAsset:   (proposalId: number, support: boolean) => Promise<string | null>;
  proposeAsset:  (groupId: number, registryAssetId: number, description: string, requestedAmount: bigint) => Promise<string | null>;
  voteOnApplicant: (groupId: number, applicant: string, support: boolean) => Promise<string | null>;
  pollOpStatus:  (userOpHash: string) => Promise<"CONFIRMED" | "FAILED" | "PENDING">;
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

// ---------------------------------------------------------------------------
// HOOK
// ---------------------------------------------------------------------------

export function useSmartAccount(): UseSmartAccountReturn {
  const { ready, authenticated } = usePrivy();
  const { wallets }              = useWallets();

  const smartAccountAddress = useKulaStore(s => s.smartAccountAddress);
  const walletSource        = useKulaStore(s => s.walletSource);
  const addTx               = useKulaStore(s => s.addTx);
  const updateTxStatus      = useKulaStore(s => s.updateTxStatus);
  const setAccountStatus    = useKulaStore(s => s.setAccountStatus);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastOpHash,   setLastOpHash]   = useState<string | null>(null);
  const [lastError,    setLastError]    = useState<string | null>(null);

  // ── Get embedded wallet for signing (Privy users) ─────────────────────
  const getEmbeddedWallet = useCallback(() => {
    return wallets.find(w => w.walletClientType === "privy") ?? null;
  }, [wallets]);

  // ── Core: submit a UserOperation via the backend ────────────────────────
  // Flow:
  //   1. POST /api/prepare-userop  → gets unsigned UserOperation + userOpHash
  //   2. Sign userOpHash with embedded wallet
  //   3. POST /api/submit-userop   → backend attaches signature, sponsors, submits
  const submitOperation = useCallback(
    async (
      operationType: OperationType,
      operationParams: Record<string, unknown>
    ): Promise<string | null> => {
      if (!smartAccountAddress) {
        setLastError("No smart account found. Please log in first.");
        return null;
      }

      setIsSubmitting(true);
      setLastError(null);

      try {
        // ── Step 1: Get unsigned UserOp from backend ─────────────────────
        const prepRes  = await fetch(`${BACKEND_URL}/api/prepare-userop`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            smartAccountAddress,
            operationType,
            ...operationParams,
          }),
        });
        const prepData = await prepRes.json();
        if (!prepRes.ok || !prepData.success) {
          throw new Error(prepData.error ?? "Failed to prepare UserOperation");
        }

        const { userOp, userOpHash } = prepData;

        // ── Step 2: Sign userOpHash ───────────────────────────────────────
        let signature: string;

        if (walletSource === "telegram" || walletSource === "ussd") {
          // For TG/USSD users, the backend holds the derived owner key
          // and can sign on their behalf (custodial signing for feature-phone UX)
          const signRes  = await fetch(`${BACKEND_URL}/api/sign-userop`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              smartAccountAddress,
              userOpHash,
              userOp,
              operationType,
              ...operationParams,
            }),
          });
          const signData = await signRes.json();
          if (!signRes.ok || !signData.success) {
            throw new Error(signData.error ?? "Backend signing failed");
          }
          signature = signData.signature;
        } else {
          // For Privy users: sign with embedded wallet (non-custodial)
          const embeddedWallet = getEmbeddedWallet();
          if (!embeddedWallet) {
            throw new Error("Embedded wallet not found. Please reconnect.");
          }
          const provider = await embeddedWallet.getEthereumProvider();
          signature = await provider.request({
            method: "personal_sign",
            params: [userOpHash, embeddedWallet.address],
          }) as string;
        }

        // ── Step 3: Submit signed op to backend ──────────────────────────
        const submitRes  = await fetch(`${BACKEND_URL}/api/submit-userop`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            smartAccountAddress,
            userOp: { ...userOp, signature },
            operationType,
            ...operationParams,
          }),
        });
        const submitData = await submitRes.json();
        if (!submitRes.ok || !submitData.success) {
          throw new Error(submitData.error ?? "UserOperation submission failed");
        }

        const opHash: string = submitData.userOpHash;
        setLastOpHash(opHash);

        // ── Record in local Zustand history ──────────────────────────────
        const tx: KulaTx = {
          userOpHash:  opHash,
          type:        operationType as KulaTx["type"],
          groupId:     operationParams.groupId as number | undefined,
          amount:      operationParams.amountUsdc as bigint | undefined,
          status:      "SUBMITTED",
          submittedAt: Date.now(),
        };
        addTx(tx);

        // Mark account as deployed once first op goes through
        setAccountStatus("DEPLOYED");

        // ── Start polling for confirmation ────────────────────────────────
        pollAndUpdate(opHash);

        return opHash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction failed";
        setLastError(msg);
        console.error(`[useSmartAccount] ${operationType} failed:`, err);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      smartAccountAddress,
      walletSource,
      getEmbeddedWallet,
      addTx,
      setAccountStatus,
    ]
  );

  // ── Poll bundler until confirmed or failed ───────────────────────────────
  const pollOpStatus = useCallback(
    async (userOpHash: string): Promise<"CONFIRMED" | "FAILED" | "PENDING"> => {
      try {
        const res  = await fetch(`${BACKEND_URL}/api/op-status/${userOpHash}`);
        const data = await res.json();
        return data.status === "CONFIRMED"
          ? "CONFIRMED"
          : data.status === "FAILED"
          ? "FAILED"
          : "PENDING";
      } catch {
        return "PENDING";
      }
    },
    []
  );

  const pollAndUpdate = useCallback(
    (userOpHash: string) => {
      let attempts = 0;
      const MAX_ATTEMPTS = 30;
      const INTERVAL_MS  = 4_000;

      const interval = setInterval(async () => {
        attempts++;
        const status = await pollOpStatus(userOpHash);

        if (status === "CONFIRMED") {
          updateTxStatus(userOpHash, "CONFIRMED");
          clearInterval(interval);
        } else if (status === "FAILED" || attempts >= MAX_ATTEMPTS) {
          updateTxStatus(userOpHash, status === "FAILED" ? "FAILED" : "SUBMITTED");
          clearInterval(interval);
        }
      }, INTERVAL_MS);
    },
    [pollOpStatus, updateTxStatus]
  );

  // ── PUBLIC API ────────────────────────────────────────────────────────────

  const contribute = useCallback(
    (groupId: number, amountUsdc: bigint) =>
      submitOperation("deposit", { groupId, amountUsdc: amountUsdc.toString() }),
    [submitOperation]
  );

  const voteOnAsset = useCallback(
    (proposalId: number, support: boolean) =>
      submitOperation("vote_asset", { proposalId, support }),
    [submitOperation]
  );

  const proposeAsset = useCallback(
    (
      groupId: number,
      registryAssetId: number,
      description: string,
      requestedAmount: bigint
    ) =>
      submitOperation("propose_asset", {
        groupId,
        registryAssetId,
        description,
        requestedAmount: requestedAmount.toString(),
      }),
    [submitOperation]
  );

  const voteOnApplicant = useCallback(
    (groupId: number, applicant: string, support: boolean) =>
      submitOperation("vote_applicant", { groupId, applicant, support }),
    [submitOperation]
  );

  return {
    isSubmitting,
    lastOpHash,
    lastError,
    contribute,
    voteOnAsset,
    proposeAsset,
    voteOnApplicant,
    pollOpStatus,
  };
}
