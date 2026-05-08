"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type OverseerBossProps = {
  phase?: number;
  color?: string;
  accent?: string;
  pulse?: number;
  active?: boolean;
};

type RuntimeParams = {
  phase: number;
  color: string;
  accent: string;
  pulse: number;
  active: boolean;
};

const FRAME_CAP = 50;

export default function OverseerBoss({
  phase = 1,
  color = "#ef4444",
  accent = "#ffb26b",
  pulse = 0,
  active = true,
}: OverseerBossProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paramsRef = useRef<RuntimeParams>({
    phase,
    color,
    accent,
    pulse,
    active,
  });

  useEffect(() => {
    paramsRef.current = { phase, color, accent, pulse, active };
  }, [phase, color, accent, pulse, active]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 8.2);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1));
    container.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(2.15, 0.09, 12, 68),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#ff5a5a"),
        emissive: new THREE.Color("#ff2d2d"),
        emissiveIntensity: 0.8,
        roughness: 0.25,
        metalness: 0.3,
        transparent: true,
        opacity: 0.95,
      })
    );
    halo.rotation.x = Math.PI * 0.5;
    root.add(halo);

    const frameEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.2, 2.2, 2.2)),
      new THREE.LineBasicMaterial({ color: "#ff2d2d", transparent: true, opacity: 0.88 })
    );
    root.add(frameEdges);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.08, 1),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#3c3c3c"),
        emissive: new THREE.Color("#ff4b4b"),
        emissiveIntensity: 1.1,
        roughness: 0.3,
        metalness: 0.45,
      })
    );
    root.add(core);

    const pupil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 1.25, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#070707"),
        transparent: true,
        opacity: 0.94,
      })
    );
    pupil.rotation.z = Math.PI * 0.5;
    root.add(pupil);

    const shardGroup = new THREE.Group();
    const shardGeometry = new THREE.ConeGeometry(0.15, 0.75, 4);
    const shardMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ffd480"),
      emissive: new THREE.Color("#ff6a3d"),
      emissiveIntensity: 0.75,
      roughness: 0.28,
      metalness: 0.2,
    });

    for (let i = 0; i < 10; i++) {
      const shard = new THREE.Mesh(shardGeometry, shardMaterial);
      const angle = (i / 10) * Math.PI * 2;
      const radius = 2.55 + (i % 2) * 0.28;
      shard.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.45, 0);
      shard.lookAt(0, 0, 0);
      shard.rotation.z += Math.PI * 0.5;
      shardGroup.add(shard);
    }
    root.add(shardGroup);

    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    const key = new THREE.PointLight(0xff3a3a, 6.8, 30, 1.9);
    key.position.set(0, 0.8, 6.2);
    const rim = new THREE.PointLight(0xffa762, 4.6, 28, 1.8);
    rim.position.set(-4.4, -0.4, 3.6);
    scene.add(ambient, key, rim);

    let width = 0;
    let height = 0;
    const resize = () => {
      const nextWidth = Math.max(1, container.clientWidth | 0);
      const nextHeight = Math.max(1, container.clientHeight | 0);
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    window.addEventListener("resize", resize);

    const cachedColor = {
      color: new THREE.Color("#ef4444"),
      accent: new THREE.Color("#ffb26b"),
    };
    const clock = new THREE.Clock();
    const minFrameTime = 1000 / FRAME_CAP;
    let rafId = 0;
    let lastFrameAt = 0;

    const render = (now: number) => {
      rafId = requestAnimationFrame(render);
      if (now - lastFrameAt < minFrameTime) return;
      lastFrameAt = now;

      const runtime = paramsRef.current;
      root.visible = runtime.active;
      if (!runtime.active) return;

      const t = clock.getElapsedTime();
      const phaseAmp = Math.max(1, Math.min(3, runtime.phase));
      const pulseAmp = Math.max(0, Math.min(1.4, runtime.pulse));

      if (runtime.color !== `#${cachedColor.color.getHexString()}`) {
        cachedColor.color.set(runtime.color);
      }
      if (runtime.accent !== `#${cachedColor.accent.getHexString()}`) {
        cachedColor.accent.set(runtime.accent);
      }

      (core.material as THREE.MeshStandardMaterial).emissive.copy(cachedColor.color);
      (core.material as THREE.MeshStandardMaterial).color.setRGB(
        0.18 + cachedColor.color.r * 0.28,
        0.18 + cachedColor.color.g * 0.2,
        0.18 + cachedColor.color.b * 0.2
      );
      (halo.material as THREE.MeshStandardMaterial).color.copy(cachedColor.accent);
      (halo.material as THREE.MeshStandardMaterial).emissive.copy(cachedColor.color);
      (halo.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.75 + phaseAmp * 0.24 + pulseAmp * 0.5;
      (frameEdges.material as THREE.LineBasicMaterial).color.copy(cachedColor.color);
      (shardMaterial.emissive as THREE.Color).copy(cachedColor.accent);

      core.rotation.y += 0.014 + phaseAmp * 0.003;
      core.rotation.x = Math.sin(t * 0.9) * 0.28;
      pupil.rotation.x = Math.sin(t * 2.1) * 0.1;

      const baseScale = 1 + Math.sin(t * (1.35 + phaseAmp * 0.25)) * 0.05 + pulseAmp * 0.26;
      core.scale.setScalar(baseScale);
      halo.scale.setScalar(1 + pulseAmp * 0.16 + Math.sin(t * 2.8) * 0.03);
      halo.rotation.z += 0.004 + phaseAmp * 0.0015;
      frameEdges.rotation.y -= 0.005 + phaseAmp * 0.0015;
      frameEdges.rotation.x = Math.sin(t * 0.7) * 0.18;

      shardGroup.rotation.z += 0.008 + phaseAmp * 0.001;
      shardGroup.rotation.y -= 0.003 + phaseAmp * 0.001;

      key.intensity = 5.2 + phaseAmp * 1.2 + pulseAmp * 2;
      rim.intensity = 3.5 + phaseAmp * 0.8;

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);

      scene.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat: THREE.Material) => mat.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      });

      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full pointer-events-none" />;
}
