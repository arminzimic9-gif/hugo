"use client";
import { useEffect, useRef } from "react";

const SECTOR_COLORS: Record<number, { primary: string; secondary: string; rgb: string }> = {
  1: { primary: "#00f2ff", secondary: "#004455", rgb: "0,242,255" },
  2: { primary: "#ff1a24", secondary: "#440005", rgb: "255,26,36" },
  3: { primary: "#bc13fe", secondary: "#2a0044", rgb: "188,19,254" },
  4: { primary: "#00ff88", secondary: "#004422", rgb: "0,255,136" },
  5: { primary: "#ffffff", secondary: "#222222", rgb: "255,255,255" },
  99: { primary: "#ff00a2", secondary: "#44002b", rgb: "255,0,162" },
};

interface LevelBackgroundProps {
  sectorId: number;
  levelInSector: number;
}

export default function LevelBackground({ sectorId, levelInSector }: LevelBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sector = SECTOR_COLORS[sectorId] ?? SECTOR_COLORS[1];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let t = 0;
    const frameInterval = 1000 / 60;
    let lastFrame = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Parse hex to rgb
    const [r, g, b] = sector.rgb.split(",").map(Number);

    const draw = (now: number) => {
      animId = requestAnimationFrame(draw);
      if (now - lastFrame < frameInterval) return;
      lastFrame = now;

      t += 0.008;
      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      // Slow pulse background
      const pulse = (Math.sin(t * (0.45 + levelInSector * 0.01)) + 1) / 2;
      const bgAlpha = 0.03 + pulse * 0.03;
      ctx.fillStyle = `rgba(${r},${g},${b},${bgAlpha})`;
      ctx.fillRect(0, 0, W, H);

      // Animated grid lines
      const gridSize = 80;
      const offset = (t * (20 + levelInSector)) % gridSize;

      ctx.lineWidth = 0.5;

      // Vertical lines
      for (let x = -gridSize + offset; x < W + gridSize; x += gridSize) {
        const distFromCenter = Math.abs(x - W / 2) / (W / 2);
        const alpha = (0.06 + pulse * 0.04) * (1 - distFromCenter * 0.5);
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = -gridSize + offset; y < H + gridSize; y += gridSize) {
        const distFromCenter = Math.abs(y - H / 2) / (H / 2);
        const alpha = (0.06 + pulse * 0.04) * (1 - distFromCenter * 0.5);
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Scan line that travels across screen
      const scanY = ((t * 80) % (H + 200)) - 100;
      const scanGrad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      scanGrad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      scanGrad.addColorStop(0.5, `rgba(${r},${g},${b},0.08)`);
      scanGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 40, W, 80);

      // Corner accent glows
      const cornerGlow = (cx: number, cy: number) => {
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200);
        grd.addColorStop(0, `rgba(${r},${g},${b},${0.08 + pulse * 0.05})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grd;
        ctx.fillRect(cx - 200, cy - 200, 400, 400);
      };
      cornerGlow(0, 0);
      cornerGlow(W, 0);
      cornerGlow(0, H);
      cornerGlow(W, H);

    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [sectorId, sector.rgb, levelInSector]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none"
      style={{ opacity: 0.9 }}
    />
  );
}
