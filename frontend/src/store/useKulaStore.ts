// FILE: frontend/src/store/useKulaStore.ts
// PURPOSE: Central Zustand store for all KULA app state — wallet identity,
//          smart account, active group, UI, and transaction history.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type WalletSource = "privy_embedded" | "privy_google" | "telegram" | "ussd" | null;
export type AccountStatus = "PENDING" | "DEPLOYED" | "UNKNOWN";
export type TxStatus = "SUBMITTED" | "CONFIRMED" | "FAILED";

export interface KulaTx {
  userOpHash: string;
  type: "deposit" | "propose_asset" | "vote_asset" | "approve_usdc" | "payout";
  groupId?: number;
  amount?: bigint;
  status: TxStatus;
  txHash?: string;
  submittedAt: number; // unix ms
  confirmedAt?: number;
}

export interface TelegramUser {
  tgId: string;
  tgUsername: string;
  displayName: string;
}

export interface KulaState {
  // ── Identity ───────────────────────────────────────────────────────────
  smartAccountAddress: string | null;
  ownerEOA: string | null;
  walletSource: WalletSource;
  accountStatus: AccountStatus;
  reputationScore: number;

  // ── Smart Account Balance (USDC, 6-decimal BigInt stored as string) ────
  smartAccountBalance: bigint;
  smartAccountBalanceBlock: number;

  // ── Active Group ───────────────────────────────────────────────────────
  activeGroupId: number | null;
  activeGroupName: string | null;

  // ── Telegram identity (set by TelegramProvider) ───────────────────────
  telegramUser: TelegramUser | null;

  // ── Transaction history (last 20, session-only) ───────────────────────
  recentTxs: KulaTx[];

  // ── UI state ──────────────────────────────────────────────────────────
  isTma: boolean; // true when running inside Telegram Mini App

  // ── ACTIONS ───────────────────────────────────────────────────────────
  setSmartAccount: (
    address: string,
    ownerEOA: string,
    source: WalletSource,
    status?: AccountStatus
  ) => void;
  clearSmartAccount: () => void;
  setSmartAccountBalance: (balance: bigint, blockNumber: number) => void;
  setActiveGroup: (groupId: number, groupName: string) => void;
  clearActiveGroup: () => void;
  setTelegramUser: (user: TelegramUser) => void;
  setIsTma: (isTma: boolean) => void;
  setAccountStatus: (status: AccountStatus) => void;
  setReputationScore: (score: number) => void;
  addTx: (tx: KulaTx) => void;
  updateTxStatus: (userOpHash: string, status: TxStatus, txHash?: string) => void;
}

// ---------------------------------------------------------------------------
// STORE
// ---------------------------------------------------------------------------

const useKulaStore = create<KulaState>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────
      smartAccountAddress: null,
      ownerEOA: null,
      walletSource: null,
      accountStatus: "UNKNOWN",
      reputationScore: 50,
      smartAccountBalance: 0n,
      smartAccountBalanceBlock: 0,
      activeGroupId: null,
      activeGroupName: null,
      telegramUser: null,
      recentTxs: [],
      isTma: false,

      // ── Actions ────────────────────────────────────────────────────────
      setSmartAccount: (address, ownerEOA, source, status = "UNKNOWN") =>
        set({
          smartAccountAddress: address,
          ownerEOA,
          walletSource: source,
          accountStatus: status,
        }),

      clearSmartAccount: () =>
        set({
          smartAccountAddress: null,
          ownerEOA: null,
          walletSource: null,
          accountStatus: "UNKNOWN",
          smartAccountBalance: 0n,
          smartAccountBalanceBlock: 0,
          telegramUser: null,
          recentTxs: [],
        }),

      setSmartAccountBalance: (balance, blockNumber) => {
        // Only update if this is for a newer block than what we have
        if (blockNumber >= get().smartAccountBalanceBlock) {
          set({ smartAccountBalance: balance, smartAccountBalanceBlock: blockNumber });
        }
      },

      setActiveGroup: (groupId, groupName) =>
        set({ activeGroupId: groupId, activeGroupName: groupName }),

      clearActiveGroup: () =>
        set({ activeGroupId: null, activeGroupName: null }),

      setTelegramUser: (user) => set({ telegramUser: user }),

      setIsTma: (isTma) => set({ isTma }),

      setAccountStatus: (status) => set({ accountStatus: status }),

      setReputationScore: (score) => set({ reputationScore: score }),

      addTx: (tx) =>
        set((state) => ({
          recentTxs: [tx, ...state.recentTxs].slice(0, 20),
        })),

      updateTxStatus: (userOpHash, status, txHash) =>
        set((state) => ({
          recentTxs: state.recentTxs.map((tx) =>
            tx.userOpHash === userOpHash
              ? {
                  ...tx,
                  status,
                  txHash: txHash ?? tx.txHash,
                  confirmedAt: status === "CONFIRMED" ? Date.now() : tx.confirmedAt,
                }
              : tx
          ),
        })),
    }),
    {
      name: "kula-store",
      storage: createJSONStorage(() => localStorage, {
        // Custom serializer handles BigInt
        replacer: (_key, value) =>
          typeof value === "bigint" ? { __bigint: value.toString() } : value,
        reviver: (_key, value) =>
          value && typeof value === "object" && "__bigint" in value
            ? BigInt((value as { __bigint: string }).__bigint)
            : value,
      }),
      // Only persist identity and group selection — not balance or txs
      partialize: (state) => ({
        smartAccountAddress: state.smartAccountAddress,
        ownerEOA: state.ownerEOA,
        walletSource: state.walletSource,
        accountStatus: state.accountStatus,
        reputationScore: state.reputationScore,
        activeGroupId: state.activeGroupId,
        activeGroupName: state.activeGroupName,
        telegramUser: state.telegramUser,
      }),
    }
  )
);

// ---------------------------------------------------------------------------
// SELECTORS (memoised for use with useKulaStore(selector))
// ---------------------------------------------------------------------------

export const selectSmartAccountAddress = (s: KulaState) => s.smartAccountAddress;
export const selectOwnerEOA            = (s: KulaState) => s.ownerEOA;
export const selectActiveGroupId       = (s: KulaState) => s.activeGroupId;
export const selectActiveGroupName     = (s: KulaState) => s.activeGroupName;
export const selectWalletSource        = (s: KulaState) => s.walletSource;
export const selectIsTma               = (s: KulaState) => s.isTma;
export const selectAccountStatus       = (s: KulaState) => s.accountStatus;
export const selectTelegramUser        = (s: KulaState) => s.telegramUser;
export const selectRecentTxs           = (s: KulaState) => s.recentTxs;
export const selectReputationScore     = (s: KulaState) => s.reputationScore;

// ---------------------------------------------------------------------------
// FORMATTERS (pure — safe to call outside React)
// ---------------------------------------------------------------------------

/**
 * Formats a raw USDC BigInt (6 decimals) to a human-readable string.
 * 1_500_000n → "$1.50"
 */
export function formatSmartAccountBalance(raw: bigint, prefix = "$"): string {
  if (!raw || raw === 0n) return `${prefix}0.00`;
  try {
    const whole = raw / 1_000_000n;
    const frac  = (raw % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
    return `${prefix}${whole.toLocaleString()}.${frac}`;
  } catch {
    return `${prefix}0.00`;
  }
}

/**
 * Returns a short checksum display of a hex address.
 * 0x1234...ABCD
 */
export function shortenAddress(addr: string | null | undefined): string {
  if (!addr || addr.length < 10) return addr ?? "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default useKulaStore;
