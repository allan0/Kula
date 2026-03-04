"use client";
import { motion } from "framer-motion";
import { Download, PieChart, TrendingUp, Landmark } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function WealthReport() {
  const stats = [
    { label: "Liquid Treasury", value: "142,500 USDC", sub: "Available for Acquisition" },
    { label: "Asset Net Worth", value: "45,000 USDC", sub: "Kitengela 5-Acre Plot" },
    { label: "Rewards Issued", value: "12,400 KULA", sub: "85% Community Staked" },
    { label: "Avg. Trust Rating", value: "94.2%", sub: "Circle Integrity Level" },
  ];

  const generatePDF = () => {
    const doc = new jsPDF();
    const goldColor = [212, 175, 55]; // KULA Gold RGB

    // --- HEADER ---
    doc.setFillColor(27, 18, 18); // Dark Earth BG
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(212, 175, 55);
    doc.setFont("times", "bold");
    doc.setFontSize(28);
    doc.text("KULA VAULT REPORT", 105, 25, { align: "center" });

    doc.setFontSize(10);
    doc.text("CONFIDENTIAL • EXECUTIVE FINANCIAL AUDIT", 105, 33, { align: "center" });

    // --- SUMMARY SECTION ---
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(14);
    doc.text("Treasury Summary", 14, 55);
    
    autoTable(doc, {
      startY: 60,
      head: [['Metric', 'Value', 'Status']],
      body: [
        ['Liquid Liquidity', '142,500 USDC', 'Verified on Base L2'],
        ['Total RWA Value', '45,000 USDC', 'Appreciating (+200%)'],
        ['Active Yield (Aave)', '8.4% APY', 'Compounding'],
        ['Community Rewards', '12,400 KULA', 'Minted'],
      ],
      headStyles: { fillColor: [62, 39, 35], textColor: [243, 229, 171] },
      styles: { font: "times" }
    });

    // --- ASSET INVENTORY ---
    doc.text("Real-World Asset Inventory", 14, doc.lastAutoTable.finalY + 20);
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 25,
      head: [['Asset Description', 'Acquisition Date', 'Base Price', 'On-Chain Hash']],
      body: [
        ['Kitengela Plot (5-Acre)', 'Feb 12, 2026', '15,000 USDC', 'QmXoyp...789'],
      ],
      headStyles: { fillColor: [212, 175, 55], textColor: [27, 18, 18] },
    });

    // --- FOOTER / SEAL ---
    const finalY = doc.lastAutoTable.finalY + 30;
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.5);
    doc.line(14, finalY, 196, finalY);
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("This document is a cryptographically signed statement of the KULA Protocol.", 105, finalY + 10, { align: "center" });
    doc.text("Verification Hash: 0x71C4...34a9b2e5", 105, finalY + 15, { align: "center" });

    // SAVE FILE
    doc.save("KULA_Wealth_Report_Q1_2026.pdf");
  };

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-start border-b border-gold/10 pb-8">
        <div>
          <h2 className="text-4xl font-serif gold-text uppercase">Financial Audit</h2>
          <p className="text-gold-light/40 text-[10px] tracking-[0.4em] mt-2 uppercase font-black">Report Q1 2026 • Verified by KULA Oracle</p>
        </div>
        <motion.button 
          onClick={generatePDF}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-6 py-3 luxury-border rounded-xl text-gold font-bold text-[10px] tracking-widest uppercase shadow-2xl bg-gold/5 hover:bg-gold hover:text-earth-dark transition-all"
        >
          <Download size={14} /> Download PDF Statement
        </motion.button>
      </div>

      {/* METRIC GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 glass-card rounded-3xl border border-gold/5"
          >
            <p className="text-[9px] text-gold uppercase font-black tracking-widest mb-2">{s.label}</p>
            <h4 className="text-2xl font-serif text-gold-light mb-1">{s.value}</h4>
            <p className="text-[10px] text-gold-light/30 uppercase tracking-tighter">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* DETAILED ASSET LEDGER */}
      <div className="p-10 glass-card rounded-[3rem] border border-gold/10 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <Landmark className="text-gold" size={24} />
            <h3 className="text-2xl font-serif text-gold-light">Real-World Asset Inventory</h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-4 text-[10px] text-gold/40 uppercase font-black tracking-widest px-4">
              <span>Asset Description</span>
              <span className="text-center">Purchase Date</span>
              <span className="text-center">Base Price</span>
              <span className="text-right">Valuation</span>
            </div>
            
            <div className="p-5 luxury-border rounded-2xl flex justify-between items-center group">
              <div className="flex-1 flex flex-col">
                <span className="text-sm font-bold text-gold-light uppercase tracking-tight">Kitengela Plot (5-Acre)</span>
                <span className="text-[9px] text-gold-light/40 font-mono">IPFS: QmXoyp...789</span>
              </div>
              <span className="flex-1 text-center text-xs text-gold-light/60">Feb 12, 2026</span>
              <span className="flex-1 text-center text-xs text-gold-light/60">15,000 USDC</span>
              <div className="flex-1 text-right flex flex-col items-end">
                <span className="text-sm font-black text-gold">45,000 USDC</span>
                <span className="text-[8px] text-green-500 font-bold tracking-tighter">+200% Appreciation</span>
              </div>
            </div>
          </div>
        </div>
        <PieChart className="absolute -right-10 -bottom-10 text-gold/5" size={200} />
      </div>

      {/* YIELD GROWTH CHART */}
      <div className="p-8 luxury-border rounded-[2.5rem] bg-gold/5 flex flex-col md:flex-row gap-10 items-center">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-green-500" />
            <h4 className="text-xl font-serif text-gold-light uppercase tracking-widest">Growth Engine</h4>
          </div>
          <p className="text-sm text-gold-light/40 leading-relaxed">
            Your treasury is currently yielding <span className="text-green-500 font-bold">8.4% APY</span>. Interest earned covers gas fees for all circle members.
          </p>
        </div>
        <div className="w-full md:w-64 h-32 border border-gold/10 rounded-2xl flex items-end justify-center gap-2 p-4">
          {[40, 60, 45, 70, 90, 85, 100].map((h, i) => (
            <motion.div 
              key={i} 
              initial={{ height: 0 }} 
              animate={{ height: `${h}%` }} 
              className="w-4 bg-gold rounded-t-sm opacity-40" 
            />
          ))}
        </div>
      </div>
    </div>
  );
}
