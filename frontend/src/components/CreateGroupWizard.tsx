"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWriteContract } from 'wagmi';
import { 
  Landmark, Car, Users, Zap, Calendar, DollarSign, 
  Send, ShieldCheck, ArrowRight 
} from "lucide-react";

export default function CreateGroupWizard({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    goalType: "Real Estate",
    amount: "1000",
    members: "8",
    interval: "Monthly",
    telegram: ""
  });

  const { writeContract } = useWriteContract();

  const handleCreate = async () => {
    try {
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
        address: '0xFfAB10611EF65d877Db508Fe9e7111Bb1C759Af8', // Update with deployed address
        functionName: 'createGroup',
        args: [formData.name, BigInt(formData.amount), BigInt(2592000)], // 30 days
      });

      alert("🎉 Circle Initialized Successfully!");
      onSuccess();
    } catch (error) {
      console.error(error);
      alert("Transaction failed. Please try again.");
    }
  };

  return (
    <div className="min-h-[480px] flex flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-[#D4AF37] font-black">
          <span>STEP {step} OF 3</span>
          <div className="flex-1 h-px bg-[#D4AF37]/20" />
        </div>
        <h3 className="text-3xl font-serif mt-3">Initialize New Circle</h3>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Purpose */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="space-y-8"
          >
            <p className="text-lg text-[#F3E5AB]/80">What is the purpose of this circle?</p>
            
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'Real Estate', icon: <Landmark size={32} />, label: "Property" },
                { id: 'Vehicles', icon: <Car size={32} />, label: "Vehicles" },
                { id: 'Business', icon: <Zap size={32} />, label: "Business" },
                { id: 'Family', icon: <Users size={32} />, label: "Family" },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setFormData({ ...formData, goalType: type.id });
                    setStep(2);
                  }}
                  className={`p-8 rounded-3xl border flex flex-col items-center gap-4 transition-all hover:border-[#D4AF37] ${
                    formData.goalType === type.id 
                      ? 'border-[#D4AF37] bg-[#D4AF37]/5' 
                      : 'border-[#D4AF37]/20'
                  }`}
                >
                  <div className="text-[#D4AF37]">{type.icon}</div>
                  <span className="font-bold text-lg">{type.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 2: Parameters */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="space-y-8"
          >
            <p className="text-lg text-[#F3E5AB]/80">Define contribution rules</p>

            <div className="space-y-6">
              <div className="bg-[#1B1212] p-6 rounded-3xl border border-[#D4AF37]/20">
                <label className="text-xs uppercase tracking-widest text-[#D4AF37]/70 block mb-3">CONTRIBUTION AMOUNT (USDC)</label>
                <div className="flex items-center gap-4">
                  <DollarSign className="text-[#D4AF37]" size={28} />
                  <input 
                    type="number" 
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="bg-transparent text-4xl font-serif outline-none w-full"
                  />
                </div>
              </div>

              <div className="bg-[#1B1212] p-6 rounded-3xl border border-[#D4AF37]/20">
                <label className="text-xs uppercase tracking-widest text-[#D4AF37]/70 block mb-3">PAYMENT INTERVAL</label>
                <select 
                  value={formData.interval}
                  onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                  className="bg-transparent text-xl w-full outline-none"
                >
                  <option>Monthly</option>
                  <option>Weekly</option>
                  <option>Quarterly</option>
                </select>
              </div>
            </div>

            <button 
              onClick={() => setStep(3)}
              className="w-full py-6 btn-gold rounded-3xl text-sm font-black tracking-widest flex items-center justify-center gap-3"
            >
              CONTINUE TO VERIFICATION <ArrowRight size={20} />
            </button>
          </motion.div>
        )}

        {/* Step 3: Verification */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="space-y-8"
          >
            <p className="text-lg text-[#F3E5AB]/80">Connect your circle's communication</p>
            
            <div className="bg-[#229ED9]/10 border border-[#229ED9]/30 p-10 rounded-3xl text-center">
              <Send size={48} className="mx-auto mb-6 text-[#229ED9]" />
              <input 
                type="text" 
                placeholder="@YourTelegramGroup"
                value={formData.telegram}
                onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                className="bg-transparent text-center border-b border-[#229ED9]/50 outline-none text-xl py-3 w-full"
              />
              <p className="text-xs text-[#229ED9] mt-8">This helps verify member alignment and sync group activity.</p>
            </div>

            <button 
              onClick={handleCreate}
              className="w-full py-7 bg-gradient-to-r from-[#D4AF37] via-[#E8C670] to-[#D4AF37] text-black font-black text-base tracking-[0.08em] rounded-3xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
            >
              INITIALIZE THE CIRCLE
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
