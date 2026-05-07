"use client";

import { motion } from "framer-motion";
import { Download, TrendingUp, Landmark } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function WealthReport() {
  const stats = [
    { label: "Liquid Treasury", value: "142,500", unit: "USDC", sub: "Ready for deployment", change: "+12.4%" },
    { label: "RWA Holdings", value: "87,000", unit: "USDC", sub: "Appreciating assets", change: "+187%" },
    { label: "KULA Rewards", value: "12,840", unit: "KULA", sub: "Community staked", change: "+340" },
    { label: "Circle Trust", value: "94.2", unit: "%", sub: "Average integrity", change: "+3.1" },
  ];

  const generatePDF = () => {
    const doc = new jsPDF();
    const gold = [212, 175, 55];

    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setTextColor(...gold);
    doc.setFont("times", "bold");
    doc.setFontSize(28);
    doc.text("KULA SOVEREIGN VAULT", 105, 25, { align: "center" });
    
    doc.setFontSize(11);
    doc.text("Q1 2026 FINANCIAL REPORT • CONFIDENTIAL", 105, 34, { align: "center" });

    autoTable(doc, {
      startY: 65,
      head: [['Key Metric', 'Value', 'Status']],
      body: [
        ['Total Treasury', '229,500 USDC', 'Strong'],
        ['Active Yield', '8.42% APY', 'Compounding'],
        ['RWA Portfolio', '87,000 USDC', 'Appreciating'],
        ['Insurance Reserve', '1,240 USDC', 'Protected'],
      ],
      headStyles: { fillColor: gold, textColor: [15,15,15] },
    });

    doc.setFontSize(16);
    doc.text("Asset Inventory", 20, doc.lastAutoTable.finalY + 25);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 32,
      head: [['Asset', 'Date', 'Value', 'Growth']],
      body: [
        ['Kitengela 5-Acre', 'Feb 12, 2026', '45,000 USDC', '+200%'],
        ['Toyota Hilux 2024', 'Mar 01, 2026', '42,000 USDC', 'Certified'],
      ],
    });

    const finalY = doc.lastAutoTable.finalY + 25;
    doc.setDrawColor(...gold);
    doc.line(20, finalY, 190, finalY);

    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text("On-chain verified • Base Sepolia", 105, finalY + 15, { align: "center" });

    doc.save("KULA_Wealth_Report_Q1_2026.pdf");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-5xl font-serif gold-text">Wealth Report</h2>
          <p className="text-[#D4AF37]/60 tracking-widest text-sm mt-2">Q1 2026 • EXECUTIVE SUMMARY</p>
        </div>
        <motion.button 
          onClick={generatePDF}
          whileHover={{ scale: 1.05 }}
          className="btn-gold px-10 py-5 rounded-3xl flex items-center gap-3 font-black text-sm tracking-widest"
        >
          <Download size={18} /> DOWNLOAD PDF
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass-card rounded-3xl p-8"
          >
            <p className="uppercase text-xs tracking-widest text-[#D4AF37] font-black">{s.label}</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-5xl font-serif tracking-tighter text-white">{s.value}</span>
              <span className="text-2xl text-[#D4AF37]/70">{s.unit}</span>
            </div>
            <p className="text-sm text-[#F3E5AB]/60 mt-1">{s.sub}</p>
            <div className="text-green-500 text-xs mt-6 flex items-center gap-1">
              <TrendingUp size={14} /> {s.change} this quarter
            </div>
          </motion.div>
        ))}
      </div>

      <div className="glass-card rounded-[3rem] p-12">
        <div className="flex items-center gap-4 mb-10">
          <Landmark className="text-[#D4AF37]" size={32} />
          <h3 className="text-3xl font-serif">Current Holdings</h3>
        </div>
        {/* Placeholder for asset list */}
        <div className="text-[#F3E5AB]/60 italic">Full asset ledger available in PDF download</div>
      </div>
    </div>
  );
}
