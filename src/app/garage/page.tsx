"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { CURSORS, Cursor } from "@/data/cursors";
import { ArrowLeft, ShoppingCart, Check, MousePointer2 } from "lucide-react";

export default function CursorGarage() {
  const { stats, buyCursor, setActiveCursor } = useGameStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedCursor, setSelectedCursor] = useState<Cursor>(CURSORS[0]);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isOwned = (id: number) => (stats.ownedCursors || [1]).includes(id);
  const isActive = (id: number) => (stats.activeCursorId || 1) === id;

  const handleAction = () => {
    if (isOwned(selectedCursor.id)) {
      setActiveCursor(selectedCursor.id);
    } else {
      if (buyCursor(selectedCursor.id, selectedCursor.cost)) {
        setPurchaseSuccess(true);
        setTimeout(() => setPurchaseSuccess(false), 2000);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 max-w-[1400px] mx-auto w-full h-full bg-[#050505] text-white overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-gray-900/20 to-transparent pointer-events-none" />
      <div className="absolute inset-0 scanlines pointer-events-none opacity-20" />
      
      {/* Header */}
      <header className="flex justify-between items-end mb-12 border-b border-gray-800 pb-4 z-10">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => router.push("/hub")}
            className="p-2 border border-gray-800 hover:bg-white hover:text-black transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="font-mono text-xs tracking-[0.3em] text-gray-500 uppercase mb-1">Customization Lab</div>
            <h2 className="font-display text-2xl tracking-[0.2em] uppercase">Cursor Garage</h2>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs tracking-[0.3em] text-gray-500 uppercase mb-1">Available Credits</div>
          <div className="font-mono text-xl tracking-widest text-cyan-400">CR {stats.credits.toLocaleString()}</div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-12 min-h-0 z-10">
        
        {/* Left Column: Cursor List */}
        <div className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto pr-4 custom-scrollbar">
          <div className="font-mono text-[10px] tracking-[0.4em] text-gray-600 uppercase mb-2">Available Modifications</div>
          
          {CURSORS.map((cursor) => (
            <button
              key={cursor.id}
              onClick={() => setSelectedCursor(cursor)}
              className={`group relative flex items-center gap-4 p-4 border transition-all duration-300 ${
                selectedCursor.id === cursor.id 
                  ? "border-white bg-white/5 shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                  : "border-gray-900 hover:border-gray-700 bg-transparent"
              }`}
            >
              <div 
                className="w-12 h-12 flex items-center justify-center border border-gray-800 bg-black/40"
                style={{ color: cursor.color, boxShadow: selectedCursor.id === cursor.id ? `0 0 15px ${cursor.color}44` : 'none' }}
              >
                <MousePointer2 size={24} />
              </div>
              
              <div className="flex-1 text-left">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-display text-xs tracking-widest uppercase">{cursor.name}</span>
                  {isActive(cursor.id) && <span className="text-[9px] font-mono text-cyan-400 tracking-tighter">[ ACTIVE ]</span>}
                </div>
                <div className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">
                  Type: {cursor.type}
                </div>
              </div>

              {!isOwned(cursor.id) && (
                <div className="font-mono text-xs text-gray-400">
                  {cursor.cost} CR
                </div>
              )}
              
              {selectedCursor.id === cursor.id && (
                <motion.div 
                  layoutId="active-indicator"
                  className="absolute -left-1 top-0 bottom-0 w-1 bg-white"
                />
              )}
            </button>
          ))}
        </div>

        {/* Right Column: Preview & Detailed Info */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          
          {/* Large Preview Area */}
          <div className="flex-1 relative border border-gray-900 bg-[#020202] rounded-sm flex items-center justify-center overflow-hidden">
             <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
             
             {/* Large Animated Cursor Preview */}
             <motion.div
               key={selectedCursor.id}
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="relative z-10"
             >
                <div 
                  className="w-32 h-32 flex items-center justify-center relative"
                  style={{ color: selectedCursor.color }}
                >
                   <MousePointer2 size={80} className={`${selectedCursor.type === 'glow' ? 'animate-pulse' : ''}`} />
                   
                   {/* Visual Effects Emulation in Preview */}
                   {selectedCursor.type === 'glow' && (
                     <div className="absolute inset-0 rounded-full blur-3xl opacity-20" style={{ backgroundColor: selectedCursor.color }} />
                   )}
                   {selectedCursor.type === 'particles' && (
                     <div className="absolute inset-0 flex items-center justify-center">
                        {[...Array(6)].map((_, i) => (
                          <motion.div 
                            key={i}
                            animate={{ x: [0, (i-3)*40], y: [0, (i-1.5)*30], opacity: [0, 1, 0] }}
                            transition={{ repeat: Infinity, duration: 1.5, delay: i*0.2 }}
                            className="w-2 h-2 bg-white absolute"
                          />
                        ))}
                     </div>
                   )}
                </div>
             </motion.div>

             <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                <div>
                   <div className="font-mono text-[10px] text-gray-500 uppercase mb-2">Technical Specs</div>
                   <div className="font-display text-xl tracking-[0.2em] text-white uppercase">{selectedCursor.name}</div>
                </div>
                <div className="text-right">
                   <div className="font-mono text-[10px] text-gray-500 uppercase mb-1">Visual Class</div>
                   <div className="font-mono text-sm uppercase text-white tracking-widest">{selectedCursor.type}</div>
                </div>
             </div>
          </div>

          {/* Description & Action */}
          <div className="p-8 border border-gray-900 bg-[#0a0a0a] flex justify-between items-center">
             <div className="max-w-md">
                <p className="font-mono text-xs text-gray-400 uppercase leading-relaxed tracking-wider mb-2">
                  {selectedCursor.description}
                </p>
                <p className="font-mono text-[9px] text-gray-600 uppercase italic">
                  Installation improves game-feel and visual feedback precision.
                </p>
             </div>

             <div className="flex flex-col gap-3 min-w-[200px]">
                <button
                  onClick={handleAction}
                  disabled={!isOwned(selectedCursor.id) && stats.credits < selectedCursor.cost}
                  className={`py-4 px-6 font-mono text-xs tracking-[0.3em] uppercase transition-all flex items-center justify-center gap-3 ${
                    isOwned(selectedCursor.id)
                      ? isActive(selectedCursor.id)
                        ? "bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 cursor-default"
                        : "bg-white text-black hover:bg-gray-200"
                      : stats.credits < selectedCursor.cost
                        ? "border border-red-900 text-red-900 cursor-not-allowed"
                        : "border border-white hover:bg-white hover:text-black"
                  }`}
                >
                  {isOwned(selectedCursor.id) ? (
                    isActive(selectedCursor.id) ? (
                      <> <Check size={16} /> Active </>
                    ) : (
                      "Set Active"
                    )
                  ) : (
                    <>
                      <ShoppingCart size={16} /> 
                      {stats.credits < selectedCursor.cost ? "Insufficient Credits" : `Install - ${selectedCursor.cost} CR`}
                    </>
                  )}
                </button>
                
                <AnimatePresence>
                  {purchaseSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-center font-mono text-[10px] text-green-500 uppercase tracking-widest"
                    >
                      Modification Installed Successfully
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
