// FILE: mobile/src/components/MobileMarketplace.tsx
// PURPOSE: Mobile-native RWA Marketplace mirroring GlobalMarketplace.tsx.
//          Uses mock data (Wagmi not wired on RN yet). Full Oracle Score Rings,
//          asset cards, filter bar, and stats strip — all animated with Moti.
//          Styling via NativeWind v4. Icons via lucide-react-native.

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  Dimensions,
  Platform,
} from "react-native";
import { MotiView, MotiText, AnimatePresence } from "moti";
import { Easing } from "react-native-reanimated";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import {
  ShieldCheck,
  AlertTriangle,
  Search,
  SlidersHorizontal,
  Landmark,
  Car,
  FileText,
  ExternalLink,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Zap,
  TrendingUp,
  RefreshCw,
  BadgeCheck,
  Gavel,
  Eye,
  X,
} from "lucide-react-native";

// ---------------------------------------------------------------------------
// CONSTANTS & THEME
// ---------------------------------------------------------------------------

const GOLD       = "#D4AF37";
const GOLD_PALE  = "#F3E5AB";
const OBSIDIAN   = "#0F0F0F";
const CARD_BG    = "#1B1212";
const DEEP_CARD  = "#150D0D";

const { width: SCREEN_W } = Dimensions.get("window");

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type AssetType = "land_deed" | "vehicle_logbook" | "title_certificate" | "other";
type FilterType = "all" | AssetType;
type SortType   = "newest" | "price_asc" | "price_desc" | "trust_desc";

export interface RWAAsset {
  id:                  number;
  poster:              string;
  title:               string;
  documentCid:         string;
  askPrice:            number;   // USDC integer (e.g. 45000_000000 = $45,000)
  communityTrustScore: number;
  isVerified:          boolean;
  isMinted:            boolean;
  oracleScore:         number;   // 0–100
  assetType:           AssetType;
  location:            string;
  listedAt:            number;   // unix timestamp
}

// ---------------------------------------------------------------------------
// MOCK DATA
// ---------------------------------------------------------------------------

const MOCK_ASSETS: RWAAsset[] = [
  {
    id: 1,
    poster: "0xAf3d...7B21",
    title: "Kiambu County Land Deed — LR No. 8821/47",
    documentCid: "QmXk7TY...abc",
    askPrice: 45_000,
    communityTrustScore: 92,
    isVerified: true,
    isMinted: true,
    oracleScore: 97,
    assetType: "land_deed",
    location: "Kiambu, Kenya",
    listedAt: Date.now() - 86400 * 2 * 1000,
  },
  {
    id: 2,
    poster: "0x9B12...33Fc",
    title: "NTSA Vehicle Logbook — Toyota Land Cruiser V8 2019",
    documentCid: "QmZ9pQ...def",
    askPrice: 28_500,
    communityTrustScore: 74,
    isVerified: true,
    isMinted: false,
    oracleScore: 88,
    assetType: "vehicle_logbook",
    location: "Nairobi, Kenya",
    listedAt: Date.now() - 86400 * 5 * 1000,
  },
  {
    id: 3,
    poster: "0x1C44...8Ea0",
    title: "Mombasa Title Certificate — Plot 221, Tudor District",
    documentCid: "QmR3mN...ghi",
    askPrice: 62_000,
    communityTrustScore: 61,
    isVerified: true,
    isMinted: false,
    oracleScore: 91,
    assetType: "title_certificate",
    location: "Mombasa, Kenya",
    listedAt: Date.now() - 86400 * 1 * 1000,
  },
  {
    id: 4,
    poster: "0x5D88...2Cf7",
    title: "Nakuru Agricultural Deed — 4.5 Acres, LR 11093",
    documentCid: "QmVw1K...jkl",
    askPrice: 19_800,
    communityTrustScore: 48,
    isVerified: false,
    isMinted: false,
    oracleScore: 63,
    assetType: "land_deed",
    location: "Nakuru, Kenya",
    listedAt: Date.now() - 86400 * 8 * 1000,
  },
  {
    id: 5,
    poster: "0xE701...55A3",
    title: "NTSA Logbook — Mercedes-Benz Sprinter Fleet Unit #7",
    documentCid: "QmAb2F...mno",
    askPrice: 15_200,
    communityTrustScore: 55,
    isVerified: false,
    isMinted: false,
    oracleScore: 72,
    assetType: "vehicle_logbook",
    location: "Nairobi, Kenya",
    listedAt: Date.now() - 86400 * 12 * 1000,
  },
  {
    id: 6,
    poster: "0xC290...1B4E",
    title: "Kisumu Waterfront Title — Commercial Zone Parcel B9",
    documentCid: "QmJp9X...pqr",
    askPrice: 88_000,
    communityTrustScore: 89,
    isVerified: true,
    isMinted: true,
    oracleScore: 96,
    assetType: "title_certificate",
    location: "Kisumu, Kenya",
    listedAt: Date.now() - 86400 * 3 * 1000,
  },
];

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function formatUsdc(raw: number): string {
  return raw.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  land_deed:         "Land Deed",
  vehicle_logbook:   "Vehicle Logbook",
  title_certificate: "Title Certificate",
  other:             "Document",
};

function AssetTypeIcon({ type, size = 18 }: { type: AssetType; size?: number }) {
  const props = { size, color: GOLD };
  switch (type) {
    case "land_deed":         return <Landmark {...props} />;
    case "vehicle_logbook":   return <Car {...props} />;
    case "title_certificate": return <FileText {...props} />;
    default:                  return <FileText {...props} />;
  }
}

// ---------------------------------------------------------------------------
// ORACLE SCORE RING (SVG)
// ---------------------------------------------------------------------------

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const pct    = score / 100;
  const r      = (size / 2) - 5;
  const circ   = 2 * Math.PI * r;
  const dash   = circ * pct;
  const gap    = circ - dash;
  const isHigh = pct >= 0.85;
  const isMid  = pct >= 0.50;
  const stroke = isHigh ? "#22c55e" : isMid ? "#f59e0b" : "#ef4444";
  const label  = (pct * 100).toFixed(0);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: [{ rotate: "-90deg" }] }}>
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={4}
        />
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 11, fontWeight: "900", color: stroke, fontVariant: ["tabular-nums"] }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ORACLE BADGE
// ---------------------------------------------------------------------------

function OracleBadge({ score }: { score: number }) {
  const pct    = score / 100;
  const isHigh = pct >= 0.85;
  const isMid  = pct >= 0.50;
  const color  = isHigh ? "#22c55e" : isMid ? "#f59e0b" : "#ef4444";
  const bgColor  = isHigh ? "rgba(34,197,94,0.1)"  : isMid ? "rgba(245,158,11,0.1)"  : "rgba(239,68,68,0.1)";
  const bdrColor = isHigh ? "rgba(34,197,94,0.25)" : isMid ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)";
  const label  = isHigh ? "Oracle Verified" : isMid ? "Under Review" : "Low Trust";
  const IconEl = isHigh ? BadgeCheck : isMid ? Eye : AlertTriangle;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        backgroundColor: bgColor,
        borderColor: bdrColor,
        alignSelf: "flex-start",
      }}
    >
      <IconEl size={11} color={color} />
      <Text style={{ fontSize: 10, fontWeight: "800", color, letterSpacing: 0.8, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ fontSize: 10, fontWeight: "700", color, opacity: 0.8, fontVariant: ["tabular-nums"] }}>
        {pct.toFixed(2)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// VOTE BAR
// ---------------------------------------------------------------------------

function VoteBar({ votesFor, totalMembers }: { votesFor: number; totalMembers: number }) {
  const pct    = totalMembers > 0 ? (votesFor / totalMembers) * 100 : 0;
  const passed = pct > 50;

  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
        <Text style={{ fontSize: 9, fontWeight: "800", color: `${GOLD_PALE}80`, textTransform: "uppercase", letterSpacing: 1 }}>
          {votesFor} votes for
        </Text>
        <Text style={{ fontSize: 9, fontWeight: "800", color: passed ? "#22c55e" : GOLD, letterSpacing: 1 }}>
          {pct.toFixed(0)}%
        </Text>
      </View>
      <View style={{ height: 5, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
        <MotiView
          from={{ width: "0%" as any }}
          animate={{ width: `${Math.min(pct, 100)}%` as any }}
          transition={{ type: "timing", duration: 900, easing: Easing.out(Easing.cubic) }}
          style={{ height: "100%", backgroundColor: passed ? "#22c55e" : GOLD, borderRadius: 4 }}
        />
      </View>
      {pct >= 50 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 }}>
          <Zap size={9} color="#22c55e" fill="#22c55e" />
          <Text style={{ fontSize: 9, color: "#22c55e", fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
            Threshold reached
          </Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ASSET CARD
// ---------------------------------------------------------------------------

interface AssetCardProps {
  asset:   RWAAsset;
  index:   number;
  onPress: (asset: RWAAsset) => void;
}

function AssetCard({ asset, index, onPress }: AssetCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 32 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 520, delay: index * 80, easing: Easing.out(Easing.cubic) }}
      style={{ marginBottom: 16 }}
    >
      <Pressable
        onPress={() => onPress(asset)}
        style={({ pressed }) => ({
          backgroundColor: CARD_BG,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: pressed ? `${GOLD}40` : `${GOLD}18`,
          overflow: "hidden",
          opacity: pressed ? 0.92 : 1,
        })}
      >
        {/* Header strip */}
        <View
          style={{
            height: 96,
            backgroundColor: "#1E1208",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* Diagonal texture lines */}
          <View style={{
            position: "absolute", inset: 0,
            opacity: 0.08,
            overflow: "hidden",
          }} />

          {/* Type icon */}
          <View
            style={{
              padding: 14,
              backgroundColor: `${GOLD}12`,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: `${GOLD}20`,
            }}
          >
            <AssetTypeIcon type={asset.assetType} size={22} />
          </View>

          {/* Verified badge */}
          {asset.isVerified && (
            <MotiView
              from={{ scale: 0, rotate: "-20deg" }}
              animate={{ scale: 1, rotate: "0deg" }}
              transition={{ type: "spring", damping: 12, stiffness: 220, delay: 400 + index * 80 }}
              style={{
                position: "absolute",
                top: 10,
                right: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                backgroundColor: "rgba(34,197,94,0.12)",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(34,197,94,0.28)",
              }}
            >
              <ShieldCheck size={10} color="#22c55e" />
              <Text style={{ fontSize: 8, fontWeight: "900", color: "#22c55e", textTransform: "uppercase", letterSpacing: 1 }}>
                Verified
              </Text>
            </MotiView>
          )}

          {/* NFT Minted badge */}
          {asset.isMinted && (
            <View
              style={{
                position: "absolute",
                top: 10,
                left: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                backgroundColor: "rgba(0,82,255,0.12)",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(0,82,255,0.28)",
              }}
            >
              <Zap size={9} color="#4d8fff" fill="#4d8fff" />
              <Text style={{ fontSize: 8, fontWeight: "900", color: "#4d8fff", textTransform: "uppercase", letterSpacing: 1 }}>
                NFT Minted
              </Text>
            </View>
          )}
        </View>

        {/* Body */}
        <View style={{ padding: 20 }}>
          {/* Asset type label */}
          <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD}80`, textTransform: "uppercase", letterSpacing: 3, marginBottom: 6 }}>
            {ASSET_TYPE_LABEL[asset.assetType]}
          </Text>

          {/* Title */}
          <Text
            style={{ fontSize: 15, fontWeight: "700", color: GOLD_PALE, lineHeight: 22, marginBottom: 16 }}
            numberOfLines={2}
          >
            {asset.title}
          </Text>

          {/* Score ring + Price row */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <ScoreRing score={asset.oracleScore} size={60} />
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD}80`, textTransform: "uppercase", letterSpacing: 2, marginBottom: 3 }}>
                Ask Price
              </Text>
              <Text style={{ fontSize: 24, fontWeight: "800", color: GOLD, letterSpacing: -0.5 }}>
                ${formatUsdc(asset.askPrice)}
              </Text>
              <Text style={{ fontSize: 10, color: `${GOLD_PALE}60`, fontWeight: "500", marginTop: 1 }}>USDC</Text>
            </View>
          </View>

          {/* Oracle badge */}
          <OracleBadge score={asset.oracleScore} />

          {/* Community trust bar */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD_PALE}50`, textTransform: "uppercase", letterSpacing: 2 }}>
              Community Trust
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 80, height: 4, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                <View
                  style={{
                    width: `${Math.min(asset.communityTrustScore, 100)}%`,
                    height: "100%",
                    backgroundColor: GOLD,
                    borderRadius: 4,
                  }}
                />
              </View>
              <Text style={{ fontSize: 11, fontWeight: "800", color: GOLD, fontVariant: ["tabular-nums"] }}>
                {asset.communityTrustScore}
              </Text>
            </View>
          </View>

          {/* Location + posted by */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 14,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: `${GOLD}12`,
            }}
          >
            <View>
              <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD_PALE}40`, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 2 }}>
                Location
              </Text>
              <Text style={{ fontSize: 11, color: `${GOLD_PALE}70`, fontWeight: "600" }}>
                {asset.location}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD_PALE}40`, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 2 }}>
                Posted by
              </Text>
              <Text style={{ fontSize: 10, color: `${GOLD_PALE}60`, fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace" }}>
                {shortenAddr(asset.poster)}
              </Text>
            </View>
          </View>

          {/* Proposals expand toggle */}
          <TouchableOpacity
            onPress={() => setExpanded(v => !v)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 14,
              paddingVertical: 6,
            }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Gavel size={11} color={`${GOLD}80`} />
              <Text style={{ fontSize: 9, fontWeight: "900", color: `${GOLD}80`, textTransform: "uppercase", letterSpacing: 2 }}>
                Proposals &amp; Actions
              </Text>
            </View>
            <MotiView
              animate={{ rotate: expanded ? "90deg" : "0deg" }}
              transition={{ type: "timing", duration: 220 }}
            >
              <ChevronRight size={14} color={`${GOLD}60`} />
            </MotiView>
          </TouchableOpacity>

          {/* Expanded actions */}
          <AnimatePresence>
            {expanded && (
              <MotiView
                from={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" as any }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "timing", duration: 280 }}
                style={{ overflow: "hidden" }}
              >
                {/* Mock proposal */}
                <View
                  style={{
                    backgroundColor: OBSIDIAN,
                    borderRadius: 16,
                    padding: 14,
                    marginTop: 10,
                    borderWidth: 1,
                    borderColor: `${GOLD}12`,
                  }}
                >
                  <Text style={{ fontSize: 11, color: `${GOLD_PALE}80`, lineHeight: 16, marginBottom: 8 }}>
                    Nairobi Chama Circle 1 proposes acquiring this asset for group collateral.
                  </Text>
                  <Text style={{ fontSize: 10, color: `${GOLD}80`, fontWeight: "700", marginBottom: 8 }}>
                    Requesting <Text style={{ color: GOLD }}>${formatUsdc(asset.askPrice * 0.8)} USDC</Text>
                  </Text>
                  <VoteBar votesFor={7} totalMembers={12} />
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        paddingVertical: 10,
                        backgroundColor: "rgba(34,197,94,0.1)",
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "rgba(34,197,94,0.25)",
                      }}
                      activeOpacity={0.75}
                    >
                      <ThumbsUp size={12} color="#22c55e" />
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#22c55e" }}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        paddingVertical: 10,
                        backgroundColor: "rgba(239,68,68,0.08)",
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "rgba(239,68,68,0.18)",
                      }}
                      activeOpacity={0.75}
                    >
                      <ThumbsDown size={12} color="#ef4444" />
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#ef4444" }}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Propose Acquisition CTA */}
                {asset.isVerified && (
                  <TouchableOpacity
                    style={{
                      marginTop: 10,
                      paddingVertical: 14,
                      backgroundColor: GOLD,
                      borderRadius: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      shadowColor: GOLD,
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.28,
                      shadowRadius: 14,
                      elevation: 8,
                    }}
                    activeOpacity={0.85}
                  >
                    <Gavel size={14} color={OBSIDIAN} />
                    <Text style={{ fontSize: 11, fontWeight: "900", color: OBSIDIAN, textTransform: "uppercase", letterSpacing: 2 }}>
                      Propose Acquisition
                    </Text>
                  </TouchableOpacity>
                )}

                {!asset.isVerified && (
                  <View
                    style={{
                      marginTop: 10,
                      paddingVertical: 14,
                      backgroundColor: "rgba(255,255,255,0.02)",
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: `${GOLD}10`,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <AlertTriangle size={12} color={`${GOLD_PALE}40`} />
                    <Text style={{ fontSize: 10, fontWeight: "800", color: `${GOLD_PALE}40`, textTransform: "uppercase", letterSpacing: 1.5 }}>
                      Awaiting Oracle Verification
                    </Text>
                  </View>
                )}
              </MotiView>
            )}
          </AnimatePresence>
        </View>
      </Pressable>
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// STATS STRIP
// ---------------------------------------------------------------------------

function MarketplaceStats({ assets }: { assets: RWAAsset[] }) {
  const totalValue    = assets.reduce((sum, a) => sum + a.askPrice, 0);
  const verifiedCount = assets.filter(a => a.isVerified).length;
  const avgScore      = assets.length > 0
    ? assets.reduce((sum, a) => sum + a.oracleScore, 0) / assets.length
    : 0;

  const stats = [
    {
      label: "Total Listed",
      value: `$${formatUsdc(totalValue)}`,
      sub:   "USDC",
      icon:  <TrendingUp size={16} color={GOLD} />,
    },
    {
      label: "Verified",
      value: `${verifiedCount}`,
      sub:   `of ${assets.length}`,
      icon:  <ShieldCheck size={16} color="#22c55e" />,
    },
    {
      label: "Avg Score",
      value: `${avgScore.toFixed(1)}`,
      sub:   "/ 100",
      icon:  <BadgeCheck size={16} color={GOLD} />,
    },
  ];

  return (
    <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
      {stats.map((s, i) => (
        <MotiView
          key={i}
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 400, delay: i * 70, easing: Easing.out(Easing.quad) }}
          style={{
            flex: 1,
            backgroundColor: CARD_BG,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: `${GOLD}12`,
            padding: 14,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              backgroundColor: `${GOLD}10`,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: `${GOLD}14`,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
            }}
          >
            {s.icon}
          </View>
          <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD}70`, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 3, textAlign: "center" }}>
            {s.label}
          </Text>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff", letterSpacing: -0.3 }}>
            {s.value}
          </Text>
          <Text style={{ fontSize: 9, color: `${GOLD_PALE}50`, marginTop: 1 }}>{s.sub}</Text>
        </MotiView>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// FILTER BAR
// ---------------------------------------------------------------------------

const FILTER_OPTS: { key: FilterType; label: string }[] = [
  { key: "all",                label: "All"      },
  { key: "land_deed",          label: "Land"     },
  { key: "vehicle_logbook",    label: "Vehicles" },
  { key: "title_certificate",  label: "Titles"   },
];

const SORT_OPTS: { key: SortType; label: string }[] = [
  { key: "newest",     label: "Newest"       },
  { key: "price_asc",  label: "Price ↑"      },
  { key: "price_desc", label: "Price ↓"      },
  { key: "trust_desc", label: "Trust Score"  },
];

interface FilterBarProps {
  filter:    FilterType;
  sort:      SortType;
  search:    string;
  onFilter:  (f: FilterType) => void;
  onSort:    (s: SortType) => void;
  onSearch:  (q: string) => void;
}

function FilterBar({ filter, sort, search, onFilter, onSort, onSearch }: FilterBarProps) {
  const [sortOpen, setSortOpen] = useState(false);

  return (
    <View style={{ marginBottom: 16, gap: 10 }}>
      {/* Search input */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: CARD_BG,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: `${GOLD}18`,
          paddingHorizontal: 14,
          paddingVertical: 12,
          gap: 10,
        }}
      >
        <Search size={15} color={`${GOLD}60`} />
        <TextInput
          value={search}
          onChangeText={onSearch}
          placeholder="Search assets, locations, types…"
          placeholderTextColor={`${GOLD_PALE}30`}
          style={{ flex: 1, fontSize: 13, color: GOLD_PALE, padding: 0 }}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => onSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={13} color={`${GOLD}60`} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips + sort */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: "row" }}>
          {FILTER_OPTS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => onFilter(opt.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 14,
                backgroundColor: filter === opt.key ? GOLD : CARD_BG,
                borderWidth: 1,
                borderColor: filter === opt.key ? GOLD : `${GOLD}16`,
              }}
              activeOpacity={0.8}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: filter === opt.key ? OBSIDIAN : `${GOLD_PALE}70`,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sort button */}
        <View style={{ position: "relative" }}>
          <TouchableOpacity
            onPress={() => setSortOpen(v => !v)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: CARD_BG,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: `${GOLD}16`,
            }}
            activeOpacity={0.8}
          >
            <SlidersHorizontal size={12} color={`${GOLD}80`} />
            <Text style={{ fontSize: 10, fontWeight: "800", color: `${GOLD_PALE}70`, textTransform: "uppercase", letterSpacing: 1 }}>
              {SORT_OPTS.find(o => o.key === sort)?.label}
            </Text>
          </TouchableOpacity>

          <AnimatePresence>
            {sortOpen && (
              <MotiView
                from={{ opacity: 0, translateY: -8, scale: 0.96 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                exit={{ opacity: 0, translateY: -8, scale: 0.96 }}
                transition={{ type: "timing", duration: 160 }}
                style={{
                  position: "absolute",
                  top: 44,
                  right: 0,
                  zIndex: 100,
                  width: 140,
                  backgroundColor: "#1E1208",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: `${GOLD}22`,
                  overflow: "hidden",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 20,
                  elevation: 20,
                }}
              >
                {SORT_OPTS.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => { onSort(opt.key); setSortOpen(false); }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      backgroundColor: sort === opt.key ? `${GOLD}14` : "transparent",
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: sort === opt.key ? GOLD : `${GOLD_PALE}60`,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </MotiView>
            )}
          </AnimatePresence>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// EMPTY STATE
// ---------------------------------------------------------------------------

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: "timing", duration: 400 }}
      style={{ alignItems: "center", justifyContent: "center", paddingVertical: 64 }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: `${GOLD}08`,
          borderWidth: 1,
          borderColor: `${GOLD}15`,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Landmark size={32} color={`${GOLD}40`} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: "700", color: `${GOLD_PALE}50`, marginBottom: 8 }}>
        {hasSearch ? "No Assets Found" : "Marketplace Empty"}
      </Text>
      <Text style={{ fontSize: 13, color: `${GOLD_PALE}30`, textAlign: "center", maxWidth: 260, lineHeight: 20 }}>
        {hasSearch
          ? "Try adjusting your search or filter criteria."
          : "No verified RWAs listed yet. Assets appear once the AI Oracle validates them."}
      </Text>
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

interface MobileMarketplaceProps {
  /** Pass true when rendered inside a tab so it doesn't duplicate headers */
  embedded?: boolean;
}

export default function MobileMarketplace({ embedded = false }: MobileMarketplaceProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort,   setSort]   = useState<SortType>("newest");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const filtered = useMemo(() => {
    let list = [...MOCK_ASSETS];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        a =>
          a.title.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q) ||
          ASSET_TYPE_LABEL[a.assetType].toLowerCase().includes(q),
      );
    }

    // Filter by type
    if (filter !== "all") {
      list = list.filter(a => a.assetType === filter);
    }

    // Sort
    switch (sort) {
      case "newest":     list.sort((a, b) => b.listedAt - a.listedAt); break;
      case "price_asc":  list.sort((a, b) => a.askPrice - b.askPrice); break;
      case "price_desc": list.sort((a, b) => b.askPrice - a.askPrice); break;
      case "trust_desc": list.sort((a, b) => b.oracleScore - a.oracleScore); break;
    }

    return list;
  }, [filter, sort, search]);

  const handleAssetPress = useCallback((asset: RWAAsset) => {
    // TODO: Navigate to asset detail screen
    console.log("Asset pressed:", asset.id);
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: OBSIDIAN }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header — only shown when not embedded */}
      {!embedded && (
        <MotiView
          from={{ opacity: 0, translateY: -12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 500, easing: Easing.out(Easing.cubic) }}
          style={{ paddingTop: 20, marginBottom: 24 }}
        >
          <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD}70`, textTransform: "uppercase", letterSpacing: 4, marginBottom: 6 }}>
            KULA Protocol
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 26, fontWeight: "800", color: GOLD_PALE, letterSpacing: -0.5 }}>
              RWA Marketplace
            </Text>
            <TouchableOpacity
              onPress={handleRefresh}
              style={{
                width: 38,
                height: 38,
                borderRadius: 14,
                backgroundColor: `${GOLD}10`,
                borderWidth: 1,
                borderColor: `${GOLD}20`,
                alignItems: "center",
                justifyContent: "center",
              }}
              activeOpacity={0.75}
            >
              <MotiView
                animate={{ rotate: refreshing ? "360deg" : "0deg" }}
                transition={{ type: "timing", duration: 600, loop: refreshing }}
              >
                <RefreshCw size={15} color={GOLD} />
              </MotiView>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 12, color: `${GOLD_PALE}40`, marginTop: 4, lineHeight: 18 }}>
            AI-oracle-verified Real World Assets on Base L2
          </Text>
        </MotiView>
      )}

      {/* Stats strip */}
      <MarketplaceStats assets={MOCK_ASSETS} />

      {/* Filter bar */}
      <FilterBar
        filter={filter}
        sort={sort}
        search={search}
        onFilter={setFilter}
        onSort={setSort}
        onSearch={setSearch}
      />

      {/* Asset count */}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: "timing", duration: 300, delay: 200 }}
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}
      >
        <Text style={{ fontSize: 9, fontWeight: "900", color: `${GOLD_PALE}40`, textTransform: "uppercase", letterSpacing: 2 }}>
          {filtered.length} asset{filtered.length !== 1 ? "s" : ""}
        </Text>
        {filter !== "all" && (
          <>
            <Text style={{ fontSize: 9, color: `${GOLD_PALE}25`, marginHorizontal: 8 }}>·</Text>
            <Text style={{ fontSize: 9, fontWeight: "700", color: `${GOLD}70`, textTransform: "uppercase", letterSpacing: 1 }}>
              {FILTER_OPTS.find(f => f.key === filter)?.label}
            </Text>
          </>
        )}
      </MotiView>

      {/* Asset cards */}
      {filtered.length === 0 ? (
        <EmptyState hasSearch={search.length > 0 || filter !== "all"} />
      ) : (
        filtered.map((asset, idx) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            index={idx}
            onPress={handleAssetPress}
          />
        ))
      )}

      {/* Bottom spacer for tab bar */}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
