"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { CURSORS } from "@/data/cursors";
import { usePathname } from "next/navigation";

export default function CustomCursor() {
  const { stats } = useGameStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();
  const mouse = useRef({ x: -999, y: -999 });
  const particles = useRef<any[]>([]);
  const trail = useRef<any[]>([]);
  const tick = useRef(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    const handleClick = (e: MouseEvent) => {
      const activeId = stats.activeCursorId || 1;
      const active = CURSORS.find(c => c.id === activeId) || CURSORS[0];
      const clientX = e.clientX, clientY = e.clientY;

      if (active.id === 1) { // Neon Pulse
        for(let i=0; i<3; i++) trail.current.push({ x: clientX, y: clientY, life: 1.0, isRing: true, size: 5 + i*15 });
      } else if (active.id === 2) { // Pixel Blast
        for(let i=0; i<15; i++) {
          particles.current.push({
            x: clientX, y: clientY, vx: (Math.random()-0.5)*20, vy: (Math.random()-0.5)*20,
            life: 1, color: active.color, size: 4 + Math.random()*6, isPixel: true
          });
        }
      } else if (active.id === 3) { // Ghost Trail
        for(let i=0; i<8; i++) {
          const a = (i/8)*Math.PI*2;
          trail.current.push({ x: clientX + Math.cos(a)*20, y: clientY + Math.sin(a)*20, life: 0.8, isGhost: true });
        }
      } else if (active.id === 4) { // Cyber Blade
        for(let i=0; i<3; i++) {
          particles.current.push({ x: clientX, y: clientY, vx: (Math.random()-0.5)*40, vy: (Math.random()-0.5)*5, life: 0.5, color: '#ffffff', size: 2, isSlash: true });
        }
      } else if (active.id === 5) { // Liquid Mercury
        for(let i=0; i<12; i++) {
          particles.current.push({ x: clientX, y: clientY, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 1, color: active.color, size: 3 + Math.random()*5, isFluid: true });
        }
      } else if (active.id === 6) { // Data Stream
        for(let i=0; i<10; i++) {
          trail.current.push({ x: clientX + (Math.random()-0.5)*40, y: clientY + (Math.random()-0.5)*40, life: 1, isData: true });
        }
      } else if (active.id === 7) { // Solar Flare
        for(let i=0; i<20; i++) {
          particles.current.push({ x: clientX, y: clientY, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 1, color: '#ff4400', size: 2 + Math.random()*8, isFire: true });
        }
      } else if (active.id === 9) { // Void Walker
        for(let i=0; i<20; i++) {
          const a = Math.random()*Math.PI*2;
          const r = 50 + Math.random()*50;
          particles.current.push({ x: clientX + Math.cos(a)*r, y: clientY + Math.sin(a)*r, vx: -Math.cos(a)*4, vy: -Math.sin(a)*4, life: 1, color: '#ffffff', size: 2, isVoid: true });
        }
      } else if (active.id === 10) { // Star Dust
        for(let i=0; i<15; i++) {
          particles.current.push({ x: clientX, y: clientY, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 1.5, color: '#ffd700', size: 2 + Math.random()*3, isStar: true });
        }
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleClick);
    };
  }, [stats.activeCursorId]);

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame: number;
    const lowPower = process.env.NODE_ENV !== "production" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frameInterval = 1000 / 60;
    const maxTrail = lowPower ? 80 : 180;
    const maxParticles = lowPower ? 120 : 260;
    let lastFrame = 0;

    const render = (now: number) => {
      animationFrame = requestAnimationFrame(render);
      if (now - lastFrame < frameInterval) return;
      lastFrame = now;

      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const activeId = stats.activeCursorId || 1;
      const active = CURSORS.find(c => c.id === activeId) || CURSORS[0];
      tick.current++;

      // 1. Trail
      if (mouse.current.x !== -999) {
        if (active.type === 'trail' || active.type === 'data') {
          trail.current.push({ x: mouse.current.x, y: mouse.current.y, life: 1.0 });
        }
      }
      trail.current = trail.current.filter(t => {
        t.life -= 0.05;
        if (t.life > 0) {
          ctx.globalAlpha = t.life * 0.5;
          if (t.isRing) {
            ctx.strokeStyle = active.color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(t.x, t.y, t.size * (2-t.life), 0, Math.PI*2); ctx.stroke();
          } else if (t.isGhost) {
            ctx.fillStyle = active.color;
            ctx.beginPath(); ctx.moveTo(t.x, t.y-8); ctx.lineTo(t.x+8, t.y+8); ctx.lineTo(t.x-8, t.y+8); ctx.closePath(); ctx.fill();
          } else if (t.isData || active.type === 'data') {
            ctx.fillStyle = active.color;
            ctx.font = '10px monospace';
            ctx.fillText(Math.random() > 0.5 ? '1' : '0', t.x, t.y + (1-t.life)*50);
          } else if (active.type === 'trail') {
            ctx.strokeStyle = active.color;
            ctx.strokeRect(t.x - 10, t.y - 10, 20, 20);
          }
          return true;
        }
        return false;
      });
      if (trail.current.length > maxTrail) {
        trail.current = trail.current.slice(-maxTrail);
      }

      // 2. Particles
      particles.current = particles.current.filter(p => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.02;
        if (p.life > 0) {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          if (p.isSlash) {
            ctx.lineWidth = p.size; ctx.strokeStyle = p.color;
            ctx.beginPath(); ctx.moveTo(p.x - 20*p.life, p.y); ctx.lineTo(p.x + 20*p.life, p.y); ctx.stroke();
          } else if (p.isFire) {
            ctx.shadowBlur = 10; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
          } else if (p.isStar) {
            const s = p.size * p.life;
            ctx.beginPath(); ctx.moveTo(p.x, p.y-s); ctx.lineTo(p.x+s, p.y); ctx.lineTo(p.x, p.y+s); ctx.lineTo(p.x-s, p.y); ctx.closePath(); ctx.fill();
          } else if (p.isPixel) ctx.fillRect(p.x, p.y, p.size, p.size);
          else {
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
          }
          return true;
        }
        return false;
      });
      if (particles.current.length > maxParticles) {
        particles.current = particles.current.slice(-maxParticles);
      }

      // 3. Main Cursor Body & Core FX
      if (mouse.current.x !== -999) {
        const cx = mouse.current.x, cy = mouse.current.y;
        
        // --- UNIVERSAL CORE ---
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffffff';
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0; 
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke(); 
        
        if (active.type === 'glow') {
          const pulse = 1 + Math.sin(tick.current * 0.15) * 0.3;
          ctx.shadowColor = active.color;
          ctx.shadowBlur = 20 * pulse;
          ctx.strokeStyle = active.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(cx - 15 * pulse, cy); ctx.lineTo(cx - 5, cy);
          ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 15 * pulse, cy);
          ctx.moveTo(cx, cy - 15 * pulse); ctx.lineTo(cx, cy - 5);
          ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 15 * pulse);
          ctx.stroke();
        } else if (active.type === 'particles') {
          ctx.fillStyle = active.color;
          ctx.shadowColor = active.color;
          ctx.shadowBlur = 10;
          for(let i=0; i<4; i++) {
             const angle = (tick.current * 0.05) + (i * Math.PI/2);
             ctx.fillRect(cx + Math.cos(angle)*12 - 2, cy + Math.sin(angle)*12 - 2, 4, 4);
          }
          ctx.strokeStyle = active.color;
          ctx.lineWidth = 1;
          ctx.strokeRect(cx - 6, cy - 6, 12, 12);
        } else if (active.type === 'trail') {
          ctx.strokeStyle = active.color;
          ctx.lineWidth = 2;
          ctx.shadowColor = active.color;
          ctx.shadowBlur = 15;
          ctx.beginPath(); ctx.moveTo(cx, cy-8); ctx.lineTo(cx+8, cy+8); ctx.lineTo(cx-8, cy+8); ctx.closePath(); ctx.stroke();
        } else if (active.type === 'sharp') {
          ctx.strokeStyle = active.color;
          ctx.shadowColor = active.color;
          ctx.shadowBlur = 15;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx, cy-4); ctx.lineTo(cx+20, cy+20); ctx.lineTo(cx-4, cy); ctx.closePath(); ctx.stroke();
          ctx.fillStyle = active.color + '44'; ctx.fill();
        } else if (active.type === 'fluid') {
          ctx.fillStyle = active.color + 'aa';
          ctx.shadowColor = active.color;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          for(let i=0; i<8; i++) {
            const a = (i/8)*Math.PI*2;
            const r = 8 + Math.sin(tick.current*0.15 + i) * 4;
            ctx.lineTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r);
          }
          ctx.closePath(); ctx.fill();
        } else if (active.type === 'data') {
          ctx.fillStyle = active.color;
          ctx.font = '14px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = active.color;
          ctx.shadowBlur = 10;
          ctx.fillText('<o>', cx, cy);
        } else if (active.type === 'flare') {
          for(let i=0; i<3; i++) {
            particles.current.push({
              x: cx + (Math.random()-0.5)*10, y: cy + (Math.random()-0.5)*10,
              vx: (Math.random()-0.5)*1, vy: -Math.random()*4 - 1,
              life: 1, color: active.color, size: Math.random()*4 + 2, isPixel: false
            });
          }
          ctx.fillStyle = active.color + '88';
          ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2); ctx.fill();
        } else if (active.type === 'glitch') {
          let offset = tick.current % 15 < 5 ? (Math.random()-0.5)*8 : 0;
          ctx.fillStyle = '#ff00ff'; ctx.fillRect(cx - 8 + offset, cy - 8 - offset, 16, 16);
          ctx.fillStyle = '#00ffff'; ctx.fillRect(cx - 8 - offset, cy - 8 + offset, 16, 16);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 6, cy - 6, 12, 12);
        } else if (active.type === 'void') {
          ctx.fillStyle = '#000000';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = active.color === '#000000' ? '#ffffff' : active.color;
          ctx.beginPath(); ctx.arc(cx, cy, 18, tick.current*0.1, tick.current*0.1 + Math.PI); ctx.stroke();
        } else if (active.type === 'dust') {
          if (tick.current % 2 === 0) {
            particles.current.push({
              x: cx + (Math.random()-0.5)*15, y: cy + (Math.random()-0.5)*15,
              vx: (Math.random()-0.5)*2, vy: Math.random()*2 + 1,
              life: 1, color: active.color, size: Math.random()*3 + 1, isPixel: true
            });
          }
          ctx.fillStyle = active.color;
          ctx.shadowColor = active.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(cx, cy-10); ctx.lineTo(cx+2, cy-2); ctx.lineTo(cx+10, cy); ctx.lineTo(cx+2, cy+2);
          ctx.lineTo(cx, cy+10); ctx.lineTo(cx-2, cy+2); ctx.lineTo(cx-10, cy); ctx.lineTo(cx-2, cy-2);
          ctx.closePath(); ctx.fill();
        } else {
          ctx.strokeStyle = active.color;
          ctx.lineWidth = 2;
          ctx.strokeRect(cx - 6, cy - 6, 12, 12);
        }
      }
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [mounted, stats.activeCursorId]);

  // Hide custom cursor on the play area because it has its own implementation
  if (pathname === "/play") return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ cursor: 'none' }}
    />
  );
}
