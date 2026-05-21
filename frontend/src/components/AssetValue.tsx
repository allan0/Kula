"use client";

// =============================================================================
// FILE: frontend/src/components/AssetVault.tsx
// PURPOSE: Phase 5 – Asset Vault with live blockchain sync
//
// CHANGES FROM PREVIOUS VERSION:
//   - Wagmi useReadContract pointed at KulaPublicRegistry.getAsset() with
//     watch: true so it re-fetches on every new block.
//   - Custom BigInt → human-readable transform applied to all numeric fields.
//   - RotaryGroup.groups() read to show the active group's current balance.
//   - Connects to useKulaStore to dispatch setSmartAccountBalance on updates.
//   - Upload flow calls POST /api/verify-asset (Phase 4 Oracle).
//
// WAGMI SETUP REQUIRED in providers.tsx:
//   import { http, createConfig } from 'wagmi'
//   import { baseSepolia } from 'wagmi/chains'
//   export const wagmiConfig = createConfig({
//     chains: [baseSepolia],
//     transports: { [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC) },
//   })
// =============================================================================

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReadContract, useBlockNumber } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { Landmark, Upload, ShieldCheck, ExternalLink, Loader2, AlertTriangle, Eye } from "lucide-react";

import useKulaStore, {
    selectActiveGroupId,
    selectSmartAccountAddress,
    formatSmartAccountBalance,
    useKulaStore as rawStore,
} from "@/store/useKulaStore";

// ---------------------------------------------------------------------------
// CONTRACT CONFIGURATION
// ---------------------------------------------------------------------------

const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_KULA_REGISTRY_ADDRESS || "0x0") as `0x${string}`;
const ROTARY_ADDRESS   = (process.env.NEXT_PUBLIC_ROTARY_GROUP_CONTRACT  || "0x0") as `0x${string}`;
const USDC_ADDRESS     = (process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`;
const BACKEND_URL      = process.env.NEXT_PUBLIC_BACKEND_URL || "";

/** ABI fragments — only what AssetVault needs */
const REGISTRY_ABI = [
    {
        name: "getAsset",
        type: "function",
        stateMutability: "view",
        inputs:  [{ name: "_assetId", type: "uint256" }],
        outputs: [
            { name: "id",                  type: "uint256" },
            { name: "poster",              type: "address" },
            { name: "title",               type: "string"  },
            { name: "documentCid",         type: "string"  },
            { name: "askPrice",            type: "uint256" },
            { name: "communityTrustScore", type: "uint256" },
            { name: "isVerified",          type: "bool"    },
            { name: "isMinted",            type: "bool"    },
        ],
    },
    {
        name: "assetCount",
        type: "function",
        stateMutability: "view",
        inputs:  [],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const;

const ROTARY_GROUP_ABI = [
    {
        name: "groups",
        type: "function",
        stateMutability: "view",
        inputs:  [{ name: "", type: "uint256" }],
        outputs: [
            { name: "id",                  type: "uint256" },
            { name: "name",                type: "string"  },
            { name: "creator",             type: "address" },
            { name: "contributionAmount",  type: "uint256" },
            { name: "intervalSeconds",     type: "uint256" },
            { name: "totalContributed",    type: "uint256" },
            { name: "currentBalance",      type: "uint256" },
            { name: "currentRecipientIndex", type: "uint256" },
            { name: "lastPayoutTimestamp", type: "uint256" },
            { name: "isActive",            type: "bool"    },
        ],
    },
] as const;

const ERC20_ABI = [
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs:  [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const;

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Converts a raw uint256 BigInt (6 decimal USDC) to a human-readable USD string.
 * Example: 1_500_000n → "$1.50"
 */
function formatUsdcBigInt(raw: bigint | undefined, prefix = "$"): string {
    if (raw === undefined || raw === null) return `${prefix}—`;
    try {
        const whole = raw / 1_000_000n;
        const frac  = (raw % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
        return `${prefix}${whole.toLocaleString()}.${frac}`;
    } catch {
        return `${prefix}0.00`;
    }
}

/** Returns a short hex digest for an IPFS CID display */
function shortenCid(cid: string): string {
    if (!cid || cid.length < 12) return cid;
    return `${cid.slice(0, 8)}...${cid.slice(-6)}`;
}

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface AssetRow {
    id:                  number;
    poster:              string;
    title:               string;
    documentCid:         string;
    askPrice:            bigint;
    communityTrustScore: bigint;
    isVerified:          boolean;
    isMinted:            boolean;
}

// ---------------------------------------------------------------------------
// SUB-COMPONENT: Asset Card
// ---------------------------------------------------------------------------

function AssetCard({ asset }: { asset: AssetRow }) {
    const trustPercent = Number(asset.communityTrustScore);
    const isHigh       = trustPercent >= 75;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-3xl p-8 border border-[#D4AF37]/10 hover:border-[#D4AF37]/30 transition-all group"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-[#D4AF37]/10 rounded-2xl">
                        <Landmark size={20} className="text-[#D4AF37]" />
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-widest text-[#D4AF37]/60 font-black">ASSET #{asset.id}</p>
                        <h4 className="font-semibold text-sm mt-0.5">{asset.title}</h4>
                    </div>
                </div>

                {asset.isVerified ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-xs font-bold">
                        <ShieldCheck size={12} /> VERIFIED
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-bold">
                        <AlertTriangle size={12} /> PENDING
                    </div>
                )}
            </div>

            {/* Ask price */}
            <div className="mt-4">
                <p className="text-xs text-[#F3E5AB]/50 uppercase tracking-widest">Ask Price</p>
                <p className="text-3xl font-serif tracking-tighter mt-1">
                    {formatUsdcBigInt(asset.askPrice)}
                </p>
            </div>

            {/* Community trust bar */}
            <div className="mt-5">
                <div className="flex justify-between text-xs mb-2">
                    <span className="text-[#F3E5AB]/60 uppercase tracking-wider">Community Trust</span>
                    <span className={isHigh ? "text-green-400 font-bold" : "text-amber-400"}>{trustPercent}%</span>
                </div>
                <div className="h-1.5 bg-[#D4AF37]/10 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(trustPercent, 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-full rounded-full ${isHigh ? "bg-green-500" : "bg-amber-500"}`}
                    />
                </div>
            </div>

            {/* IPFS link */}
            {asset.documentCid && (
                <a
                    href={`https://ipfs.io/ipfs/${asset.documentCid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 flex items-center gap-2 text-xs text-[#D4AF37]/60 hover:text-[#D4AF37] transition-colors font-mono"
                >
                    <Eye size={12} />
                    {shortenCid(asset.documentCid)}
                    <ExternalLink size={10} />
                </a>
            )}

            {asset.isMinted && (
                <div className="mt-4 text-xs px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-full text-purple-400 font-bold inline-flex items-center gap-1">
                    ✦ TRUST EQUITY NFT MINTED
                </div>
            )}
        </motion.div>
    );
}

// ---------------------------------------------------------------------------
// SUB-COMPONENT: Group Balance Banner
// ---------------------------------------------------------------------------

function GroupBalanceBanner({ groupId }: { groupId: number }) {
    const { data: groupData, isLoading } = useReadContract({
        address:      ROTARY_ADDRESS,
        abi:          ROTARY_GROUP_ABI,
        functionName: "groups",
        args:         [BigInt(groupId)],
        chainId:      baseSepolia.id,
        query: { refetchInterval: 10_000 }, // Every 10s
    });

    if (isLoading) return null;

    const currentBalance = groupData?.[6] as bigint | undefined;
    const totalContributed = groupData?.[5] as bigint | undefined;
    const groupName  = groupData?.[1] as string | undefined;

    return (
        <div className="mb-6 p-5 glass-card rounded-2xl border border-[#D4AF37]/20">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-widest text-[#D4AF37]/60">
                        GROUP #{groupId} — {groupName ?? "..."}
                    </p>
                    <p className="text-2xl font-serif mt-1">
                        {formatUsdcBigInt(currentBalance)} <span className="text-sm text-[#F3E5AB]/50">liquid</span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-[#F3E5AB]/50">Total Contributed</p>
                    <p className="text-sm font-mono text-[#D4AF37]">{formatUsdcBigInt(totalContributed)}</p>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT: AssetVault
// ---------------------------------------------------------------------------

export default function AssetVault() {
    const activeGroupId       = useKulaStore(selectActiveGroupId);
    const smartAccountAddress = useKulaStore(selectSmartAccountAddress);
    const setBalance          = rawStore(s => s.setSmartAccountBalance);
    const storedBalance       = rawStore(s => s.smartAccountBalance);

    const [uploadFile,      setUploadFile]      = useState<File | null>(null);
    const [assetIdInput,    setAssetIdInput]     = useState("");
    const [contextInput,    setContextInput]     = useState("");
    const [isUploading,     setIsUploading]      = useState(false);
    const [uploadResult,    setUploadResult]     = useState<Record<string, unknown> | null>(null);
    const [uploadError,     setUploadError]      = useState<string | null>(null);
    const [previewAssetId,  setPreviewAssetId]   = useState<number>(1);

    // ── Live block number (triggers re-reads) ──────────────────────────────
    const { data: blockNumber } = useBlockNumber({ watch: true, chainId: baseSepolia.id });

    // ── Smart Account USDC balance ─────────────────────────────────────────
    const { data: usdcBalance } = useReadContract({
        address:      USDC_ADDRESS,
        abi:          ERC20_ABI,
        functionName: "balanceOf",
        args:         smartAccountAddress ? [smartAccountAddress as `0x${string}`] : undefined,
        chainId:      baseSepolia.id,
        query: {
            enabled:        !!smartAccountAddress,
            refetchInterval: 8_000,
        },
    });

    // Sync balance to global store whenever Wagmi updates it
    useEffect(() => {
        if (usdcBalance !== undefined && blockNumber !== undefined) {
            setBalance(usdcBalance as bigint, Number(blockNumber));
        }
    }, [usdcBalance, blockNumber, setBalance]);

    // ── Asset count from KulaPublicRegistry ───────────────────────────────
    const { data: assetCount, isLoading: isCountLoading } = useReadContract({
        address:      REGISTRY_ADDRESS,
        abi:          REGISTRY_ABI,
        functionName: "assetCount",
        chainId:      baseSepolia.id,
        query: { refetchInterval: 15_000 },
    });

    // ── Single asset preview read (watch: true via refetchInterval) ────────
    const { data: assetData, isLoading: isAssetLoading, isError: isAssetError } = useReadContract({
        address:      REGISTRY_ADDRESS,
        abi:          REGISTRY_ABI,
        functionName: "getAsset",
        args:         [BigInt(previewAssetId)],
        chainId:      baseSepolia.id,
        query: {
            enabled:         previewAssetId > 0,
            refetchInterval: 12_000, // poll every 12s — "watch: true" equivalent
        },
    });

    // Transform raw tuple into typed AssetRow
    const asset: AssetRow | null = assetData
        ? {
            id:                  Number((assetData as bigint[])[0]),
            poster:              (assetData as unknown[])[1] as string,
            title:               (assetData as unknown[])[2] as string,
            documentCid:         (assetData as unknown[])[3] as string,
            askPrice:            (assetData as bigint[])[4],
            communityTrustScore: (assetData as bigint[])[5],
            isVerified:          (assetData as unknown[])[6] as boolean,
            isMinted:            (assetData as unknown[])[7] as boolean,
          }
        : null;

    // ── Upload handler ─────────────────────────────────────────────────────
    const handleUpload = useCallback(async () => {
        if (!uploadFile || !assetIdInput) return;

        setIsUploading(true);
        setUploadError(null);
        setUploadResult(null);

        try {
            const formData = new FormData();
            formData.append("file",    uploadFile);
            formData.append("assetId", assetIdInput);
            if (contextInput) formData.append("context", contextInput);

            const res = await fetch(`${BACKEND_URL}/api/verify-asset`, {
                method: "POST",
                body:   formData,
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setUploadError(data.error || "Verification failed. Please try again.");
            } else {
                setUploadResult(data);
                // Jump the preview to the newly verified asset
                setPreviewAssetId(parseInt(assetIdInput, 10));
            }
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : "Network error");
        } finally {
            setIsUploading(false);
        }
    }, [uploadFile, assetIdInput, contextInput]);

    // ── UI ─────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="uppercase text-xs tracking-[0.4em] text-[#D4AF37] font-black">KULA ORACLE</p>
                    <h2 className="text-4xl font-serif tracking-tighter mt-1">Asset Vault</h2>
                </div>

                <div className="text-right">
                    <p className="text-xs text-[#F3E5AB]/50">Your Balance</p>
                    <p className="text-2xl font-serif gold-text">
                        {formatSmartAccountBalance(storedBalance)} USDC
                    </p>
                </div>
            </div>

            {/* Group balance if a group is active */}
            {activeGroupId && <GroupBalanceBanner groupId={activeGroupId} />}

            {/* Oracle Upload Form */}
            <div className="glass-card rounded-[2.5rem] p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-[#D4AF37]/10 rounded-2xl">
                        <Upload size={20} className="text-[#D4AF37]" />
                    </div>
                    <div>
                        <h3 className="font-semibold">Submit Asset for Oracle Verification</h3>
                        <p className="text-xs text-[#F3E5AB]/50 mt-0.5">Upload a deed or logbook — our AI Oracle will verify authenticity</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="text-xs uppercase tracking-widest text-[#D4AF37]/60 block mb-2">
                            Asset ID (Registry #)
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={assetIdInput}
                            onChange={e => setAssetIdInput(e.target.value)}
                            placeholder="e.g. 1"
                            className="w-full bg-black/40 border border-[#D4AF37]/20 focus:border-[#D4AF37] rounded-2xl px-5 py-3.5 text-sm outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="text-xs uppercase tracking-widest text-[#D4AF37]/60 block mb-2">
                            Context Hint (optional)
                        </label>
                        <input
                            type="text"
                            value={contextInput}
                            onChange={e => setContextInput(e.target.value)}
                            placeholder="e.g. Kenyan land deed, Kiambu"
                            className="w-full bg-black/40 border border-[#D4AF37]/20 focus:border-[#D4AF37] rounded-2xl px-5 py-3.5 text-sm outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="mb-5">
                    <label className="text-xs uppercase tracking-widest text-[#D4AF37]/60 block mb-2">
                        Document File (JPEG, PNG, PDF — max 10MB)
                    </label>
                    <div
                        className="border-2 border-dashed border-[#D4AF37]/20 hover:border-[#D4AF37]/40 rounded-2xl p-8 text-center cursor-pointer transition-all"
                        onClick={() => document.getElementById("asset-file-input")?.click()}
                    >
                        {uploadFile ? (
                            <p className="text-sm text-[#D4AF37]">📄 {uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)}KB)</p>
                        ) : (
                            <p className="text-sm text-[#F3E5AB]/40">Click to select document or drag & drop</p>
                        )}
                        <input
                            id="asset-file-input"
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="hidden"
                            onChange={e => setUploadFile(e.target.files?.[0] || null)}
                        />
                    </div>
                </div>

                {uploadError && (
                    <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm flex items-start gap-2">
                        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                        {uploadError}
                    </div>
                )}

                <button
                    onClick={handleUpload}
                    disabled={isUploading || !uploadFile || !assetIdInput}
                    className="w-full py-5 bg-gradient-to-r from-[#D4AF37] to-[#B8972E] text-black rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                >
                    {isUploading ? (
                        <><Loader2 size={18} className="animate-spin" /> ANALYZING DOCUMENT...</>
                    ) : (
                        <><ShieldCheck size={18} /> SUBMIT TO ORACLE</>
                    )}
                </button>
            </div>

            {/* Upload Result */}
            <AnimatePresence>
                {uploadResult && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="glass-card rounded-[2.5rem] p-8 border border-green-500/20"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <ShieldCheck size={22} className="text-green-500" />
                            <h3 className="font-semibold text-green-400">Oracle Analysis Complete</h3>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            {[
                                { label: "Authenticity", value: `${Math.round(((uploadResult.analysis as Record<string,unknown>)?.document_authenticity_score as number) * 100)}%` },
                                { label: "Auto Verified", value: uploadResult.autoVerified ? "✅ YES" : "⏳ Pending" },
                                { label: "Asset Type",   value: ((uploadResult.analysis as Record<string,unknown>)?.asset_type as string) || "—" },
                                { label: "Owner",        value: ((uploadResult.analysis as Record<string,unknown>)?.owner as string)?.split(" ")[0] || "—" },
                            ].map(({ label, value }) => (
                                <div key={label} className="p-4 bg-black/30 rounded-2xl">
                                    <p className="text-xs text-[#F3E5AB]/50 uppercase tracking-wider">{label}</p>
                                    <p className="text-lg font-semibold mt-1 truncate">{value}</p>
                                </div>
                            ))}
                        </div>

                        {uploadResult.txHash && (
                            <a
                                href={`https://sepolia.basescan.org/tx/${uploadResult.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-5 flex items-center gap-2 text-xs text-[#D4AF37]/70 hover:text-[#D4AF37] transition-colors font-mono"
                            >
                                <ExternalLink size={12} />
                                View Oracle TX: {(uploadResult.txHash as string).slice(0, 18)}...
                            </a>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Live Asset Preview — navigable by ID */}
            <div className="glass-card rounded-[2.5rem] p-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold">Live Registry Preview</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-[#F3E5AB]/50 font-mono">
                            {isCountLoading ? "..." : `${Number(assetCount ?? 0)} assets`}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPreviewAssetId(p => Math.max(1, p - 1))}
                                className="w-8 h-8 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 rounded-full text-xs font-bold"
                                disabled={previewAssetId <= 1}
                            >
                                ‹
                            </button>
                            <span className="text-xs font-mono text-[#D4AF37]">#{previewAssetId}</span>
                            <button
                                onClick={() => setPreviewAssetId(p => p + 1)}
                                className="w-8 h-8 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 rounded-full text-xs font-bold"
                                disabled={previewAssetId >= Number(assetCount ?? 1)}
                            >
                                ›
                            </button>
                        </div>
                    </div>
                </div>

                {isAssetLoading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-[#D4AF37]" />
                    </div>
                )}

                {isAssetError && (
                    <p className="text-center text-[#F3E5AB]/40 py-8 text-sm">Asset #{previewAssetId} not found on-chain.</p>
                )}

                {asset && !isAssetLoading && (
                    <AssetCard asset={asset} />
                )}
            </div>
        </div>
    );
}
