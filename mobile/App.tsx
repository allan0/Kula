import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, StatusBar } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { 
  Users, Landmark, Receipt, ShieldCheck, 
  Trophy, MessageCircle, Map, Send, 
  Star, Wallet, Globe, TrendingUp, X 
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const MobileModal = ({ visible, title, onClose, children }: any) => (
  <AnimatePresence>
    {visible && (
      <MotiView
        from={{ opacity: 0, translateY: 300 }}
        animate={{ opacity: 1, translateY: 0 }}
        exit={{ opacity: 0, translateY: 300 }}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 }}
      >
        <View style={{ backgroundColor: '#1B1212', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 30, borderTopWidth: 1, borderTopColor: '#D4AF37' }}>
          <View style={{ width: 40, height: 4, backgroundColor: 'rgba(212,175,55,0.2)', borderRadius: 10, alignSelf: 'center', marginBottom: 20 }} />
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#D4AF37', marginBottom: 20, letterSpacing: 2 }}>{title}</Text>
          {children}
          <TouchableOpacity onPress={onClose} style={{ marginTop: 30, backgroundColor: '#D4AF37', padding: 15, borderRadius: 15, alignItems: 'center' }}>
            <Text style={{ fontWeight: '900', color: '#0F0F0F', letterSpacing: 1 }}>CLOSE VAULT</Text>
          </TouchableOpacity>
        </View>
      </MotiView>
    )}
  </AnimatePresence>
);

export default function App() {
  const [modalType, setModalType] = useState(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F0F' }}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {/* HEADER */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
          <View>
            <Text style={{ color: '#D4AF37', fontSize: 10, fontWeight: '900', letterSpacing: 4 }}>ELITE PORTAL</Text>
            <Text style={{ color: '#F3E5AB', fontSize: 36, fontWeight: 'bold' }}>KULA</Text>
          </View>
          <TouchableOpacity style={{ padding: 12, backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: 50, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' }}>
            <Wallet color="#D4AF37" size={24} />
          </TouchableOpacity>
        </View>

        {/* MAIN SAVINGS CARD */}
        <LinearGradient
          colors={['#3E2723', '#1B1212']}
          style={{ padding: 30, borderRadius: 40, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', marginBottom: 30 }}
        >
          <Text style={{ color: '#D4AF37', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 10 }}>PORTFOLIO VALUE</Text>
          <Text style={{ color: '#F3E5AB', fontSize: 48, fontWeight: 'bold', marginBottom: 20 }}>$142,500</Text>
          
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: '#D4AF37', padding: 15, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ fontWeight: '900', color: '#0F0F0F' }}>CONTRIBUTE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' }}>
              <Text style={{ fontWeight: '900', color: '#D4AF37' }}>WITHDRAW</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ACTION HUB */}
        <Text style={{ color: '#D4AF37', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 20 }}>ACTION HUB</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}>
          {[
            { id: 'roadmap', icon: <Map color="#D4AF37" size={20}/>, label: 'Roadmap' },
            { id: 'rank', icon: <Trophy color="#D4AF37" size={20}/>, label: 'Rankings' },
            { id: 'chat', icon: <MessageCircle color="#D4AF37" size={20}/>, label: 'Chat' },
          ].map((item) => (
            <TouchableOpacity 
              key={item.id} 
              onPress={() => setModalType(item.id)}
              style={{ width: '30%', backgroundColor: '#1B1212', padding: 15, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' }}
            >
              {item.icon}
              <Text style={{ color: '#F3E5AB', fontSize: 8, marginTop: 8, fontWeight: 'bold' }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* FOOTER TAB BAR */}
      <View style={{ height: 90, backgroundColor: '#1B1212', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.1)' }}>
        <Users color="#D4AF37" size={24} />
        <Globe color="rgba(212,175,55,0.3)" size={24} />
        <Receipt color="rgba(212,175,55,0.3)" size={24} />
        <ShieldCheck color="rgba(212,175,55,0.3)" size={24} />
      </View>

      <MobileModal visible={modalType === 'roadmap'} title="ROADMAP" onClose={() => setModalType(null)}>
        <Text style={{ color: 'rgba(243,229,171,0.6)', lineHeight: 24 }}>KULA Phase 3 is launching. Real-world property tokenization is now active on the Base network.</Text>
      </MobileModal>
    </SafeAreaView>
  );
}
