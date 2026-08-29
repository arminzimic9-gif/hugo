"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import {
  Crosshair, Zap, Shield, Clock, Magnet, Star, Lock,
  ChevronLeft, ZoomIn, ZoomOut, RefreshCw, Target,
  Swords, Activity, Cpu, Eye, Flame, Atom, Radio,
  Maximize, Layers, Wind, Battery, Hammer, Gem, Check
} from "lucide-react";
import NeuralBackground from "@/components/NeuralBackground";
import {
  CRAFTING_RECIPES,
  MATERIALS_BY_ID,
  createEmptyMaterialInventory,
  getMissingMaterialIds,
} from "@/data/crafting";

/* ─── SKILL DEFINITIONS ────────────────────────────────────────────────── */
const NODES = [
  // Core
  { id:"core",       label:"HUGO",         desc:"Neural Core — start here",                    cost:0,   x:1000, y:1000, branch:"core",     Icon:Cpu,       requires:[] },

  // ── COMBAT branch (West) ──
  { id:"precision",  label:"PRECISION",    desc:"+30% hitbox on every slice",                  cost:80,  x:850,  y:1000, branch:"combat",   Icon:Crosshair, requires:["core"] },
  { id:"blast",      label:"BLAST SHOT",   desc:"Click to fire AoE blast that kills cubes",    cost:200, x:700,  y:850,  branch:"combat",   Icon:Zap,       requires:["precision"] },
  { id:"auto",       label:"AUTO FIRE",    desc:"Auto-slicer duration doubled",                cost:120, x:700,  y:1000, branch:"combat",   Icon:Target,    requires:["precision"] },
  { id:"critical",   label:"CRITICAL x3",  desc:"Every 5th hit = triple points",               cost:150, x:700,  y:1150, branch:"combat",   Icon:Flame,     requires:["precision"] },
  { id:"ricochet",   label:"RICOCHET",     desc:"Sliced cubes bounce into 1 nearby cube on hit",cost:220,x:550,  y:700,  branch:"combat",   Icon:Zap,       requires:["blast"] },
  { id:"rapidfire",  label:"RAPID FIRE",   desc:"Blast shot fires 3 times faster",             cost:220, x:550,  y:850,  branch:"combat",   Icon:Zap,       requires:["blast"] },
  { id:"vampire",    label:"VAMPIRE",      desc:"Each kill restores 0.5s on timed levels",     cost:200, x:550,  y:1000, branch:"combat",   Icon:Battery,   requires:["auto"] },
  { id:"cluster",    label:"CLUSTER BOMB", desc:"Blast creates 6 mini-explosions",             cost:280, x:550,  y:1150, branch:"combat",   Icon:Flame,     requires:["critical"] },
  { id:"phantom",    label:"PHANTOM",      desc:"Blast shot leaves ghost that fires again in 2s",cost:380,x:400, y:700,  branch:"combat",   Icon:Eye,       requires:["ricochet"] },
  { id:"bloodlust",  label:"BLOODLUST",    desc:"x5 combo multiplier after 30 kills",          cost:380, x:400,  y:850,  branch:"combat",   Icon:Flame,     requires:["rapidfire"] },
  { id:"executor",   label:"EXECUTOR",     desc:"Final blow on a cube worth triple if solo",   cost:310, x:400,  y:1000, branch:"combat",   Icon:Target,    requires:["vampire"] },
  { id:"echo",       label:"ECHO STRIKE",  desc:"Every hit explodes again 0.2s later",         cost:260, x:400,  y:1150, branch:"combat",   Icon:Layers,    requires:["cluster"] },
  { id:"shockwave",  label:"SHOCKWAVE",    desc:"Every 10th hit sends AoE shockwave",          cost:300, x:250,  y:1000, branch:"combat",   Icon:Maximize,  requires:["bloodlust","executor","echo"] },
  { id:"overdrive2", label:"OVERDRIVE II", desc:"Every 50 combo kills everything on screen",   cost:800, x:100,  y:1000, branch:"combat",   Icon:Flame,     requires:["shockwave"] },

  // ── FORCE branch (North) ──
  { id:"reflexes",   label:"REFLEXES",     desc:"Slow-mo lasts 2× longer",                     cost:100, x:1000, y:850,  branch:"force",    Icon:Clock,     requires:["core"] },
  { id:"shield",     label:"BARRIER",      desc:"Start each level with shield active",         cost:180, x:850,  y:700,  branch:"force",    Icon:Shield,    requires:["reflexes"] },
  { id:"timewarp",   label:"TIME WARP",    desc:"Auto-freeze triggers on mine touch once",     cost:220, x:1000, y:700,  branch:"force",    Icon:RefreshCw, requires:["reflexes"] },
  { id:"phase",      label:"PHASE SHIFT",  desc:"First mine of each level passes through",     cost:250, x:1150, y:700,  branch:"force",    Icon:Eye,       requires:["reflexes"] },
  { id:"pulsewave",  label:"PULSE WAVE",   desc:"Every 15s auto-fires a medium AoE shockwave", cost:360, x:850,  y:550,  branch:"force",    Icon:Radio,     requires:["shield"] },
  { id:"doubleTime", label:"DOUBLE SLOW",  desc:"Slow-mo activates automatically every 30s",   cost:300, x:1000, y:550,  branch:"force",    Icon:Clock,     requires:["timewarp"] },
  { id:"overclock",  label:"OVERCLOCK",    desc:"Q cooldown cut in half, 3× slow-mo duration", cost:280, x:1150, y:550,  branch:"force",    Icon:Maximize,  requires:["phase"] },
  { id:"timesiphon", label:"TIME SIPHON",  desc:"Slow-Mo gives 2× score and credits",          cost:750, x:1000, y:400,  branch:"force",    Icon:Zap,       requires:["pulsewave","doubleTime","overclock"] },
  { id:"timewarp2",  label:"TIME WARP II", desc:"Slow-Mo also freezes boss projectiles",       cost:420, x:1000, y:250,  branch:"force",    Icon:Clock,     requires:["timesiphon"] },
  { id:"phaserush",  label:"PHASE RUSH",   desc:"On kill: +10% move speed for 3s, stacks x5",  cost:290, x:1000, y:100,  branch:"force",    Icon:Cpu,       requires:["timewarp2"] },

  // ── SURVIVAL branch (East) ──
  { id:"siphon",     label:"SIPHON",       desc:"+20% credits per level cleared",              cost:100, x:1150, y:1000, branch:"survival", Icon:Activity,  requires:["core"] },
  { id:"hp",         label:"EXTRA HP",     desc:"3 lives per level before full fail",          cost:160, x:1300, y:850,  branch:"survival", Icon:Star,      requires:["siphon"] },
  { id:"magnet2",    label:"MAGNET+",      desc:"Magnet powerup lasts 3× longer",              cost:140, x:1300, y:1000, branch:"survival", Icon:Magnet,    requires:["siphon"] },
  { id:"overdrive",  label:"OVERDRIVE",    desc:"Score ×4 during all boss levels",             cost:300, x:1300, y:1150, branch:"survival", Icon:Swords,    requires:["siphon"] },
  { id:"resurrection",label:"RESURRECT",   desc:"Auto-revive once per boss fight",             cost:350, x:1450, y:850,  branch:"survival", Icon:Star,      requires:["hp"] },
  { id:"guardian",   label:"GUARDIAN",     desc:"Shield auto-activates every 30 seconds",      cost:240, x:1450, y:1000, branch:"survival", Icon:Radio,     requires:["magnet2"] },
  { id:"secondwind", label:"SECOND WIND",  desc:"Revive once per GD level with half track reset",cost:380,x:1450,y:1150, branch:"survival", Icon:Activity,  requires:["overdrive"] },
  { id:"fortress",   label:"FORTRESS",     desc:"Mines deal only half damage (2 mine hits = die)",cost:350,x:1600,y:1000, branch:"survival", Icon:Shield,    requires:["resurrection","guardian","secondwind"] },
  { id:"ironskin",   label:"IRON SKIN",    desc:"First 3 mines are blocked automatically",     cost:420, x:1750, y:1000, branch:"survival", Icon:Shield,    requires:["fortress"] },
  { id:"ironcurtain",label:"IRON CURTAIN", desc:"Mine hits cost 5s time instead of game over", cost:500, x:1900, y:1000, branch:"survival", Icon:Lock,      requires:["ironskin"] },

  // ── CHAOS branch (South) ──
  { id:"chaos",      label:"CHAOS CORE",   desc:"Unlocks the Chaos branch — use with caution", cost:180, x:1000, y:1150, branch:"chaos",    Icon:Flame,     requires:["core"] },
  { id:"nuclear",    label:"NUKE MASTERY", desc:"Atomic Bomb drops 3× more often",             cost:280, x:850,  y:1300, branch:"chaos",    Icon:Atom,      requires:["chaos"] },
  { id:"berserk",    label:"BERSERK",      desc:"x10 score for 5s, then 0 for 3s",             cost:350, x:1000, y:1300, branch:"chaos",    Icon:Swords,    requires:["chaos"] },
  { id:"frenzy",     label:"FRENZY",       desc:"After x20 combo, speed doubles for 10s",      cost:320, x:1150, y:1300, branch:"chaos",    Icon:Wind,      requires:["chaos"] },
  { id:"glass",      label:"GLASS CANNON", desc:"Mines instantly fail but +200% score",        cost:400, x:850,  y:1450, branch:"chaos",    Icon:Zap,       requires:["nuclear"] },
  { id:"overload",   label:"OVERLOAD",     desc:"Everything at double speed — score ×5",       cost:500, x:1000, y:1450, branch:"chaos",    Icon:Activity,  requires:["berserk"] },
  { id:"entropy",    label:"ENTROPY",      desc:"Every 5s a random powerup spawns automatically",cost:340,x:1150,y:1450, branch:"chaos",    Icon:Wind,      requires:["frenzy"] },
  { id:"singularity",label:"SINGULARITY",  desc:"Chaos Bonus lasts 40s and spawns 2× cubes",   cost:600, x:1000, y:1600, branch:"chaos",    Icon:Atom,      requires:["glass","overload","entropy"] },
  { id:"quantum",    label:"QUANTUM LEAP", desc:"Infinite jumps in ALL modes, even ninja",     cost:999, x:1000, y:1750, branch:"chaos",    Icon:Zap,       requires:["singularity"] },
];






const BRANCH_COLOR: Record<string,string> = {
  core:     "#ffffff",
  combat:   "#ff1a24",
  force:    "#00f2ff",
  survival: "#00ff88",
  chaos:    "#ff8800",
};

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.0;
const SVG_W = 2000, SVG_H = 2000;

/* ─── COMPONENT ─────────────────────────────────────────────────────────── */
export default function SkillsPage() {
  const router = useRouter();
  const { stats, unlockSkill, craftRecipe, username } = useGameStore();
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered]   = useState<string|null>(null);
  const [flash, setFlash]       = useState<string|null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [craftNotice, setCraftNotice] = useState<string | null>(null);
  const [selectedCraftId, setSelectedCraftId] = useState(() => CRAFTING_RECIPES[0]?.id ?? "");

  // Pan & Zoom state
  const [zoom, setZoom]     = useState(0.85);
  const [pan, setPan]       = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx:0, my:0, px:0, py:0 });
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setMounted(true);
    if (!username) router.push("/");
  }, [username, router]);

  /* zoom on wheel */
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z - e.deltaY * 0.001)));
  }, []);

  /* pan drag */
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    setIsDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan({ x: dragStart.current.px + e.clientX - dragStart.current.mx,
              y: dragStart.current.py + e.clientY - dragStart.current.my });
  };
  const onMouseUp = () => {
    dragging.current = false;
    setIsDragging(false);
  };

  if (!mounted) return null;

  const unlocked = (id:string) => id === "core" || stats.skills.includes(id);
  const affordable = (cost:number) => stats.credits >= cost;
  const available = (n: typeof NODES[0]) => !unlocked(n.id) && n.requires.every(r => unlocked(r));
  const materialInventory = stats.materials ?? createEmptyMaterialInventory();
  const craftedGear = stats.craftedGear ?? [];
  const selectedCraft = CRAFTING_RECIPES.find((recipe) => recipe.id === selectedCraftId) ?? CRAFTING_RECIPES[0];

  const getCraftState = (recipe: (typeof CRAFTING_RECIPES)[number]) => {
    const crafted = craftedGear.includes(recipe.id);
    const levelReady = stats.level >= recipe.unlockLevel;
    const missing = getMissingMaterialIds(recipe, materialInventory);
    const canCraft = !crafted && levelReady && missing.length === 0;
    const statusLabel = crafted ? "CRAFTED" : canCraft ? "AVAILABLE" : levelReady ? "MISSING" : "LOCKED";
    const statusColor = crafted ? "#00ff88" : canCraft ? "#ffd36a" : levelReady ? "#ff8a80" : "#888888";
    return { crafted, levelReady, missing, canCraft, statusLabel, statusColor };
  };

  const buy = (n: typeof NODES[0]) => {
    if (!available(n)) return;
    const ok = unlockSkill(n.id, n.cost);
    if (ok) { setFlash(n.id); setTimeout(() => setFlash(null), 900); }
  };

  const craftGear = (recipeId: (typeof CRAFTING_RECIPES)[number]["id"]) => {
    const ok = craftRecipe(recipeId);
    setCraftNotice(ok ? "CRAFT SUCCESS" : "CRAFT LOCKED");
    setTimeout(() => {
      setCraftNotice((prev) => (prev ? null : prev));
    }, 1200);
  };

  const hovNode = hovered ? NODES.find(n => n.id === hovered) : null;

  // Center transform
  const tx = (v: number) => v * zoom + pan.x;
  const ty = (v: number) => v * zoom + pan.y;
  const r  = (base: number) => base * zoom;

  return (
    <div className="fixed inset-0 bg-[#050505] flex flex-col select-none" style={{fontFamily:"'Rajdhani',sans-serif"}}>
      <NeuralBackground />
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-5">
          <button onClick={() => router.push("/hub")}
            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors font-mono text-xs tracking-widest uppercase">
            <ChevronLeft size={16} /> Hub
          </button>
          <div className="w-px h-6 bg-gray-800" />
          <div>
            <div className="text-[10px] font-mono tracking-[0.4em] text-gray-600 uppercase">Neural Augmentation</div>
            <div className="text-xl font-mono tracking-[0.25em] text-white uppercase">Skill Matrix</div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Credits */}
          <div className="text-right">
            <div className="text-[9px] font-mono text-gray-600 tracking-widest uppercase">Credits</div>
            <div className="text-xl font-mono text-yellow-400">{stats.credits.toLocaleString()}</div>
          </div>
          {/* Unlocked */}
          <div className="text-right">
            <div className="text-[9px] font-mono text-gray-600 tracking-widest uppercase">Unlocked</div>
            <div className="text-xl font-mono text-white">
              {stats.skills.length}<span className="text-gray-600 text-sm">/{NODES.length-1}</span>
            </div>
          </div>
          {/* Zoom controls */}
          <div className="flex items-center gap-1 border border-gray-800 p-1">
            <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 0.15))}
              className="p-1.5 text-gray-500 hover:text-white transition-colors"><ZoomOut size={14}/></button>
            <span className="font-mono text-[10px] text-gray-600 w-10 text-center">{Math.round(zoom*100)}%</span>
            <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 0.15))}
              className="p-1.5 text-gray-500 hover:text-white transition-colors"><ZoomIn size={14}/></button>
            <button onClick={() => { setZoom(0.85); setPan({x:0,y:0}); }}
              className="p-1.5 text-gray-500 hover:text-white transition-colors"><RefreshCw size={14}/></button>
          </div>
        </div>
      </div>

      {/* Branch legend */}
      <div className="flex items-center gap-8 px-10 py-2.5 border-b border-white/5 shrink-0">
        {Object.entries(BRANCH_COLOR).filter(([k])=>k!=="core").map(([branch, col]) => (
          <div key={branch} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{background:col,boxShadow:`0 0 6px ${col}`}} />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase" style={{color:col}}>{branch}</span>
          </div>
        ))}
        <div className="ml-auto font-mono text-[9px] text-gray-700 tracking-widest">SCROLL TO ZOOM · DRAG TO PAN · CLICK NODE TO UNLOCK</div>
      </div>

      {/* ── CANVAS ── */}
      <div className="flex-1 relative overflow-hidden"
        style={{cursor: isDragging ? "grabbing" : "grab"}}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <svg ref={svgRef} className="absolute inset-0 w-full h-full">
          <defs>
            {/* Radial bg glow */}
            <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1a0500" stopOpacity="0.5"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>
            {Object.entries(BRANCH_COLOR).map(([b,c]) => (
              <filter key={b} id={`glow-${b}`}>
                <feGaussianBlur stdDeviation="4" result="blur"/>
                <feColorMatrix in="blur" type="matrix" values={`0 0 0 0 ${parseInt(c.slice(1,3),16)/255} 0 0 0 0 ${parseInt(c.slice(3,5),16)/255} 0 0 0 0 ${parseInt(c.slice(5,7),16)/255} 0 0 0 1 0`} result="col"/>
                <feMerge><feMergeNode in="col"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            ))}
          </defs>

          {/* Background radial glow */}
          <ellipse cx={tx(SVG_W/2)} cy={ty(SVG_H/2)} rx={r(420)} ry={r(340)} fill="url(#centerGlow)" opacity="0.7"/>

          {/* Faint grid lines from center (Tech Noir) */}
          {[...Array(16)].map((_,i) => {
            const a = (i / 16) * Math.PI * 2;
            return <line key={i}
              x1={tx(1000)} y1={ty(1000)}
              x2={tx(1000 + Math.cos(a)*1500)} y2={ty(1000 + Math.sin(a)*1500)}
              stroke="rgba(255,255,255,0.015)" strokeWidth="1"/>;
          })}


          {/* ── CONNECTIONS ── */}
          {NODES.map(node => node.requires.map(reqId => {
            const req = NODES.find(n => n.id === reqId)!;
            const bothUnlocked = unlocked(node.id) && unlocked(reqId);
            const partialUnlocked = unlocked(reqId);
            const col = BRANCH_COLOR[node.branch];
            return (
              <line key={`${node.id}-${reqId}`}
                x1={tx(req.x)} y1={ty(req.y)} x2={tx(node.x)} y2={ty(node.y)}
                stroke={bothUnlocked ? col : partialUnlocked ? col+"55" : "#222"}
                strokeWidth={bothUnlocked ? r(2.5) : r(1.5)}
                filter={bothUnlocked ? `url(#glow-${node.branch})` : undefined}
              />
            );
          }))}

          {/* ── NODES ── */}
          {NODES.map(node => {
            const isCore = node.id === "core";
            const isUnlocked = unlocked(node.id);
            const isAvail = available(node);
            const isHov = hovered === node.id;
            const isFlash = flash === node.id;
            const col = BRANCH_COLOR[node.branch];
            const NR = r(isCore ? 36 : 26);
            const IconComp = node.Icon as any;
            const iconPx = Math.round(r(isCore ? 20 : 14));

            return (
              <g key={node.id}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => buy(node)}>

                {/* Outer pulse ring (available) */}
                {isAvail && !isFlash && (
                  <circle cx={tx(node.x)} cy={ty(node.y)} r={NR+r(10)}
                    fill="none" stroke={col} strokeWidth="1" opacity="0.4"
                    strokeDasharray={`${r(5)} ${r(5)}`}/>
                )}
                {/* Flash ring on unlock */}
                {isFlash && (
                  <circle cx={tx(node.x)} cy={ty(node.y)} r={NR+r(18)}
                    fill="none" stroke={col} strokeWidth={r(3)} opacity="0.9"/>
                )}
                {/* Glow halo for unlocked */}
                {isUnlocked && (
                  <circle cx={tx(node.x)} cy={ty(node.y)} r={NR+r(8)}
                    fill="none" stroke={col} strokeWidth="1" opacity="0.25"/>
                )}
                {/* Hover ring */}
                {isHov && (
                  <circle cx={tx(node.x)} cy={ty(node.y)} r={NR+r(6)}
                    fill="none" stroke={col} strokeWidth="1.5" opacity="0.6"/>
                )}

                {/* Main circle */}
                <circle cx={tx(node.x)} cy={ty(node.y)} r={NR}
                  fill={isUnlocked ? `${col}18` : "#080808"}
                  stroke={isUnlocked ? col : isAvail ? col+"88" : "#2a2a2a"}
                  strokeWidth={isUnlocked ? r(2.5) : isHov ? r(1.5) : r(1)}
                  filter={isUnlocked ? `url(#glow-${node.branch})` : undefined}
                />

                {/* Lucide Icon (rendered as foreignObject for proper scaling) */}
                <foreignObject
                  x={tx(node.x) - iconPx/2}
                  y={ty(node.y) - iconPx/2}
                  width={iconPx} height={iconPx}
                  style={{pointerEvents:"none",overflow:"visible"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",height:"100%"}}>
                    <IconComp
                      size={iconPx}
                      color={isUnlocked ? col : isAvail ? col+"99" : "#444"}
                      strokeWidth={isUnlocked ? 2.5 : 1.5}
                    />
                  </div>
                </foreignObject>

                {/* Label text */}
                <text x={tx(node.x)} y={ty(node.y) + NR + r(18)}
                  textAnchor="middle" fontSize={r(12)}
                  fill={isUnlocked ? "#fff" : isAvail ? "#e5e5e5" : "#666"}
                  style={{fontFamily:"'Rajdhani',sans-serif",fontWeight:800,letterSpacing:"0.15em",pointerEvents:"none", textShadow: isUnlocked ? `0 0 8px ${col}` : "0 2px 4px rgba(0,0,0,0.9)"}}>
                  {node.label}
                </text>
                {/* Cost */}
                {!isUnlocked && node.cost > 0 && (
                  <text x={tx(node.x)} y={ty(node.y) + NR + r(28)}
                    textAnchor="middle" fontSize={r(8)}
                    fill={isAvail && affordable(node.cost) ? "#ffd700" : "#444"}
                    style={{fontFamily:"monospace",pointerEvents:"none"}}>
                    {node.cost} CR
                  </text>
                )}
                {isUnlocked && node.id !== "core" && (
                  <text x={tx(node.x)} y={ty(node.y) + NR + r(28)}
                    textAnchor="middle" fontSize={r(8)} fill={col+"aa"}
                    style={{fontFamily:"monospace",pointerEvents:"none"}}>
                    ACTIVE
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* ── INFO PANEL (bottom center, non-blocking) ── */}
        <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-96 transition-all duration-200 pointer-events-none ${hovNode ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
          {hovNode && (
            <div className="border bg-black/95 backdrop-blur-sm p-6 text-center"
              style={{borderColor: BRANCH_COLOR[hovNode.branch]+"44"}}>
              <div className="text-[9px] font-mono tracking-[0.5em] uppercase mb-1.5"
                style={{color: BRANCH_COLOR[hovNode.branch]}}>
                {hovNode.branch} · {hovNode.requires.length === 0 ? "root" : "requires " + hovNode.requires.join(", ")}
              </div>
              <div className="text-white font-mono text-lg tracking-[0.2em] mb-1">{hovNode.label}</div>
              <div className="text-gray-400 text-sm mb-5 leading-relaxed">{hovNode.desc}</div>
              {unlocked(hovNode.id) ? (
                <div className="font-mono text-xs tracking-widest" style={{color: BRANCH_COLOR[hovNode.branch]}}>
                  UNLOCKED & ACTIVE
                </div>
              ) : available(hovNode) ? (
                <div className="pointer-events-auto">
                  <button onClick={() => buy(hovNode)}
                    className="w-full py-3 font-mono text-xs tracking-[0.3em] uppercase transition-all"
                    style={{
                      background: affordable(hovNode.cost) ? BRANCH_COLOR[hovNode.branch] : "transparent",
                      color:      affordable(hovNode.cost) ? "#000" : "#555",
                      border:     `1px solid ${affordable(hovNode.cost) ? BRANCH_COLOR[hovNode.branch] : "#333"}`,
                    }}>
                    {affordable(hovNode.cost)
                      ? `UNLOCK — ${hovNode.cost} CR`
                      : `NEED ${hovNode.cost - stats.credits} MORE CR`}
                  </button>
                </div>
              ) : (
                <div className="font-mono text-xs text-gray-700 tracking-widest">
                  LOCKED — UNLOCK PREREQUISITES FIRST
                </div>
              )}
            </div>
          )}
        </div>

        <div className="absolute z-30 right-3 bottom-3 w-[min(96vw,440px)] sm:w-[440px] max-h-[62vh] overflow-y-auto border border-cyan-300/35 bg-black/80 backdrop-blur-md p-3 pointer-events-auto">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <Hammer size={15} className="text-cyan-200" />
              <div className="font-mono text-xs tracking-[0.28em] text-cyan-100 uppercase">Crafting Tree</div>
            </div>
            <div className="font-mono text-[10px] text-gray-400 uppercase">
              {craftedGear.length}/{CRAFTING_RECIPES.length} Crafted
            </div>
          </div>

          <div className="relative border border-white/10 bg-black/45 h-[220px] mb-2 overflow-hidden">
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {[0, 1].flatMap((row) =>
                [0, 1, 2, 3].map((col) => {
                  const x1 = 12 + col * 19;
                  const x2 = 12 + (col + 1) * 19;
                  const y = row === 0 ? 26 : 74;
                  return (
                    <line
                      key={`h-${row}-${col}`}
                      x1={`${x1}%`}
                      y1={`${y}%`}
                      x2={`${x2}%`}
                      y2={`${y}%`}
                      stroke="rgba(180,210,255,0.24)"
                      strokeWidth="1.2"
                    />
                  );
                })
              )}
              {[0, 1, 2, 3, 4].map((col) => {
                const x = 12 + col * 19;
                return (
                  <line
                    key={`v-${col}`}
                    x1={`${x}%`}
                    y1="26%"
                    x2={`${x}%`}
                    y2="74%"
                    stroke="rgba(180,210,255,0.16)"
                    strokeWidth="1"
                  />
                );
              })}
            </svg>

            {CRAFTING_RECIPES.map((recipe, idx) => {
              const col = idx % 5;
              const row = Math.floor(idx / 5);
              const x = 12 + col * 19;
              const y = row === 0 ? 26 : 74;
              const node = getCraftState(recipe);
              const selected = selectedCraft?.id === recipe.id;
              return (
                <button
                  key={recipe.id}
                  onClick={() => setSelectedCraftId(recipe.id)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <div
                    className="w-11 h-11 rounded-full border flex items-center justify-center transition-all"
                    style={{
                      borderColor: selected ? "#ffffff" : node.statusColor,
                      background: selected ? `${node.statusColor}33` : `${node.statusColor}22`,
                      boxShadow: selected ? `0 0 16px ${node.statusColor}` : `0 0 8px ${node.statusColor}88`,
                    }}
                  >
                    {node.crafted ? (
                      <Check size={16} color="#ffffff" />
                    ) : node.canCraft ? (
                      <Gem size={15} color="#ffffff" />
                    ) : (
                      <Lock size={14} color="#c5c5c5" />
                    )}
                  </div>
                  <div className="w-16 text-center font-mono text-[7px] uppercase tracking-[0.14em] text-gray-300 leading-tight">
                    {recipe.name}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedCraft && (
            <div className="border border-white/12 bg-black/45 px-2.5 py-2">
              {(() => {
                const node = getCraftState(selectedCraft);
                return (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-[11px] tracking-[0.16em] text-white uppercase truncate">{selectedCraft.name}</div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: node.statusColor }}>{node.statusLabel}</div>
                    </div>
                    <div className="font-mono text-[9px] text-gray-400 uppercase mt-1">
                      Level {selectedCraft.unlockLevel} · {selectedCraft.statBoost}
                    </div>
                    <div className="font-mono text-[9px] text-gray-500 mt-0.5">{selectedCraft.effectSummary}</div>

                    <div className="mt-2 grid grid-cols-2 gap-1">
                      {selectedCraft.required.map((materialId) => {
                        const material = MATERIALS_BY_ID[materialId];
                        const owned = materialInventory[materialId] ?? 0;
                        return (
                          <div
                            key={materialId}
                            className="border px-1.5 py-1 flex items-center justify-between"
                            style={{
                              borderColor: owned > 0 ? `${material.color}66` : "rgba(255,255,255,0.12)",
                              background: owned > 0 ? `${material.color}1c` : "rgba(255,255,255,0.03)",
                            }}
                          >
                            <span className="font-mono text-[9px] uppercase truncate pr-2" style={{ color: owned > 0 ? material.color : "#9ca3af" }}>
                              {material.name}
                            </span>
                            <span className="font-mono text-[9px] text-white">{owned}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-500 truncate">
                        {node.crafted
                          ? "Gear installed."
                          : !node.levelReady
                          ? `Need level ${selectedCraft.unlockLevel}.`
                          : node.missing.length
                          ? `Missing: ${node.missing.map((id) => MATERIALS_BY_ID[id].name).join(" + ")}`
                          : "Ready to craft."}
                      </div>
                      <button
                        onClick={() => craftGear(selectedCraft.id)}
                        disabled={!node.canCraft}
                        className="shrink-0 border px-2 py-1 font-mono text-[9px] tracking-[0.18em] uppercase transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{
                          borderColor: node.canCraft ? "#00f2ff99" : "rgba(255,255,255,0.15)",
                          color: node.canCraft ? "#d6fbff" : "#666",
                          background: node.canCraft ? "rgba(0,242,255,0.16)" : "rgba(255,255,255,0.02)",
                        }}
                      >
                        {node.crafted ? "Done" : "Craft"}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          <div className="mt-2 grid grid-cols-5 gap-1">
            {Object.values(MATERIALS_BY_ID).map((material) => (
              <div key={material.id} className="border border-white/10 bg-black/45 px-1.5 py-1 text-center">
                <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ background: material.color }} />
                <div className="font-mono text-[8px] text-white">{materialInventory[material.id] ?? 0}</div>
              </div>
            ))}
          </div>

          {craftNotice && (
            <div className="mt-2 border border-white/10 bg-black/60 px-2 py-1">
              <div className="font-mono text-[9px] tracking-[0.2em] text-cyan-100 uppercase">{craftNotice}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM STATUS BAR ── */}
      <div className="px-8 py-3 border-t border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          {["combat","force","survival"].map(b => {
            const total = NODES.filter(n => n.branch === b).length;
            const have  = NODES.filter(n => n.branch === b && unlocked(n.id)).length;
            return (
              <div key={b} className="flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-widest" style={{color:BRANCH_COLOR[b]}}>{b}</span>
                <div className="w-20 h-0.5 bg-gray-800">
                  <div className="h-full transition-all" style={{width:`${(have/total)*100}%`,background:BRANCH_COLOR[b]}}/>
                </div>
                <span className="font-mono text-[9px] text-gray-600">{have}/{total}</span>
              </div>
            );
          })}
        </div>
        <div className="font-mono text-[9px] text-gray-700 tracking-widest uppercase">
          Earn credits by completing levels & boss fights
        </div>
      </div>
    </div>
  );
}
