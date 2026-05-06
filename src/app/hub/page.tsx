"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";

const SECTORS = [
  { id: 1, name: "CYBERIA", color: "#00f2ff", levels: "1 - 11" },
  { id: 2, name: "MAGMA PRIME", color: "#ff1a24", levels: "12 - 22" },
  { id: 3, name: "VOID NEXUS", color: "#bc13fe", levels: "23 - 33" },
  { id: 4, name: "QUANTUM CORE", color: "#00ff88", levels: "34 - 44" },
  { id: 5, name: "OMEGA STATION", color: "#ffffff", levels: "45 - 55" },
  { id: 99, name: "LUDILO (BONUS)", color: "#ff00a2", levels: "BONUS STAGES" }
];

export default function NeuralHub() {
  const { username, stats, logout, setSector } = useGameStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [hoveredSector, setHoveredSector] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!username) router.push("/");
  }, [username, router]);

  if (!mounted || !username) return null;

  const xpPercentage = (stats.xp / (1000 * stats.level)) * 100;
  
  const getActiveSector = () => {
    if (hoveredSector) return SECTORS.find(s => s.id === hoveredSector) || SECTORS[0];
    const unlocked = stats.unlockedSectors ?? [1];
    return SECTORS.find(s => s.id === unlocked[unlocked.length - 1]) || SECTORS[0];
  };

  const activeSector = getActiveSector();
  const unlockedSectors = [...(stats.unlockedSectors ?? [1]), 99]; // 99 is always unlocked
  const campaignMaxLevel = Math.min(stats.maxLevelReached ?? 1, 5 * 11);
  const isHoveredLocked = hoveredSector ? !unlockedSectors.includes(hoveredSector) : false;

  return (
    <div className="flex-1 flex flex-col p-5 md:p-8 max-w-[1400px] mx-auto w-full min-h-screen bg-[#050505] text-white overflow-y-auto app-scroll relative">
      
      {/* Hitman-style Top Nav */}
      <header className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end mb-8 md:mb-12 border-b border-gray-800 pb-4 z-10">
        <div>
          <div className="font-mono text-xs tracking-[0.3em] text-gray-500 uppercase mb-1">Status: Active</div>
          <h2 className="font-display text-2xl tracking-[0.2em] uppercase">Contract Hub</h2>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs tracking-[0.3em] text-gray-500 uppercase mb-1">Operative</div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-sm tracking-[0.2em] uppercase">{username}</span>
            <button onClick={logout} className="text-xs uppercase tracking-widest text-red-500 hover:text-white transition-colors">
              [DISCONNECT]
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 min-h-0 z-10 pb-10">
        
        {/* Left Column: Stats & Contracts */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-8 lg:gap-12 lg:max-h-[calc(100vh-150px)] overflow-y-auto pr-2 md:pr-4 custom-scrollbar app-scroll">
          
          {/* Profile Stats */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-baseline border-b border-gray-800 pb-2">
              <span className="font-mono text-xs tracking-[0.2em] uppercase text-gray-500">Operative Level</span>
              <span className="font-display text-xl">{stats.level}</span>
            </div>
            
            <div>
              <div className="flex justify-between text-[10px] font-mono tracking-widest text-gray-500 mb-2 uppercase">
                <span>Experience</span>
                <span>{Math.floor(xpPercentage)}%</span>
              </div>
              <div className="h-[2px] w-full bg-gray-900 relative overflow-hidden">
                <motion.div 
                  className="absolute left-0 top-0 bottom-0 bg-white"
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPercentage}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>

            <div className="flex justify-between items-baseline border-b border-gray-800 pb-2 pt-4">
              <span className="font-mono text-xs tracking-[0.2em] uppercase text-gray-500">Available Funds</span>
              <span className="font-mono text-sm tracking-widest">CR {stats.credits}</span>
            </div>

            <button
              onClick={() => router.push("/skills")}
              className="mt-4 w-full py-3 border border-gray-800 font-mono text-xs tracking-[0.2em] uppercase hover:bg-white hover:text-black transition-colors"
            >
              Access Loadout / Upgrades
            </button>

            <button
              onClick={() => router.push("/garage")}
              className="mt-4 w-full py-3 border border-gray-800 font-mono text-xs tracking-[0.2em] uppercase hover:bg-white hover:text-black transition-colors"
            >
              Enter Cursor Garage
            </button>
          </div>

          {/* Mission Select */}
          <div className="flex flex-col gap-2">
            <div className="font-display text-sm tracking-[0.3em] uppercase mb-4 border-l-2 border-red-500 pl-3">
              Sector Selection
            </div>
            
            {SECTORS.map((sector) => {
              const isLocked = !unlockedSectors.includes(sector.id);
              
              return (
                <div key={sector.id}
                  onMouseEnter={() => setHoveredSector(sector.id)}
                  onMouseLeave={() => setHoveredSector(null)}
                  className={`group border transition-all ${
                    isLocked 
                      ? 'border-transparent opacity-30 cursor-not-allowed' 
                      : 'border-gray-900 hover:border-gray-600 bg-[#0a0a0a]'
                  }`}
                >
                  <div 
                    className={`flex justify-between items-center p-4 ${!isLocked ? 'cursor-pointer' : ''}`}
                    onClick={() => !isLocked && (setSector(sector.id), router.push("/play"))}
                  >
                    <div>
                      <div className="font-mono text-[10px] tracking-widest text-gray-500 uppercase mb-1">
                        Sector {sector.id} (LVL {sector.levels})
                      </div>
                      <div className={`font-display tracking-[0.2em] uppercase text-sm ${isLocked ? 'text-gray-600' : 'text-white'}`} style={{ color: !isLocked ? sector.color : '' }}>
                        {sector.name}
                      </div>
                    </div>
                    {isLocked ? (
                      <span className="font-mono text-[10px] text-red-500 uppercase tracking-widest">LOCKED</span>
                    ) : (
                      <span className="font-mono text-xs opacity-0 group-hover:opacity-100 transition-opacity tracking-widest uppercase text-white">
                        Deploy
                      </span>
                    )}
                  </div>
                  
                  {/* Replay Grid for unlocked sectors */}
                  {!isLocked && (
                    <div className="px-4 pb-4 grid grid-cols-6 gap-1 border-t border-gray-800 pt-3 mt-1 bg-[#050505]">
                      {Array.from({length: 11}, (_, i) => {
                        const lvl = (sector.id - 1) * 11 + i + 1;
                        const levelLabel = sector.id === 99 ? `B${i + 1}` : `L${lvl}`;
                        const isLvlCleared = (stats.completedLevels ?? []).includes(lvl);
                        const isReachable = sector.id === 99 || lvl <= campaignMaxLevel || isLvlCleared;
                        return (
                          <button
                            key={lvl}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isReachable) {
                                setSector(sector.id);
                                useGameStore.getState().setReplayLevel(lvl);
                                router.push("/play");
                              }
                            }}
                            className={`py-1.5 font-mono text-[10px] text-center border transition-all ${
                              isLvlCleared ? 'border-green-500/40 text-green-400 hover:bg-green-500/20' :
                              isReachable ? 'border-gray-600 text-white hover:bg-gray-800' :
                              'border-gray-900 text-gray-700 cursor-not-allowed'
                            }`}
                            title={sector.id === 99 ? `Bonus ${i + 1}` : `Level ${lvl}`}
                          >
                            {levelLabel}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* Right Column: 2D Eclipse Visualization */}
        <div className="hidden lg:flex lg:col-span-7 xl:col-span-8 sticky top-8 h-[calc(100vh-96px)] relative border border-gray-900 bg-[#020202] items-center justify-center overflow-hidden">
          
          {/* Diagnostic Overlay */}
          <div className="absolute top-6 left-6 pointer-events-none z-10 font-mono text-[10px] tracking-widest uppercase text-gray-500">
            <p>Target System: {activeSector.name}</p>
            <p>Vector: {activeSector.color}</p>
            <p>Status: {isHoveredLocked ? "ACCESS DENIED" : "READY"}</p>
          </div>

          {/* The Eclipse Planet */}
          <motion.div 
            className="relative rounded-full flex items-center justify-center transition-all duration-700 ease-out"
            style={{
              width: "450px",
              height: "450px",
              backgroundColor: "#000",
              boxShadow: `inset -60px -60px 100px -20px rgba(0,0,0,0.9), inset 10px 10px 40px ${isHoveredLocked ? '#333' : activeSector.color}, 0 0 50px ${isHoveredLocked ? 'rgba(50,50,50,0.1)' : activeSector.color + '44'}`,
              border: `1px solid ${isHoveredLocked ? '#333' : activeSector.color + '66'}`,
              filter: isHoveredLocked ? 'grayscale(100%) opacity(50%)' : 'none'
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            {/* Inner text glow */}
            <div 
              className="font-display tracking-[0.5em] text-sm uppercase transition-all duration-700"
              style={{
                color: isHoveredLocked ? '#555' : activeSector.color,
                textShadow: isHoveredLocked ? 'none' : `0 0 20px ${activeSector.color}`
              }}
            >
              {isHoveredLocked ? "LOCKED" : "SYSTEM READY"}
            </div>

            {/* Orbiting ring */}
            <motion.div
               animate={{ rotate: 360 }}
               transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
               className="absolute rounded-full border border-dashed opacity-20 pointer-events-none"
               style={{
                 width: "550px",
                 height: "550px",
                 borderColor: activeSector.color,
               }}
            />
          </motion.div>
          
        </div>
      </div>
    </div>
  );
}
