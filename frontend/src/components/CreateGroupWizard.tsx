"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWriteContract } from 'wagmi';
import { Landmark, Car, Users, Zap, Calendar, DollarSign, Send, ShieldCheck } from "lucide-react";

export default function CreateGroupWizard({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    goalType: "Real Estate",
    amount: "1000",
    members: "12",
    interval: "Monthly",
    telegram: ""
  });

  const { writeContract } = useWriteContract();

  const handleCreate = () => {
    // Calling our live contract: 0xFfAB10611EF65d877Db508Fe9e7111Bb1C759Af8
    writeContract({
      abi: [
        {
          "inputs": [
            { "internalType": "string", "name": "_name", "type": "string" },
            { "internalType": "uint256", "name": "_amount", "type": "uint256" },
            { "internalType": "uint256", "name": "_interval", "type": "uint256" }
          ],
          "name": "createGroup",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ],
      address: '0xFfAB10611EF65d877Db508Fe9e7111Bb1C759Af8',
      functionName: 'createGroup',
      args: [formData.name, BigInt(formData.amount), BigInt(2592000)], // Default 30 days
    });
    onSuccess();
  };

  return (
    <div className="min-h-[450px] flex flex-col justify-between">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <p className="text-gold text-[10px] font-black uppercase tracking-[0.3em]">Step 01/03 • Define Purpose</p>
            <h3 className="text-2xl font-serif text-gold-light">What is the collective goal?</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'Real Estate', icon: <Landmark /> },
                { id: 'Vehicles', icon: <Car /> },
                { id: 'Business', icon: <Zap /> },
                { id: 'Family', icon: <Users /> },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => { setFormData({ ...formData, goalType: type.id }); setStep(2); }}
                  className={`p-6 rounded-3xl border flex flex-col items-center gap-3 transition-all ${formData.goalType === type.id ? 'border-gold bg-gold/5 text-gold' : 'border-gold/10 text-gold-light/40 hover:border-gold/30'}`}
                >
                  {type.icon}
                  <span className="text-[10px] font-bold uppercase">{type.id}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <p className="text-gold text-[10px] font-black uppercase tracking-[0.3em]">Step 02/03 • Parameters</p>
            <h3 className="text-2xl font-serif text-gold-light">Establish the treasury rules.</h3>
            
            <div className="space-y-4">
              <div className="bg-earth-dark/60 p-4 rounded-2xl border border-gold/20 flex items-center gap-4">
                <DollarSign className="text-gold" size={20} />
                <input 
                  type="number" placeholder="Contribution Amount (USDC)" 
                  className="bg-transparent border-none outline-none text-gold-light w-full"
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
              <div className="bg-earth-dark/60 p-4 rounded-2xl border border-gold/20 flex items-center gap-4">
                <Calendar className="text-gold" size={20} />
                <select 
                  className="bg-transparent border-none outline-none text-gold-light w-full appearance-none"
                  onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                >
                  <option className="bg-earth-dark">Monthly</option>
                  <option className="bg-earth-dark">Weekly</option>
                  <option className="bg-earth-dark">Quarterly</option>
                </select>
              </div>
            </div>
            <button onClick={() => setStep(3)} className="w-full py-4 bg-gold text-earth-dark rounded-2xl font-black uppercase tracking-widest text-xs">Next: Sync Identity</button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <p className="text-gold text-[10px] font-black uppercase tracking-[0.3em]">Step 03/03 • Verification</p>
            <h3 className="text-2xl font-serif text-gold-light">Connect Community Intel.</h3>
            <p className="text-gold-light/40 text-xs">Linking a Telegram group allows KULA to verify member alignment and goals.</p>
            
            <div className="bg-[#229ED9]/10 p-6 rounded-3xl border border-[#229ED9]/30 flex flex-col items-center">
              <Send size={32} className="text-[#229ED9] mb-3" />
              <input 
                type="text" placeholder="@YourTelegramGroup" 
                className="bg-transparent text-center border-b border-[#229ED9]/50 outline-none text-gold-light w-full py-2 mb-4"
                onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
              />
              <div className="flex items-center gap-2 text-[8px] text-[#229ED9] font-bold uppercase tracking-widest">
                <ShieldCheck size={12} /> Data Privacy Protocol Active
              </div>
            </div>

            <button onClick={handleCreate} className="w-full py-5 bg-gold text-earth-dark rounded-2xl font-black uppercase tracking-widest text-xs shadow-[0_10px_20px_rgba(212,175,55,0.3)]">
              INITIALIZE THE CIRCLE
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
