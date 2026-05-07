"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Users, Landmark, ShieldAlert, Sparkles, Hash } from "lucide-react";

const channels = [
  { id: 'general', label: 'General', icon: <Users size={16} /> },
  { id: 'assets', label: 'Asset Board', icon: <Landmark size={16} /> },
  { id: 'urgent', label: 'Priority', icon: <ShieldAlert size={16} /> },
];

const initialMessages = [
  { 
    id: 1, 
    user: "Treasurer", 
    role: "Admin", 
    msg: "The Kitengela deed has been uploaded and is now open for review. IPFS hash in Asset Vault.", 
    time: "10:24 AM", 
    type: "system" 
  },
  { 
    id: 2, 
    user: "Member #04", 
    role: "Elite", 
    msg: "Inspected the survey map. Everything looks clean. Ready to vote.", 
    time: "11:05 AM", 
    type: "user" 
  },
  { 
    id: 3, 
    user: "Kula Oracle", 
    role: "AI", 
    msg: "New public asset listed: Mombasa Beachfront Villa. Trust score rising rapidly.", 
    time: "11:45 AM", 
    type: "bot" 
  },
];

export default function GroupChatWall() {
  const [activeChannel, setActiveChannel] = useState('general');
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);

  const sendMessage = () => {
    if (!message.trim()) return;

    const newMsg = {
      id: Date.now(),
      user: "You",
      role: "Member",
      msg: message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: "user"
    };

    setMessages([...messages, newMsg]);
    setMessage("");

    // Simulate reply
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        user: "Member #07",
        role: "Contributor",
        msg: "Agreed. Strong proposal.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: "user"
      }]);
    }, 800);
  };

  return (
    <div className="glass-card rounded-[3rem] h-[620px] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[#D4AF37]/10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-[#D4AF37]/10 rounded-2xl flex items-center justify-center">
            <Hash className="text-[#D4AF37]" size={20} />
          </div>
          <div>
            <h3 className="font-semibold">Circle Intelligence</h3>
            <p className="text-xs text-[#F3E5AB]/60">12 members online</p>
          </div>
        </div>
        <Sparkles className="text-[#D4AF37]" size={20} />
      </div>

      {/* Channels Sidebar */}
      <div className="flex h-full">
        <div className="w-56 border-r border-[#D4AF37]/10 p-6 hidden md:flex flex-col">
          <p className="uppercase text-xs tracking-widest text-[#D4AF37]/50 mb-6">CHANNELS</p>
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl mb-2 transition-all text-sm ${
                activeChannel === ch.id 
                  ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30' 
                  : 'hover:bg-white/5 text-[#F3E5AB]/70'
              }`}
            >
              {ch.icon}
              <span className="font-medium">{ch.label}</span>
            </button>
          ))}
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scroll">
            {messages.map((m) => (
              <motion.div 
                key={m.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4"
              >
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-transparent flex-shrink-0 flex items-center justify-center mt-1">
                  {m.type === 'bot' ? '🤖' : '👤'}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="font-semibold text-sm">{m.user}</span>
                    <span className="text-[10px] px-3 py-0.5 bg-white/5 rounded-full text-[#D4AF37]/70">{m.role}</span>
                    <span className="text-xs text-[#F3E5AB]/40 font-mono">{m.time}</span>
                  </div>
                  
                  <div className={`text-sm leading-relaxed px-5 py-4 rounded-3xl max-w-[85%] ${
                    m.type === 'system' 
                      ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/20 italic' 
                      : m.type === 'bot' 
                      ? 'bg-[#1B1212] border border-[#229ED9]/30' 
                      : 'bg-white/5'
                  }`}>
                    {m.msg}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Message Input */}
          <div className="p-6 border-t border-[#D4AF37]/10">
            <div className="relative">
              <input 
                type="text" 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Share your thoughts with the circle..." 
                className="w-full bg-[#1B1212] border border-[#D4AF37]/20 focus:border-[#D4AF37] rounded-3xl py-5 px-8 text-sm outline-none transition-all"
              />
              <button 
                onClick={sendMessage}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-4 bg-[#D4AF37] text-black rounded-2xl hover:scale-110 transition-transform"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
