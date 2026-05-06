"use client";

import { useEffect, useRef } from "react";

export default function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    const lowPower = process.env.NODE_ENV !== "production" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frameInterval = 1000 / 60;
    let lastFrame = 0;

    let particles: {x: number, y: number, vx: number, vy: number, size: number}[] = [];
    const numParticles = lowPower ? 35 : 80;

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1
      });
    }

    let animationFrameId: number;

    const render = (now: number) => {
      animationFrameId = requestAnimationFrame(render);
      if (now - lastFrame < frameInterval) return;
      lastFrame = now;

      // Resize handling inside loop
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }

      ctx.clearRect(0, 0, width, height);

      // Draw connections
      ctx.lineWidth = 1;
      for (let i = 0; i < numParticles; i++) {
        for (let j = i + 1; j < numParticles; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(34, 211, 238, ${1 - dist / 150})`; // Cyan with dynamic opacity
            ctx.stroke();
          }
        }
      }

      // Draw and move particles
      for (let i = 0; i < numParticles; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        
        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#22d3ee";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

    };

    animationFrameId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none opacity-20 z-0"
    />
  );
}
