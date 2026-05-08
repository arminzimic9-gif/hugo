"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { ACHIEVEMENTS } from "@/data/achievements";

type Archetype = "vanguard" | "spectre" | "vector";

const HERO_STYLES: Record<Archetype, { label: string; accent: string; lore: string }> = {
  vanguard: { label: "VANGUARD", accent: "#00f2ff", lore: "Brzi front-runner sa stabilnom kontrolom." },
  spectre: { label: "SPECTRE", accent: "#ff1a24", lore: "Agresivan stil sa visokim rizikom i tempom." },
  vector: { label: "VECTOR", accent: "#00ff88", lore: "Precizan operative fokusiran na putanju." },
};

export default function LoginTerminal() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [stage, setStage] = useState<"identity" | "character">("identity");
  const [archetype, setArchetype] = useState<Archetype>("vanguard");
  const [codename, setCodename] = useState("NEON");
  const { login, username, setHeroProfile, stats } = useGameStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (username) router.push("/hub");
  }, [username, router]);

  useEffect(() => {
    if (!input.trim()) return;
    setCodename(input.trim().toUpperCase().slice(0, 12));
  }, [input]);

  // Isometric cube background
  useEffect(() => {
    if (!mounted || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    let tick = 0;
    let animId: number;
    let lastFrame = 0;
    const mouse = { x: W / 2, y: H / 2 };
    const lowPower =
      process.env.NODE_ENV !== "production" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frameInterval = 1000 / 60;

    const CW = 90,
      CH = 45,
      CD = 55;
    const COLS = lowPower ? 9 : 13;
    const ROWS = lowPower ? 9 : 13;

    const cubes: any[] = [];
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const buildGrid = () => {
      cubes.length = 0;
      const startX = -CW;
      const startY = -CH * 2;
      for (let row = -2; row < ROWS + 2; row++) {
        for (let col = -2; col < COLS + 2; col++) {
          const seed = (row * 997 + col * 31 + 7) | 0;
          const rand = (n: number) => {
            const x = Math.sin(seed + n) * 43758;
            return x - Math.floor(x);
          };
          cubes.push({
            col,
            row,
            gx: startX + col * CW + (row % 2 === 0 ? 0 : CW / 2),
            gy: startY + row * (CH * 0.75),
            phase: rand(1) * Math.PI * 2,
            speed: 0.2 + rand(2) * 0.5,
            pulseAmp: 4 + rand(3) * 10,
            hoverT: 0,
            explodeT: 0,
          });
        }
      }
    };

    const poly = (pts: { x: number; y: number }[], fill?: string, strokeCol?: string) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (strokeCol) {
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    };

    const cubePoints = (px: number, py: number, lift = 0, explode = 0) => {
      const y = py - lift;
      const ty = y - explode * 2.5;
      const lx = px - explode * 1.8;
      const ly = y + explode * 0.9;
      const rx = px + explode * 1.8;
      const ry = y + explode * 0.9;
      return {
        top: [
          { x: px, y: ty - CH / 2 },
          { x: px + CW / 2, y: ty },
          { x: px, y: ty + CH / 2 },
          { x: px - CW / 2, y: ty },
        ],
        left: [
          { x: lx - CW / 2, y: ly },
          { x: lx, y: ly + CH / 2 },
          { x: lx, y: ly + CH / 2 + CD },
          { x: lx - CW / 2, y: ly + CD },
        ],
        right: [
          { x: rx, y: ry + CH / 2 },
          { x: rx + CW / 2, y: ry },
          { x: rx + CW / 2, y: ry + CD },
          { x: rx, y: ry + CH / 2 + CD },
        ],
      };
    };

    const pointInPoly = (px: number, py: number, pts: { x: number; y: number }[]) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const { x: xi, y: yi } = pts[i];
        const { x: xj, y: yj } = pts[j];
        if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      buildGrid();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", onResize);

    const draw = (now: number) => {
      animId = requestAnimationFrame(draw);
      if (now - lastFrame < frameInterval) return;
      lastFrame = now;

      tick += 0.016;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, W, H);

      const bg = ctx.createLinearGradient(0, H * 0.3, 0, H);
      bg.addColorStop(0, "rgba(0,0,0,0)");
      bg.addColorStop(0.6, "rgba(140,0,5,0.35)");
      bg.addColorStop(1, "rgba(232,0,10,0.7)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, H * 0.3, W, H);

      const px = (mouse.x / W - 0.5) * 25;
      const py = (mouse.y / H - 0.5) * 12;
      const sc = Math.max(W / (COLS * CW), H / (ROWS * CH * 0.75)) * 1.15;
      const offX = W / 2 + px;
      const offY = H * 0.5 + py;

      cubes.sort((a, b) => a.row - b.row || a.col - b.col);

      for (const c of cubes) {
        const spx = c.gx * sc + offX;
        const spy = c.gy * sc + offY;
        if (spx < -CW * 3 || spx > W + CW * 3 || spy < -CD * 3 || spy > H + CD * 3) continue;

        const geom0 = cubePoints(spx, spy, 0, 0);
        const isHovered =
          pointInPoly(mouse.x, mouse.y, geom0.top) ||
          pointInPoly(mouse.x, mouse.y, geom0.left) ||
          pointInPoly(mouse.x, mouse.y, geom0.right);

        c.hoverT = lerp(c.hoverT, isHovered ? 1 : 0, 0.1);
        const targetExplode =
          c.hoverT * 16 + Math.max(0, Math.sin(tick * 1.5 - c.col * 0.3 + c.row * 0.2)) > 0.95 ? 12 : 0;
        c.explodeT = lerp(c.explodeT, targetExplode, 0.12);

        const breath = Math.sin(tick * c.speed + c.phase) * c.pulseAmp;
        const lift = breath + c.hoverT * 10;
        const geom = cubePoints(spx, spy, lift, c.explodeT);

        const relY = (spy - H * 0.3) / (H * 0.7);
        const fade = Math.max(0, Math.min(1, relY));
        const fl = Math.sin(tick * (0.5 + c.col * 0.1) * 4 + c.phase) * 0.05 + 1;

        const bR = lerp(0, 180, fade) * fl + c.hoverT * 60;
        const lR = bR * 0.5;
        const rR = bR * 0.7;

        poly(geom.left, `rgb(${lR | 0},5,5)`, "rgba(255,255,255,0.03)");
        poly(geom.right, `rgb(${rR | 0},5,5)`, "rgba(255,255,255,0.05)");

        ctx.save();
        if (c.hoverT > 0) {
          ctx.shadowColor = "#e8000a";
          ctx.shadowBlur = 12 * c.hoverT;
        }
        const edgeGlow = `rgba(255,30,20,${Math.max(0.08, c.hoverT * 0.7)})`;
        poly(geom.top, `rgb(${bR | 0},8,8)`, edgeGlow);
        ctx.restore();
      }

      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, H * 0.85);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.88)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    };

    buildGrid();
    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
    };
  }, [mounted]);

  if (!mounted) return null;

  const onIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setStage("character");
  };

  const handleStartMission = () => {
    if (!input.trim()) return;
    setLoading(true);
    const style = HERO_STYLES[archetype];
    setHeroProfile({
      codename: (codename.trim() || input.trim()).toUpperCase().slice(0, 12),
      archetype,
      accent: style.accent,
    });
    setTimeout(() => {
      login(input.toUpperCase());
      router.push("/hub");
    }, 900);
  };

  const unlockedAchievements = stats.achievements ?? [];

  return (
    <div className="fixed inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      <div
        className="absolute inset-0 z-10 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'300\' height=\'300\' filter=\'url(%23n)\' opacity=\'0.08\'/%3E%3C/svg%3E")',
          mixBlendMode: "overlay",
        }}
      />
      <div
        className="absolute inset-0 z-10 pointer-events-none opacity-20"
        style={{
          background: "linear-gradient(to bottom, rgba(255,255,255,0) 50%, rgba(0,0,0,0.12) 50%)",
          backgroundSize: "100% 4px",
        }}
      />

      <div className="absolute top-6 right-6 z-30">
        <button
          onClick={() => setShowAchievements(true)}
          className="border border-gray-700 bg-black/60 px-4 py-2 font-mono text-[10px] tracking-[0.25em] text-gray-300 uppercase hover:text-white hover:border-gray-500 transition-colors"
        >
          Achievements ({unlockedAchievements.length}/{ACHIEVEMENTS.length})
        </button>
      </div>

      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-10 w-full max-w-xl px-6">
          <div className="text-center">
            <h1
              className="font-display text-6xl md:text-7xl text-white tracking-[0.25em] uppercase"
              style={{ textShadow: "0 0 40px rgba(232,0,10,0.8), 0 0 80px rgba(232,0,10,0.4)" }}
            >
              HUGO
            </h1>
            <p className="font-mono text-xs tracking-[0.5em] text-red-500 uppercase mt-2">Neural Overload</p>
          </div>

          {stage === "identity" ? (
            <form onSubmit={onIdentitySubmit} className="flex flex-col gap-6 w-full max-w-sm">
              <div className="relative">
                <label className="block font-mono text-[10px] tracking-[0.4em] text-gray-500 uppercase mb-3">
                  Identify Yourself
                </label>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                  placeholder="ENTER OPERATIVE ID"
                  autoFocus
                  maxLength={12}
                  className="w-full bg-black/60 backdrop-blur border border-gray-700 text-white font-mono py-4 px-4 text-center tracking-[0.3em] uppercase text-sm focus:outline-none focus:border-red-500 transition-colors placeholder:text-gray-700 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-full py-4 bg-red-600 text-white font-display text-xl tracking-[0.3em] uppercase transition-all hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                style={loading ? {} : { boxShadow: "0 0 30px rgba(232,0,10,0.5)" }}
              >
                Configure Operative
              </button>
            </form>
          ) : (
            <div className="w-full max-w-2xl border border-gray-700 bg-black/60 backdrop-blur px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                <div className="border border-gray-800 p-4">
                  <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-gray-500 mb-2">Character Preview</div>
                  <div className="h-52 border border-gray-900 bg-[#060606] flex items-center justify-center relative overflow-hidden">
                    <div
                      className="absolute w-40 h-40 rounded-full blur-3xl opacity-30"
                      style={{ background: HERO_STYLES[archetype].accent }}
                    />
                    <div className="relative flex flex-col items-center gap-3">
                      <div
                        className="w-20 h-20 border-2"
                        style={{
                          borderColor: HERO_STYLES[archetype].accent,
                          boxShadow: `0 0 30px ${HERO_STYLES[archetype].accent}66`,
                        }}
                      />
                      <div
                        className="font-display text-sm tracking-[0.2em]"
                        style={{ color: HERO_STYLES[archetype].accent }}
                      >
                        {HERO_STYLES[archetype].label}
                      </div>
                      <div className="font-mono text-[10px] text-gray-300 tracking-[0.2em] uppercase">{codename}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block font-mono text-[9px] uppercase tracking-[0.3em] text-gray-500 mb-2">
                      Codename
                    </label>
                    <input
                      value={codename}
                      onChange={(e) => setCodename(e.target.value.toUpperCase().slice(0, 12))}
                      maxLength={12}
                      className="w-full border border-gray-700 bg-black/40 px-3 py-2 font-mono text-sm text-white tracking-[0.2em] uppercase focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(HERO_STYLES).map(([key, style]) => (
                      <button
                        key={key}
                        onClick={() => setArchetype(key as Archetype)}
                        className={`border px-2 py-3 transition-colors ${
                          archetype === key ? "border-white bg-white/10" : "border-gray-800 bg-black/30 hover:border-gray-600"
                        }`}
                      >
                        <div className="font-mono text-[9px] tracking-[0.15em]" style={{ color: style.accent }}>
                          {style.label}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="font-mono text-[10px] text-gray-400 leading-relaxed min-h-10">
                    {HERO_STYLES[archetype].lore}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setStage("identity")}
                      className="px-4 py-3 border border-gray-700 font-mono text-xs tracking-[0.2em] uppercase text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleStartMission}
                      disabled={loading || !input.trim()}
                      className="flex-1 py-3 bg-red-600 text-white font-display text-lg tracking-[0.2em] uppercase hover:bg-red-500 disabled:opacity-40 transition-colors"
                    >
                      {loading ? "Initializing..." : "Start Mission"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <p className="font-mono text-[10px] text-gray-600 tracking-widest uppercase">
            System v3.2 - Professional Demo Build
          </p>
        </div>
      </div>

      {showAchievements && (
        <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl border border-gray-700 bg-[#050505] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl text-white tracking-[0.2em] uppercase">Achievements</h2>
              <button
                onClick={() => setShowAchievements(false)}
                className="border border-gray-700 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-300 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto app-scroll pr-1">
              {ACHIEVEMENTS.map((achievement) => {
                const unlocked = unlockedAchievements.includes(achievement.id);
                return (
                  <div
                    key={achievement.id}
                    className={`border px-3 py-3 ${unlocked ? "border-green-500/40 bg-green-500/10" : "border-gray-800 bg-black/40"}`}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <div
                        className={`w-9 h-9 flex items-center justify-center border font-mono text-[10px] ${
                          unlocked ? "border-green-400 text-green-300" : "border-gray-700 text-gray-500"
                        }`}
                      >
                        {achievement.icon}
                      </div>
                      <div className="font-mono text-xs tracking-[0.15em] uppercase text-white">{achievement.name}</div>
                    </div>
                    <div className="font-mono text-[10px] text-gray-500 tracking-[0.05em]">{achievement.description}</div>
                    <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-gray-600">
                      {unlocked ? "Unlocked" : "Locked"}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-gray-500">
              Progress: {unlockedAchievements.length}/{ACHIEVEMENTS.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
