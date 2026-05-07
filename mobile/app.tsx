import "./global.css"; // Essential for NativeWind
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, StatusBar, StyleSheet } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { 
  Users, Landmark, Receipt, ShieldCheck, 
  Trophy, MessageCircle, Map, Send, 
  Star, PlusCircle, Wallet, Globe, TrendingUp, X
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// --- LUXURY MODAL COMPONENT ---
const MobileModal = ({ visible, title, onClose, children }: any) => (
  <AnimatePresence>
    {visible && (
      <View style={StyleSheet.absoluteFill} className="z-50 justify-end">
        <motion.View 
          from={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/90" 
        />
        <MotiView
          from={{ translateY: height }}
          animate={{ translateY: 0 }}
          exit={{ translateY: height }}
          transition={{ type: 'spring', damping: 20 }}
          className="bg-[#1B1212] rounded-t-[3.5rem] p-8 border-t border-gold/30 h-[85%]"
        >
          <View className="w-12 h-1 bg-gold/20 rounded-full self-center mb-6" />
          <View className="flex-row justify-between items-center mb-8">
            <Text className="text-2xl font-bold text-gold uppercase tracking-[0.2em]">{title}</Text>
            <TouchableOpacity onPress={onClose} className="p-2 bg-gold/5 rounded-full">
               <X color="#D4AF37" size={20} />
            </TouchableOpacity>
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>

          <TouchableOpacity 
            onPress={onClose}
            className="mt-6 py-5 bg-gold rounded-2xl items-center shadow-[0_10px_20px_rgba(212,175,55,0.2)]"
          >
            <Text className="font-black text-xs uppercase tracking-[0.3em] text-[#0F0F0F]">Close Vault</Text>
          </TouchableOpacity>
        </MotiView>
      </View>
    )}
  </AnimatePresence>
);

export default function App() {
  const [modalType, setModalType] = useState<string | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-[#0F0F0F]">
      <StatusBar barStyle="light-content" />
      
      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
        
        {/* 1. HEADER */}
        <View className="flex-row justify-between items-center mb-10">
          <View>
            <Text className="text-gold uppercase font-black text-[10px] tracking-[0.4em] mb-1">Vault Member</Text>
            <Text className="text-5xl text-gold-light font-bold tracking-tighter">KULA</Text>
          </View>
          <TouchableOpacity className="p-4 bg-gold/10 rounded-full border border-gold/20 shadow-2xl">
            <Wallet color="#D4AF37" size={24} />
          </TouchableOpacity>
        </View>

        {/* 2. $KULA REWARD BAR */}
        <TouchableOpacity 
          onPress={() => setModalType('rewards')}
          className="flex-row justify-between items-center p-4 luxury-border rounded-3xl mb-8 bg-gold/5"
        >
          <View className="flex-row items-center space-x-3">
             <View className="bg-gold p-2 rounded-lg"><Star color="#0F0F0F" size={14} fill="#0F0F0F"/></View>
             <Text className="text-gold-light font-bold text-xs ml-3 uppercase tracking-widest">850.50 KULA Earned</Text>
          </View>
          <TrendingUp color="#D4AF37" size={16} />
        </TouchableOpacity>

        {/* 3. MAIN PORTFOLIO CARD */}
        <LinearGradient
          colors={['#3E2723', '#1B1212']}
          className="p-10 rounded-[3rem] border border-gold/30 mb-8 relative overflow-hidden"
        >
          <Text className="text-gold font-black text-[10px] uppercase tracking-[0.3em] mb-4">Total Group Wealth</Text>
          <Text className="text-6xl text-gold-light font-bold mb-8 tracking-tighter leading-none">$142,500</Text>
          
          <View className="flex-row space-x-4">
            <TouchableOpacity className="flex-1 bg-gold py-5 rounded-2xl items-center shadow-lg">
              <Text className="font-black text-xs uppercase tracking-widest text-[#0F0F0F]">Contribute</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* 4. ACTION HUB */}
        <Text className="text-gold/40 font-black text-[10px] uppercase tracking-[0.4em] mb-6">Executive Hub</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-10 h-24">
          {[
            { id: 'roadmap', icon: <Map color="#D4AF37" size={20}/>, label: 'Roadmap' },
            { id: 'leaderboard', icon: <Trophy color="#D4AF37" size={20}/>, label: 'Ranks' },
            { id: 'chat', icon: <MessageCircle color="#D4AF37" size={20}/>, label: 'Chat' },
            { id: 'telegram', icon: <Send color="#D4AF37" size={20}/>, label: 'Sync' },
          ].map((item: any) => (
            <TouchableOpacity 
              key={item.id}
              onPress={() => setModalType(item.id)}
              className="mr-4 w-24 h-24 bg-[#1B1212] rounded-[2rem] border border-gold/10 items-center justify-center shadow-xl"
            >
              {item.icon}
              <Text className="text-gold-light font-bold text-[8px] uppercase mt-2 tracking-widest">{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 5. ASSET TILES */}
        <View className="mb-20">
          <Text className="text-gold/40 font-black text-[10px] uppercase tracking-[0.4em] mb-6">Verified Acquisitions</Text>
          <View className="flex-row justify-between flex-wrap">
             {[1, 2].map((i) => (
               <View key={i} className="w-[48%] bg-[#1B1212] rounded-3xl border border-gold/5 p-4 mb-4">
                  <View className="h-24 bg-earth/40 rounded-2xl mb-4 items-center justify-center">
                     <Landmark color="#D4AF37" size={24} opacity={0.2} />
                  </View>
                  <Text className="text-gold-light font-bold text-xs mb-1">Kitengela 5A</Text>
                  <Text className="text-gold font-black text-[10px]">45k USDC</Text>
               </View>
             ))}
          </View>
        </View>

      </ScrollView>

      {/* MODALS */}
      <MobileModal visible={modalType === 'telegram'} title="TELEGRAM SYNC" onClose={() => setModalType(null)}>
        <View className="items-center py-10 bg-gold/5 rounded-3xl border border-gold/10">
           <Send color="#229ED9" size={48} />
           <Text className="text-gold-light font-serif text-xl mt-6">Connect Group Intel</Text>
           <Text className="text-gold-light/40 text-center px-6 mt-4 text-xs leading-relaxed">
             Scrape your circle's private telegram history to build collective trust scores and verify goals.
           </Text>
           <TouchableOpacity className="mt-8 px-10 py-4 bg-[#229ED9] rounded-2xl">
              <Text className="text-white font-black uppercase text-[10px] tracking-widest">Connect @KulaBot</Text>
           </TouchableOpacity>
        </View>
      </MobileModal>

      <MobileModal visible={modalType === 'leaderboard'} title="GLOBAL RANKS" onClose={() => setModalType(null)}>
         {[1, 2, 3].map((i) => (
           <View key={i} className="p-5 luxury-border rounded-2xl flex-row justify-between items-center mb-3">
              <Text className="text-gold/40 font-serif text-2xl">0{i}</Text>
              <Text className="text-gold-light font-bold text-xs uppercase tracking-widest">Nairobi Elites</Text>
              <Text className="text-gold font-black">99.8%</Text>
           </View>
         ))}
      </MobileModal>

    </SafeAreaView>
  );
}
