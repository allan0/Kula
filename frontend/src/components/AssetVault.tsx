"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, Landmark, Car, CheckCircle, FileText, Sparkles } from "lucide-react";
import axios from "axios";

export default function AssetVault() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cid, setCid] = useState<string>("");
  const [assetType, setAssetType] = useState<"property" | "vehicle" | "other">("property");

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
      alert("✅ Document successfully secured in the Kula IPFS Vault!");
    } catch (error) {
      console.error("IPFS Upload Error:", error);
      alert("Upload failed. Please check your Pinata configuration.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="glass-card rounded-[3rem] p-10 md:p-16">
        <div className="mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <Landmark className="text-[#D4AF37]" size={28} />
            <span className="uppercase text-xs tracking-[0.4em] font-black text-[#D4AF37]">RWA Protocol</span>
          </div>
          <h2 className="text-5xl font-serif tracking-tighter mb-3">Asset Tokenization Vault</h2>
          <p className="text-[#F3E5AB]/70 max-w-md">
            Convert your physical assets into community-verified digital equity.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Asset Type Selector */}
          <div className="lg:col-span-2 space-y-6">
            <p className="text-xs uppercase tracking-widest text-[#D4AF37]/70 mb-4">Asset Category</p>
            
            <div 
              onClick={() => setAssetType("property")}
              className={`p-6 rounded-3xl border cursor-pointer transition-all flex gap-5 items-center ${assetType === 'property' ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-[#D4AF37]/20 hover:border-[#D4AF37]/40'}`}
            >
              <div className="p-4 bg-[#D4AF37]/10 rounded-2xl"><Landmark size={32} className="text-[#D4AF37]" /></div>
              <div>
                <p className="font-bold text-lg">Real Estate</p>
                <p className="text-sm text-[#F3E5AB]/60">Title Deeds • Land • Buildings</p>
              </div>
            </div>

            <div 
              onClick={() => setAssetType("vehicle")}
              className={`p-6 rounded-3xl border cursor-pointer transition-all flex gap-5 items-center ${assetType === 'vehicle' ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-[#D4AF37]/20 hover:border-[#D4AF37]/40'}`}
            >
              <div className="p-4 bg-[#D4AF37]/10 rounded-2xl"><Car size={32} className="text-[#D4AF37]" /></div>
              <div>
                <p className="font-bold text-lg">Vehicles</p>
                <p className="text-sm text-[#F3E5AB]/60">Logbooks • Fleet Assets</p>
              </div>
            </div>
          </div>

          {/* Upload Area */}
          <div className="lg:col-span-3">
            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="border-2 border-dashed border-[#D4AF37]/30 rounded-[2.5rem] p-16 flex flex-col items-center justify-center text-center bg-[#1B1212]/50 hover:border-[#D4AF37]/60 transition-all cursor-pointer relative min-h-[340px]"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input 
                id="file-upload"
                type="file" 
                className="hidden" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              
              <UploadCloud size={64} className="text-[#D4AF37] mb-6" />
              
              <p className="text-xl font-medium mb-2">
                {file ? file.name : "Drop your document here"}
              </p>
              <p className="text-sm text-[#F3E5AB]/60">PDF, JPG, PNG • Max 15MB</p>
            </motion.div>

            <button 
              onClick={handleUpload}
              disabled={!file || uploading}
              className="mt-8 w-full py-6 btn-gold rounded-2xl text-base font-black tracking-widest disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {uploading ? (
                <>SECURING TO IPFS VAULT...</>
              ) : (
                <>UPLOAD &amp; SECURE <Sparkles size={20} /></>
              )}
            </button>
          </div>
        </div>

        {/* Success State */}
        {cid && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 p-8 bg-[#D4AF37]/5 border border-[#D4AF37]/30 rounded-3xl"
          >
            <div className="flex items-start gap-4">
              <CheckCircle className="text-green-500 mt-1" size={28} />
              <div>
                <p className="font-bold text-lg mb-1">Document Secured Successfully</p>
                <p className="font-mono text-xs break-all text-[#F3E5AB]/70 mb-4">{cid}</p>
                <p className="text-sm text-[#F3E5AB]/60">
                  This IPFS hash is now permanently linked to your KULA identity and ready for community verification.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
