"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, Landmark, Car, CheckCircle } from "lucide-react";
import axios from "axios";

export default function AssetVault() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cid, setCid] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`
        }
      });

      setCid(res.data.IpfsHash);
      alert("Document Secured in IPFS Vault!");
    } catch (error) {
      console.error("IPFS Upload Error:", error);
      alert("Upload failed. Check your API key.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-10 glass-card rounded-[2.5rem] border border-gold/20 max-w-5xl mx-auto">
      <div className="mb-10">
        <h2 className="text-4xl font-serif gold-text mb-2">Asset Tokenization</h2>
        <p className="text-gold-light/50">Convert physical wealth into group-verified digital assets.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Upload Zone */}
        <div className="space-y-6">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="border-2 border-dashed border-gold/20 rounded-3xl p-12 flex flex-col items-center justify-center bg-earth-dark/40 cursor-pointer relative"
          >
            <input 
              type="file" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <UploadCloud size={48} className="text-gold mb-4" />
            <p className="text-gold-light font-bold uppercase tracking-widest text-sm">
              {file ? file.name : "Select Deed or Logbook"}
            </p>
          </motion.div>

          <button 
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full py-4 bg-gold text-earth-dark rounded-2xl font-black tracking-widest disabled:opacity-50 transition-all shadow-xl"
          >
            {uploading ? "SECURING IN VAULT..." : "VERIFY & UPLOAD"}
          </button>
        </div>

        {/* Status / CID Display */}
        <div className="flex flex-col justify-center space-y-6">
          {cid && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 bg-gold/5 rounded-2xl border border-gold/20">
              <div className="flex items-center gap-2 text-gold mb-2 font-bold text-xs uppercase tracking-widest">
                <CheckCircle size={16} /> Document IPFS CID
              </div>
              <code className="text-[10px] text-gold-light/60 break-all">{cid}</code>
              <p className="mt-4 text-xs text-gold-light/40 italic">This hash is now permanently linked to your KULA account and ready for group voting.</p>
            </motion.div>
          )}

          <div className="p-6 luxury-border rounded-2xl opacity-60">
            <h4 className="font-serif text-gold-light mb-2 flex items-center gap-2">
              <Landmark size={18} /> Governance Protocol
            </h4>
            <p className="text-[10px] uppercase tracking-tighter text-gold-light/40 leading-relaxed">
              Once uploaded, a "Purchase Proposal" is automatically generated. Members have 72 hours to review the document and cast their vote.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
