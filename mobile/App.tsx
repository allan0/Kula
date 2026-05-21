// FILE: mobile/App.tsx
// PURPOSE: KULA Sovereign Vault — main Expo app shell.
//   - Dark Luxury (Obsidian/Gold) aesthetic throughout
//   - NativeWind v4 className support
//   - Moti + AnimatePresence for all transitions
//   - Bottom tab bar: Dashboard · Marketplace · Circle · Identity
//   - Dashboard: portfolio value, quick-action hubs, stats, tx feed, yield ticker
//   - Renders MobileMarketplace inline in its own tab
//   - Safe-area aware on iOS/Android notch devices
//   - Haptics on key interactions (expo-haptics)

import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Dimensions,
  StatusBar,
  Platform,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView, MotiText, AnimatePresence } from "moti";
import { Easing } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Svg, { Circle as SvgCircle, Defs, LinearGradient, Stop } from "react-native-svg";
import {
  Users,
  Landmark,
  Wallet,
  TrendingUp,
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  ShieldCheck,
  RefreshCw,
  Copy,
  ChevronRight,
  Star,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  LayoutGrid,
  UserCircle2,
  Home,
  Store,
  Bell,
  Settings,
  Globe,
  BadgeCheck,
  Coins,
} from "lucide-react-native";

import MobileMarketplace from "./src/components/MobileMarketplace";

// ---------------------------------------------------------------------------
// THEME
// ---------------------------------------------------------------------------

const GOLD       = "#D4AF37";
const GOLD_PALE  = "#F3E5AB";
const OBSIDIAN   = "#0F0F0F";
const CARD_BG    = "#1B1212";
const CARD_DEEP  = "#150D0D";
const SURFACE    = "#1E1208";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ---------------------------------------------------------------------------
// MOCK STATE  (replace with Zustand store when wired)
// ---------------------------------------------------------------------------

interface MockTx {
  id:     string;
  type:   "deposit" | "payout" | "yield" | "proposal";
  amount: number;
  label:  string;
  time:   string;
  status: "confirmed" | "pending" | "failed";
}

const MOCK_TXS: MockTx[] = [
  { id: "t1", type: "deposit",  amount: 500,  label: "Contributed to Nairobi Circle 1", time: "2h ago",  status: "confirmed" },
  { id: "t2", type: "payout",   amount: 3000, label: "Cycle 4 payout received",         time: "1d ago",  status: "confirmed" },
  { id: "t3", type: "yield",    amount: 18,   label: "Aave V3 yield harvest",            time: "2d ago",  status: "confirmed" },
  { id: "t4", type: "deposit",  amount: 500,  label: "Contributed to Nairobi Circle 1", time: "8d ago",  status: "confirmed" },
  { id: "t5", type: "proposal", amount: 0,    label: "Voted on Kiambu Land Deed",        time: "10d ago", status: "confirmed" },
];

const MOCK_PORTFOLIO = {
  totalUsd:       12_847.50,
  change24h:      +2.34,
  groupBalance:   9_200.00,
  rwaHoldings:    3_200.00,
  yieldEarned:    447.50,
  reputationScore: 87,
  smartAccount:   "0xAb3d…7B21",
  groupName:      "Nairobi Chama Circle 1",
  groupMembers:   12,
  nextPayout:     "Jun 14, 2026",
  cycleProgress:  67,
  contributionAmt: 500,
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// TX STATUS PILL
// ---------------------------------------------------------------------------

type TxPhase = "idle" | "signing" | "pending" | "confirmed" | "failed";

interface StatusPillProps { phase: TxPhase; }

function StatusPill({ phase }: StatusPillProps) {
  if (phase === "idle") return null;

  type PhaseConfig = { bg: string; border: string; color: string; label: string };
  const map: Record<Exclude<TxPhase, "idle">, PhaseConfig> = {
    signing:   { bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)",  color: "#f59e0b", label: "Awaiting Signature…" },
    pending:   { bg: "rgba(59,130,246,0.1)",   border: "rgba(59,130,246,0.3)",  color: "#60a5fa", label: "Bundling UserOp…"    },
    confirmed: { bg: "rgba(34,197,94,0.1)",    border: "rgba(34,197,94,0.3)",   color: "#22c55e", label: "Confirmed On-Chain"  },
    failed:    { bg: "rgba(239,68,68,0.1)",    border: "rgba(239,68,68,0.3)",   color: "#ef4444", label: "Transaction Failed"  },
  };
  const c = map[phase];

  return (
    <MotiView
      from={{ opacity: 0, translateY: -6, scale: 0.94 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      exit={{ opacity: 0, translateY: -6, scale: 0.94 }}
      transition={{ type: "spring", damping: 18, stiffness: 280 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "center",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 24,
        borderWidth: 1,
        backgroundColor: c.bg,
        borderColor: c.border,
        marginTop: 10,
      }}
    >
      {phase === "signing" || phase === "pending" ? (
        <MotiView
          animate={{ rotate: "360deg" }}
          transition={{ type: "timing", duration: 900, loop: true, repeatReverse: false }}
        >
          <Loader2 size={12} color={c.color} />
        </MotiView>
      ) : phase === "confirmed" ? (
        <CheckCircle2 size={12} color={c.color} />
      ) : (
        <XCircle size={12} color={c.color} />
      )}
      <Text style={{ fontSize: 11, fontWeight: "800", color: c.color, letterSpacing: 0.5 }}>
        {c.label}
      </Text>
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// PORTFOLIO HERO CARD
// ---------------------------------------------------------------------------

function PortfolioHero({ onContribute }: { onContribute: () => void }) {
  const [txPhase, setTxPhase] = useState<TxPhase>("idle");

  const handleContribute = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTxPhase("signing");
    setTimeout(() => setTxPhase("pending"),   1200);
    setTimeout(() => setTxPhase("confirmed"), 3200);
    setTimeout(() => { setTxPhase("idle"); onContribute(); }, 5000);
  }, [onContribute]);

  return (
    <MotiView
      from={{ opacity: 0, translateY: -20, scale: 0.96 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: "timing", duration: 600, easing: Easing.out(Easing.cubic) }}
      style={{
        backgroundColor: CARD_BG,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: `${GOLD}22`,
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      {/* Gold shimmer gradient bar at top */}
      <View
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${GOLD}, ${GOLD_PALE}, ${GOLD})`,
          backgroundColor: GOLD,
          opacity: 0.7,
        }}
      />

      <View style={{ padding: 24 }}>
        {/* Group name + badge */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD}70`, textTransform: "uppercase", letterSpacing: 3, marginBottom: 3 }}>
              Active Circle
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "700", color: GOLD_PALE }}>{MOCK_PORTFOLIO.groupName}</Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 5,
              backgroundColor: "rgba(34,197,94,0.1)",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "rgba(34,197,94,0.25)",
            }}
          >
            <ShieldCheck size={11} color="#22c55e" />
            <Text style={{ fontSize: 9, fontWeight: "900", color: "#22c55e", textTransform: "uppercase", letterSpacing: 1 }}>Active</Text>
          </View>
        </View>

        {/* Main portfolio value */}
        <MotiText
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "timing", duration: 800, delay: 200 }}
          style={{ fontSize: 8, fontWeight: "900", color: `${GOLD_PALE}50`, textTransform: "uppercase", letterSpacing: 3, marginBottom: 6 }}
        >
          Total Portfolio Value
        </MotiText>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 6 }}>
          <MotiText
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 700, delay: 250, easing: Easing.out(Easing.cubic) }}
            style={{ fontSize: 40, fontWeight: "900", color: GOLD_PALE, letterSpacing: -1.5, lineHeight: 46 }}
          >
            ${formatUsd(MOCK_PORTFOLIO.totalUsd)}
          </MotiText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 22 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: "rgba(34,197,94,0.1)",
              borderRadius: 8,
            }}
          >
            <TrendingUp size={10} color="#22c55e" />
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#22c55e" }}>
              +{MOCK_PORTFOLIO.change24h}% (24h)
            </Text>
          </View>
        </View>

        {/* Cycle progress bar */}
        <View style={{ marginBottom: 22 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 7 }}>
            <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD_PALE}40`, textTransform: "uppercase", letterSpacing: 2 }}>
              Cycle Progress
            </Text>
            <Text style={{ fontSize: 8, fontWeight: "900", color: GOLD }}>
              {MOCK_PORTFOLIO.cycleProgress}%
            </Text>
          </View>
          <View style={{ height: 5, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
            <MotiView
              from={{ width: "0%" as any }}
              animate={{ width: `${MOCK_PORTFOLIO.cycleProgress}%` as any }}
              transition={{ type: "timing", duration: 1200, delay: 400, easing: Easing.out(Easing.cubic) }}
              style={{ height: "100%", backgroundColor: GOLD, borderRadius: 4 }}
            />
          </View>
        </View>

        {/* Quick stats row */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 22 }}>
          {[
            { label: "Members",      value: `${MOCK_PORTFOLIO.groupMembers}` },
            { label: "Contribution", value: `$${MOCK_PORTFOLIO.contributionAmt}` },
            { label: "Next Payout",  value: MOCK_PORTFOLIO.nextPayout },
          ].map((s, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.02)",
                borderRadius: 16,
                paddingHorizontal: 10,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.04)",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 7, fontWeight: "900", color: `${GOLD_PALE}35`, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4, textAlign: "center" }}>
                {s.label}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: GOLD_PALE, textAlign: "center" }} numberOfLines={1}>
                {s.value}
              </Text>
            </View>
          ))}
        </View>

        {/* 1-Click Gasless Contribute */}
        <AnimatePresence>
          {txPhase !== "idle" && <StatusPill phase={txPhase} />}
        </AnimatePresence>

        <TouchableOpacity
          onPress={handleContribute}
          disabled={txPhase !== "idle"}
          style={{
            paddingVertical: 18,
            backgroundColor: txPhase !== "idle" ? `${GOLD}60` : GOLD,
            borderRadius: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginTop: txPhase !== "idle" ? 12 : 0,
            shadowColor: GOLD,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.28,
            shadowRadius: 18,
            elevation: 10,
          }}
          activeOpacity={0.85}
        >
          <Zap size={16} color={OBSIDIAN} fill={OBSIDIAN} />
          <Text style={{ fontSize: 12, fontWeight: "900", color: OBSIDIAN, textTransform: "uppercase", letterSpacing: 2.5 }}>
            1-Click Contribute · ${MOCK_PORTFOLIO.contributionAmt}
          </Text>
          <View
            style={{
              paddingHorizontal: 7,
              paddingVertical: 3,
              backgroundColor: `${OBSIDIAN}30`,
              borderRadius: 6,
            }}
          >
            <Text style={{ fontSize: 8, fontWeight: "900", color: OBSIDIAN, textTransform: "uppercase", letterSpacing: 1 }}>
              Gasless
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// BREAKDOWN CARDS
// ---------------------------------------------------------------------------

function BreakdownCards() {
  const cards = [
    {
      label:  "Group Treasury",
      value:  `$${formatUsd(MOCK_PORTFOLIO.groupBalance)}`,
      sub:    "USDC locked",
      icon:   <Users size={18} color={GOLD} />,
      change: "+12.4%",
      color:  GOLD,
    },
    {
      label:  "RWA Holdings",
      value:  `$${formatUsd(MOCK_PORTFOLIO.rwaHoldings)}`,
      sub:    "Tokenized assets",
      icon:   <Landmark size={18} color="#60a5fa" />,
      change: "+187%",
      color:  "#60a5fa",
    },
    {
      label:  "Yield Earned",
      value:  `$${formatUsd(MOCK_PORTFOLIO.yieldEarned)}`,
      sub:    "Aave V3 / Morpho",
      icon:   <TrendingUp size={18} color="#22c55e" />,
      change: "+4.2% APY",
      color:  "#22c55e",
    },
  ];

  return (
    <View style={{ gap: 10, marginBottom: 16 }}>
      {cards.map((c, i) => (
        <MotiView
          key={i}
          from={{ opacity: 0, translateX: -20 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: "timing", duration: 480, delay: 100 + i * 90, easing: Easing.out(Easing.cubic) }}
        >
          <Pressable
            style={({ pressed }) => ({
              backgroundColor: pressed ? SURFACE : CARD_BG,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: `${GOLD}14`,
              padding: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
            })}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 16,
                backgroundColor: `${c.color}12`,
                borderWidth: 1,
                borderColor: `${c.color}20`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {c.icon}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD_PALE}50`, textTransform: "uppercase", letterSpacing: 2, marginBottom: 3 }}>
                {c.label}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: GOLD_PALE, letterSpacing: -0.5 }}>
                {c.value}
              </Text>
              <Text style={{ fontSize: 10, color: `${GOLD_PALE}50`, marginTop: 1 }}>{c.sub}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  backgroundColor: "rgba(34,197,94,0.1)",
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#22c55e" }}>{c.change}</Text>
              </View>
              <ChevronRight size={14} color={`${GOLD}40`} />
            </View>
          </Pressable>
        </MotiView>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ACTION HUB
// ---------------------------------------------------------------------------

interface ActionItem {
  id:     string;
  label:  string;
  sub:    string;
  icon:   React.ReactNode;
  color:  string;
  bg:     string;
}

function ActionHub() {
  const actions: ActionItem[] = [
    { id: "deposit",  label: "Deposit",   sub: "Add funds",       icon: <ArrowDownLeft  size={20} color="#22c55e" />, color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
    { id: "send",     label: "Send",      sub: "Transfer",        icon: <ArrowUpRight   size={20} color={GOLD}    />, color: GOLD,      bg: `${GOLD}14`            },
    { id: "propose",  label: "Propose",   sub: "New asset",       icon: <Landmark       size={20} color="#60a5fa" />, color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
    { id: "yield",    label: "Yield",     sub: "Harvest Aave",    icon: <Zap            size={20} color="#f59e0b" />, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  ];

  const handleAction = useCallback(async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Action", `${id} — coming soon`);
  }, []);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 500, delay: 300, easing: Easing.out(Easing.cubic) }}
      style={{
        backgroundColor: CARD_BG,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: `${GOLD}12`,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD}70`, textTransform: "uppercase", letterSpacing: 3, marginBottom: 16 }}>
        Quick Actions
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {actions.map((a, i) => (
          <TouchableOpacity
            key={a.id}
            onPress={() => handleAction(a.id)}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 8,
            }}
            activeOpacity={0.75}
          >
            <MotiView
              from={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 14, stiffness: 200, delay: 350 + i * 60 }}
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                backgroundColor: a.bg,
                borderWidth: 1,
                borderColor: `${a.color}25`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {a.icon}
            </MotiView>
            <Text style={{ fontSize: 11, fontWeight: "800", color: GOLD_PALE, textAlign: "center" }}>{a.label}</Text>
            <Text style={{ fontSize: 9, color: `${GOLD_PALE}45`, textAlign: "center", marginTop: -4 }}>{a.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// REPUTATION RING
// ---------------------------------------------------------------------------

function ReputationRing({ score }: { score: number }) {
  const r    = 28;
  const circ = 2 * Math.PI * r;
  const pct  = score / 100;
  const dash = circ * pct;
  const gap  = circ - dash;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  const tier  = score >= 80 ? "Sovereign" : score >= 60 ? "Trusted" : "Building";

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
      <View style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}>
        <Svg width={72} height={72} viewBox="0 0 72 72" style={{ transform: [{ rotate: "-90deg" }] }}>
          <SvgCircle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={5} />
          <SvgCircle
            cx={36} cy={36} r={r}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
          />
        </Svg>
        <View style={{ position: "absolute" }}>
          <Text style={{ fontSize: 16, fontWeight: "900", color, textAlign: "center", lineHeight: 18 }}>{score}</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD_PALE}50`, textTransform: "uppercase", letterSpacing: 2, marginBottom: 3 }}>
          Reputation Score
        </Text>
        <Text style={{ fontSize: 18, fontWeight: "800", color: GOLD_PALE }}>{tier}</Text>
        <Text style={{ fontSize: 11, color: `${GOLD_PALE}50`, marginTop: 2 }}>
          {score >= 80 ? "Excellent payment history" : "Keep contributing on-time"}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// TX FEED
// ---------------------------------------------------------------------------

const TX_ICONS: Record<MockTx["type"], React.ReactNode> = {
  deposit:  <ArrowDownLeft size={14} color="#22c55e" />,
  payout:   <Coins size={14} color={GOLD} />,
  yield:    <Zap size={14} color="#f59e0b" fill="#f59e0b" />,
  proposal: <Landmark size={14} color="#60a5fa" />,
};

function TxFeed() {
  return (
    <View>
      <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD}70`, textTransform: "uppercase", letterSpacing: 3, marginBottom: 14 }}>
        Transaction Ledger
      </Text>
      {MOCK_TXS.map((tx, i) => (
        <MotiView
          key={tx.id}
          from={{ opacity: 0, translateX: 16 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: "timing", duration: 400, delay: 200 + i * 70, easing: Easing.out(Easing.quad) }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            paddingVertical: 13,
            borderBottomWidth: i < MOCK_TXS.length - 1 ? 1 : 0,
            borderBottomColor: `${GOLD}08`,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              backgroundColor: `${GOLD}08`,
              borderWidth: 1,
              borderColor: `${GOLD}12`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {TX_ICONS[tx.type]}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: GOLD_PALE }} numberOfLines={1}>
              {tx.label}
            </Text>
            <Text style={{ fontSize: 10, color: `${GOLD_PALE}45`, marginTop: 2 }}>{tx.time}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {tx.amount > 0 && (
              <Text style={{ fontSize: 13, fontWeight: "800", color: tx.type === "deposit" ? "#22c55e" : GOLD }}>
                {tx.type === "deposit" ? "+" : ""}{tx.type === "payout" ? "+" : ""}${tx.amount.toLocaleString()}
              </Text>
            )}
            <View
              style={{
                marginTop: 3,
                paddingHorizontal: 6,
                paddingVertical: 2,
                backgroundColor:
                  tx.status === "confirmed" ? "rgba(34,197,94,0.1)" :
                  tx.status === "pending"   ? "rgba(59,130,246,0.1)" :
                                              "rgba(239,68,68,0.1)",
                borderRadius: 6,
              }}
            >
              <Text style={{
                fontSize: 8,
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: tx.status === "confirmed" ? "#22c55e" : tx.status === "pending" ? "#60a5fa" : "#ef4444",
              }}>
                {tx.status}
              </Text>
            </View>
          </View>
        </MotiView>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// YIELD TICKER BANNER
// ---------------------------------------------------------------------------

function YieldTicker() {
  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: "timing", duration: 600, delay: 500 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "rgba(245,158,11,0.06)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(245,158,11,0.15)",
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 16,
      }}
    >
      <Zap size={14} color="#f59e0b" fill="#f59e0b" />
      <Text style={{ fontSize: 11, fontWeight: "700", color: `${GOLD_PALE}80`, flex: 1 }}>
        <Text style={{ fontWeight: "900", color: "#f59e0b" }}>Yield Engine Active</Text>
        {" · "}Earning 4.2% APY on idle treasury via Aave V3
      </Text>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: "#22c55e",
        }}
      />
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// IDENTITY CARD
// ---------------------------------------------------------------------------

function IdentityCard() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, []);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 500, delay: 180, easing: Easing.out(Easing.cubic) }}
      style={{
        backgroundColor: CARD_BG,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: `${GOLD}15`,
        padding: 22,
        marginBottom: 16,
      }}
    >
      <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD}70`, textTransform: "uppercase", letterSpacing: 3, marginBottom: 16 }}>
        Your Identity
      </Text>

      <ReputationRing score={MOCK_PORTFOLIO.reputationScore} />

      {/* Smart account address */}
      <TouchableOpacity
        onPress={handleCopy}
        style={{
          marginTop: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: OBSIDIAN,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: `${GOLD}10`,
        }}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 11, color: `${GOLD_PALE}50`, fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace" }}>
          {shortenAddr(MOCK_PORTFOLIO.smartAccount)}
        </Text>
        <AnimatePresence>
          {copied ? (
            <MotiView key="check" from={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <CheckCircle2 size={13} color="#22c55e" />
            </MotiView>
          ) : (
            <MotiView key="copy" from={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Copy size={13} color={`${GOLD}50`} />
            </MotiView>
          )}
        </AnimatePresence>
      </TouchableOpacity>

      {/* Badges row */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: `${GOLD}10`, borderRadius: 10, borderWidth: 1, borderColor: `${GOLD}20` }}>
          <Star size={10} color={GOLD} fill={GOLD} />
          <Text style={{ fontSize: 9, fontWeight: "800", color: GOLD, textTransform: "uppercase", letterSpacing: 1 }}>Trusted Member</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "rgba(0,82,255,0.1)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(0,82,255,0.2)" }}>
          <Globe size={10} color="#4d8fff" />
          <Text style={{ fontSize: 9, fontWeight: "800", color: "#4d8fff", textTransform: "uppercase", letterSpacing: 1 }}>Base L2</Text>
        </View>
      </View>
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// DASHBOARD SCREEN
// ---------------------------------------------------------------------------

function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1400);
  }, []);

  const handleContributeSuccess = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: OBSIDIAN }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={GOLD}
          colors={[GOLD]}
        />
      }
    >
      {/* Page title */}
      <MotiView
        from={{ opacity: 0, translateY: -10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 500 }}
        style={{ paddingTop: 12, paddingBottom: 20 }}
      >
        <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD}70`, textTransform: "uppercase", letterSpacing: 4, marginBottom: 4 }}>
          KULA Protocol
        </Text>
        <Text style={{ fontSize: 28, fontWeight: "900", color: GOLD_PALE, letterSpacing: -0.8 }}>
          Sovereign Vault
        </Text>
      </MotiView>

      {/* Yield ticker */}
      <YieldTicker />

      {/* Portfolio hero */}
      <PortfolioHero onContribute={handleContributeSuccess} />

      {/* Action hub */}
      <ActionHub />

      {/* Breakdown cards */}
      <BreakdownCards />

      {/* Identity card */}
      <IdentityCard />

      {/* TX Feed */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 500, delay: 400, easing: Easing.out(Easing.cubic) }}
        style={{
          backgroundColor: CARD_BG,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: `${GOLD}12`,
          padding: 22,
          marginBottom: 8,
        }}
      >
        <TxFeed />
      </MotiView>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// CIRCLE SCREEN (stub)
// ---------------------------------------------------------------------------

function CircleScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: OBSIDIAN, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: `${GOLD}10`, borderWidth: 1, borderColor: `${GOLD}20`, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <Users size={32} color={`${GOLD}70`} />
      </View>
      <Text style={{ fontSize: 22, fontWeight: "800", color: GOLD_PALE, marginBottom: 10 }}>My Circle</Text>
      <Text style={{ fontSize: 13, color: `${GOLD_PALE}45`, textAlign: "center", lineHeight: 20 }}>
        Member directory, voting hall, and group chat are coming in the next sprint.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// IDENTITY SCREEN (stub)
// ---------------------------------------------------------------------------

function IdentityScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: OBSIDIAN }} contentContainerStyle={{ padding: 16 }}>
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: "timing", duration: 500 }} style={{ paddingTop: 12, paddingBottom: 20 }}>
        <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD}70`, textTransform: "uppercase", letterSpacing: 4, marginBottom: 4 }}>On-Chain Identity</Text>
        <Text style={{ fontSize: 26, fontWeight: "900", color: GOLD_PALE, letterSpacing: -0.5 }}>Identity Hub</Text>
      </MotiView>
      <IdentityCard />
      <MotiView
        from={{ opacity: 0, translateY: 16 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 480, delay: 100 }}
        style={{ backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: `${GOLD}12`, padding: 20 }}
      >
        <Text style={{ fontSize: 8, fontWeight: "900", color: `${GOLD}70`, textTransform: "uppercase", letterSpacing: 3, marginBottom: 16 }}>
          Achievement Badges
        </Text>
        {[
          { label: "Founding Member",   desc: "Joined KULA in the genesis cohort",              icon: <Star size={16} color={GOLD} fill={GOLD} /> },
          { label: "Zero-Delay Payer",  desc: "12 consecutive on-time contributions",           icon: <CheckCircle2 size={16} color="#22c55e" /> },
          { label: "Oracle Voter",      desc: "Participated in 3+ asset verifications",         icon: <BadgeCheck size={16} color="#60a5fa" /> },
          { label: "Gasless Pioneer",   desc: "100% of transactions via EIP-4337 Smart Account",icon: <Zap size={16} color="#f59e0b" fill="#f59e0b" /> },
        ].map((b, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: `${GOLD}08` }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: `${GOLD}08`, borderWidth: 1, borderColor: `${GOLD}14`, alignItems: "center", justifyContent: "center" }}>
              {b.icon}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: GOLD_PALE }}>{b.label}</Text>
              <Text style={{ fontSize: 10, color: `${GOLD_PALE}50`, marginTop: 2 }}>{b.desc}</Text>
            </View>
          </View>
        ))}
      </MotiView>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// BOTTOM TAB BAR
// ---------------------------------------------------------------------------

type TabId = "dashboard" | "marketplace" | "circle" | "identity";

interface Tab {
  id:    TabId;
  label: string;
  icon:  (active: boolean) => React.ReactNode;
}

const TABS: Tab[] = [
  {
    id:    "dashboard",
    label: "Vault",
    icon:  (a) => <Home size={22} color={a ? GOLD : `${GOLD_PALE}40`} />,
  },
  {
    id:    "marketplace",
    label: "Market",
    icon:  (a) => <Store size={22} color={a ? GOLD : `${GOLD_PALE}40`} />,
  },
  {
    id:    "circle",
    label: "Circle",
    icon:  (a) => <Users size={22} color={a ? GOLD : `${GOLD_PALE}40`} />,
  },
  {
    id:    "identity",
    label: "Identity",
    icon:  (a) => <UserCircle2 size={22} color={a ? GOLD : `${GOLD_PALE}40`} />,
  },
];

function BottomTabBar({
  active,
  onPress,
}: {
  active:  TabId;
  onPress: (id: TabId) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: CARD_DEEP,
        borderTopWidth: 1,
        borderTopColor: `${GOLD}14`,
        flexDirection: "row",
        paddingBottom: insets.bottom + 4,
        paddingTop: 10,
        paddingHorizontal: 8,
      }}
    >
      {TABS.map(tab => {
        const isActive = active === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={async () => {
              await Haptics.selectionAsync();
              onPress(tab.id);
            }}
            style={{ flex: 1, alignItems: "center", gap: 4 }}
            activeOpacity={0.75}
          >
            <View style={{ position: "relative", alignItems: "center" }}>
              {isActive && (
                <MotiView
                  from={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 14, stiffness: 220 }}
                  style={{
                    position: "absolute",
                    top: -6,
                    width: 36,
                    height: 36,
                    borderRadius: 14,
                    backgroundColor: `${GOLD}12`,
                  }}
                />
              )}
              <View style={{ zIndex: 1, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                {tab.icon(isActive)}
              </View>
            </View>
            <Text
              style={{
                fontSize: 10,
                fontWeight: isActive ? "900" : "600",
                color: isActive ? GOLD : `${GOLD_PALE}40`,
                letterSpacing: isActive ? 0.5 : 0,
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ROOT APP
// ---------------------------------------------------------------------------

function KulaApp() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const insets = useSafeAreaInsets();

  const handleTabPress = useCallback((id: TabId) => {
    setActiveTab(id);
  }, []);

  const screens: Record<TabId, React.ReactNode> = {
    dashboard:   <DashboardScreen />,
    marketplace: <MobileMarketplace embedded />,
    circle:      <CircleScreen />,
    identity:    <IdentityScreen />,
  };

  return (
    <View style={{ flex: 1, backgroundColor: OBSIDIAN }}>
      <StatusBar barStyle="light-content" backgroundColor={OBSIDIAN} />

      {/* Safe area top padding */}
      <View style={{ height: insets.top, backgroundColor: OBSIDIAN }} />

      {/* Tab content with crossfade */}
      <View style={{ flex: 1 }}>
        <AnimatePresence exitBeforeEnter>
          <MotiView
            key={activeTab}
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: -6 }}
            transition={{ type: "timing", duration: 280, easing: Easing.out(Easing.quad) }}
            style={{ flex: 1 }}
          >
            {screens[activeTab]}
          </MotiView>
        </AnimatePresence>
      </View>

      {/* Bottom tab bar */}
      <BottomTabBar active={activeTab} onPress={handleTabPress} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// EXPORT WITH PROVIDERS
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <SafeAreaProvider>
      <KulaApp />
    </SafeAreaProvider>
  );
}
