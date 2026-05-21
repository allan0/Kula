// =============================================================================
// FILE: mobile/src/components/MemberDirectory.tsx
// PURPOSE: Phase 5 – React Native conversion of the web MemberDirectory
//
// CHANGES FROM WEB VERSION:
//   - All <div> → <View>
//   - All <span> / <p> / <h*> → <Text>
//   - All <img> → <Image> (expo-image for caching)
//   - All <button> → <TouchableOpacity> / <Pressable>
//   - All <a> → <Pressable> + Linking.openURL
//   - CSS className strings → NativeWind v4 className (uses Tailwind syntax)
//   - Hover/active states → NativeWind's active: / pressed: variants
//   - motion.div animations → react-native Animated or moti (Framer Motion RN)
//   - Scrollable list → <FlatList> for performance on large member sets
//   - No window.* or document.* calls
//
// DEPENDENCIES (add to mobile/package.json):
//   "nativewind": "^4.x"
//   "moti": "^0.x"          (Framer Motion for React Native)
//   "expo-image": "~2.x"    (cached image loading)
//   "@expo/vector-icons": "^14.x"
// =============================================================================

import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Linking,
    TextInput,
    ListRenderItemInfo,
} from "react-native";
import { Image } from "expo-image";
import { MotiView } from "moti";
import { Feather } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface Member {
    id:             string;
    displayName:    string;
    shortAddress:   string;
    fullAddress:    string;
    reputationScore: number;
    reputationTier: "Elite" | "Trusted" | "Active" | "New" | "Probation";
    platform:       "USSD" | "WEB" | "TELEGRAM";
    avatarUri?:     string;
    isCurrentRecipient?: boolean;
}

// ---------------------------------------------------------------------------
// MOCK DATA (replace with real API fetch in production)
// ---------------------------------------------------------------------------

const MOCK_MEMBERS: Member[] = [
    {
        id:             "1",
        displayName:    "Wanjiku M.",
        shortAddress:   "0xA1B2...3C4D",
        fullAddress:    "0xA1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2",
        reputationScore: 94,
        reputationTier: "Elite",
        platform:       "TELEGRAM",
        isCurrentRecipient: true,
    },
    {
        id:             "2",
        displayName:    "Kamau T.",
        shortAddress:   "0xD5E6...7F8A",
        fullAddress:    "0xD5E67F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4",
        reputationScore: 81,
        reputationTier: "Trusted",
        platform:       "WEB",
    },
    {
        id:             "3",
        displayName:    "+254712345678",
        shortAddress:   "0x9B0C...1D2E",
        fullAddress:    "0x9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F6A7B8",
        reputationScore: 63,
        reputationTier: "Active",
        platform:       "USSD",
    },
    {
        id:             "4",
        displayName:    "Achieng O.",
        shortAddress:   "0x3F4A...5B6C",
        fullAddress:    "0x3F4A5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2",
        reputationScore: 50,
        reputationTier: "New",
        platform:       "WEB",
    },
];

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function getPlatformIcon(platform: Member["platform"]) {
    switch (platform) {
        case "TELEGRAM": return { name: "send" as const, color: "#229ED9" };
        case "USSD":     return { name: "phone" as const, color: "#22C55E" };
        case "WEB":      return { name: "globe" as const, color: "#D4AF37" };
    }
}

function getTierColor(tier: Member["reputationTier"]): string {
    switch (tier) {
        case "Elite":     return "text-yellow-400";
        case "Trusted":   return "text-green-400";
        case "Active":    return "text-blue-400";
        case "New":       return "text-zinc-400";
        case "Probation": return "text-red-400";
        default:          return "text-zinc-400";
    }
}

function getScoreBarColor(score: number): string {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-400";
    if (score >= 40) return "bg-orange-400";
    return "bg-red-500";
}

// ---------------------------------------------------------------------------
// SUB-COMPONENT: Member Row
// ---------------------------------------------------------------------------

function MemberRow({ item, index }: { item: Member; index: number }) {
    const platformIcon = getPlatformIcon(item.platform);
    const tierClass    = getTierColor(item.reputationTier);

    const openExplorer = useCallback(() => {
        Linking.openURL(`https://sepolia.basescan.org/address/${item.fullAddress}`);
    }, [item.fullAddress]);

    return (
        <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 300, delay: index * 60 }}
            className="flex-row items-center px-4 py-4 border-b border-yellow-400/10"
        >
            {/* Avatar / Initial */}
            <View className="w-11 h-11 rounded-2xl bg-yellow-400/10 items-center justify-center mr-4 flex-shrink-0 overflow-hidden">
                {item.avatarUri ? (
                    <Image
                        source={{ uri: item.avatarUri }}
                        style={{ width: 44, height: 44, borderRadius: 14 }}
                        contentFit="cover"
                    />
                ) : (
                    <Text className="text-yellow-400 font-bold text-base">
                        {item.displayName.charAt(0).toUpperCase()}
                    </Text>
                )}

                {item.isCurrentRecipient && (
                    <View className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full items-center justify-center">
                        <Text className="text-black text-[8px] font-black">★</Text>
                    </View>
                )}
            </View>

            {/* Info */}
            <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-2">
                    <Text
                        className="text-white font-semibold text-sm"
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {item.displayName}
                    </Text>

                    {item.isCurrentRecipient && (
                        <View className="px-2 py-0.5 bg-yellow-400/15 rounded-full border border-yellow-400/30">
                            <Text className="text-yellow-400 text-[10px] font-black tracking-wider">NEXT PAYOUT</Text>
                        </View>
                    )}
                </View>

                {/* Address + explorer link */}
                <TouchableOpacity onPress={openExplorer} activeOpacity={0.6}>
                    <Text className="text-zinc-500 font-mono text-xs mt-0.5">
                        {item.shortAddress}
                    </Text>
                </TouchableOpacity>

                {/* Reputation bar */}
                <View className="flex-row items-center gap-2 mt-2">
                    <View className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <View
                            className={`h-full rounded-full ${getScoreBarColor(item.reputationScore)}`}
                            style={{ width: `${item.reputationScore}%` }}
                        />
                    </View>
                    <Text className={`text-xs font-bold w-8 text-right ${tierClass}`}>
                        {item.reputationScore}
                    </Text>
                </View>
            </View>

            {/* Right side: Platform + tier */}
            <View className="items-end ml-3 gap-1">
                <Feather
                    name={platformIcon.name}
                    size={14}
                    color={platformIcon.color}
                />
                <Text className={`text-[10px] font-black uppercase tracking-wider ${tierClass}`}>
                    {item.reputationTier}
                </Text>
            </View>
        </MotiView>
    );
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT: MemberDirectory
// ---------------------------------------------------------------------------

export default function MemberDirectory() {
    const [searchQuery, setSearchQuery] = useState("");
    const [filter,      setFilter]      = useState<"ALL" | "USSD" | "WEB" | "TELEGRAM">("ALL");

    const filtered = MOCK_MEMBERS.filter(m => {
        const matchesSearch =
            searchQuery === "" ||
            m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.shortAddress.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesPlatform = filter === "ALL" || m.platform === filter;

        return matchesSearch && matchesPlatform;
    });

    const renderItem = useCallback(
        ({ item, index }: ListRenderItemInfo<Member>) => (
            <MemberRow item={item} index={index} />
        ),
        [],
    );

    const keyExtractor = useCallback((item: Member) => item.id, []);

    const FILTER_OPTIONS: Array<"ALL" | "USSD" | "WEB" | "TELEGRAM"> = ["ALL", "TELEGRAM", "WEB", "USSD"];

    return (
        <View className="flex-1 bg-black/60 rounded-[2.5rem] overflow-hidden border border-yellow-400/10">
            {/* Header */}
            <View className="px-5 pt-5 pb-3">
                <View className="flex-row items-center justify-between mb-4">
                    <View>
                        <Text className="text-yellow-400 text-[10px] uppercase tracking-[0.35em] font-black">
                            SOVEREIGN CIRCLE
                        </Text>
                        <Text className="text-white text-xl font-semibold mt-0.5">
                            Members
                        </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                        <View className="w-2 h-2 rounded-full bg-green-500" />
                        <Text className="text-zinc-400 text-xs">{MOCK_MEMBERS.length} active</Text>
                    </View>
                </View>

                {/* Search */}
                <View className="flex-row items-center bg-white/5 border border-white/10 rounded-2xl px-4 py-3 mb-3">
                    <Feather name="search" size={14} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 text-white text-sm ml-2"
                        placeholder="Search members..."
                        placeholderTextColor="#6B7280"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.6}>
                            <Feather name="x" size={14} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Platform filter chips */}
                <View className="flex-row gap-2">
                    {FILTER_OPTIONS.map(opt => (
                        <TouchableOpacity
                            key={opt}
                            onPress={() => setFilter(opt)}
                            activeOpacity={0.7}
                            className={[
                                "px-3 py-1.5 rounded-full border text-xs font-bold",
                                filter === opt
                                    ? "bg-yellow-400/15 border-yellow-400/40 text-yellow-400"
                                    : "border-white/10 text-zinc-500",
                            ].join(" ")}
                        >
                            <Text
                                className={
                                    filter === opt
                                        ? "text-yellow-400 text-xs font-black tracking-wider"
                                        : "text-zinc-500 text-xs"
                                }
                            >
                                {opt}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* List */}
            {filtered.length === 0 ? (
                <View className="flex-1 items-center justify-center py-12">
                    <Feather name="users" size={32} color="#374151" />
                    <Text className="text-zinc-600 text-sm mt-3">No members match your search</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                />
            )}

            {/* Footer */}
            <View className="px-5 py-4 border-t border-yellow-400/10 flex-row items-center justify-between">
                <Text className="text-zinc-600 text-xs">
                    {filtered.length} of {MOCK_MEMBERS.length} members
                </Text>
                <View className="flex-row items-center gap-1.5">
                    <View className="w-1.5 h-1.5 rounded-full bg-yellow-400 opacity-60" />
                    <Text className="text-zinc-600 text-xs">Live sync</Text>
                </View>
            </View>
        </View>
    );
}
