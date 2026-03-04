"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Users, Landmark, ShieldAlert, Sparkles } from "lucide-react";

const channels = [
  { id: 'general', label: 'Circle General', icon: <Users size={14} /> },
  { id: 'assets', label: 'Property Board', icon: <Landmark size={14} /> },
  { id: 'urgent', label: 'Priority Alerts', icon: <ShieldAlert size={14} /> },
];

const initialMessages = [
  { id: 1, user: "Treasurer", role: "Elite", msg: "The 5-acre Kitengela deed has been verified by the Kula Oracle. Please review the IPFS hash in the Assets tab.", time: "10:24 AM", type: "system" },
  { id: 2, user: "Member #04", role: "Contributor", msg: "I've inspected the survey map. Alignment looks perfect for our 2026 goal.", time: "11:05 AM", type: "user" },
  { id: 3, user: "KulaBot", role: "AI Audit", msg: "New Public Asset posted: 'Mombasa Beach Villa'. Community trust score is rising.", time: "11:45 AM", type: "bot" },
];

export default function GroupChatWall() {
  const [activeChannel, setActiveChannel] = useState('general');
  const [message, setMessage] = useState("");

  return (
    <div className="flex h-[550px] gap-6">
      {/* 1. CHANNEL SIDEBAR */}
      <div className="w-48 flex flex-col gap-2 border-r border-gold/10 pr-4">
        <p className="text-[9px] text-gold/40 uppercase font-black tracking-widest mb-4">Channels</p>
        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setActiveChannel(ch.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeChannel === ch.id ? 'bg-gold/10 text-gold border border-gold/20' : 'text-gold-light/40 hover:text-gold-light'
            }`}
          >
            {ch.icon}
            <span className="text-[10px] font-bold uppercase tracking-tighter">{ch.label}</span>
          </button>
        ))}
      </div>

      {/* 2. CHAT AREA */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-2">
          {initialMessages.map((m) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={m.id} 
              className={`flex flex-col ${m.user === 'Treasurer' ? 'items-start' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1 ml-2">
                <span className="text-[8px] font-black text-gold uppercase tracking-widest">{m.user}</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-gold/5 border border-gold/20 text-gold/60 uppercase">{m.role}</span>
                <span className="text-[8px] text-gold-light/20">{m.time}</span>
              </div>
              <div className={`p-4 rounded-2xl max-w-[90%] border ${
                m.type === 'system' ? 'bg-gold/5 border-gold/20 italic text-gold-light/80' : 
                m.type === 'bot' ? 'bg-earth border-gold/10 text-gold-light/60' : 
                'bg-earth-dark/60 border-gold/5 text-gold-light/60'
              } text-xs leading-relaxed shadow-lg`}>
                {m.msg}
              </div>
            </motion.div>
          ))}
        </div>

        {/* 3. INPUT AREA */}
        <div className="mt-6 relative group">
          <div className="absolute inset-0 bg-gold/5 blur-xl group-focus-within:bg-gold/10 transition-all rounded-2xl" />
          <div className="relative flex items-center bg-earth-dark border border-gold/20 rounded-2xl p-2 focus-within:border-gold/50 transition-all">
            <div className="p-2 text-gold/40">
              <Sparkles size={16} />
            </div>
            <input 
              type="text" 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Contribute to the discussion..." 
              className="flex-1 bg-transparent border-none outline-none text-gold-light text-xs py-2 px-2"
            />
            <button className="p-3 bg-gold text-earth-dark rounded-xl hover:scale-105 transition-transform shadow-lg shadow-gold/20">
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
