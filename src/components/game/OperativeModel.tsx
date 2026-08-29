"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type OperativeModelProps = {
  modelUrl: string;
  accent: string;
  label: string;
  fallbackImage: string;
  className?: string;
};

const FRAME_CAP = 45;

export default function OperativeModel({
  modelUrl,
  accent,
  label,
  fallbackImage,
  className = "",
}: OperativeModelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let visible = true;
    let pageVisible = document.visibilityState === "visible";
    let width = 0;
    let height = 0;
    let rafId = 0;
    let lastFrameAt = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
    camera.position.set(0, 0.12, 6.65);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        premultipliedAlpha: false,
      });
    } catch {
      setStatus("error");
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.86;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(1.35, window.devicePixelRatio || 1));
    renderer.domElement.className = "absolute inset-0 h-full w-full";
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.58;
    controls.minPolarAngle = Math.PI * 0.32;
    controls.maxPolarAngle = Math.PI * 0.68;
    controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotateSpeed = 0.42;

    const stage = new THREE.Group();
    scene.add(stage);

    const accentColor = new THREE.Color(accent);
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.32, 1.52, 0.055, 48),
      new THREE.MeshStandardMaterial({
        color: 0x071014,
        emissive: accentColor,
        emissiveIntensity: 0.12,
        metalness: 0.86,
        roughness: 0.32,
        transparent: true,
        opacity: 0.88,
      }),
    );
    platform.position.y = -1.64;
    stage.add(platform);

    const platformRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.42, 0.012, 8, 80),
      new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.58 }),
    );
    platformRing.rotation.x = Math.PI / 2;
    platformRing.position.y = -1.6;
    stage.add(platformRing);

    scene.add(new THREE.HemisphereLight(0xaedfff, 0x020305, 0.72));
    const key = new THREE.DirectionalLight(0xd7f5ff, 1.35);
    key.position.set(-3.2, 4.8, 4.2);
    const rim = new THREE.PointLight(accentColor, 2.8, 16, 1.7);
    rim.position.set(3.1, 1.8, 2.1);
    const underGlow = new THREE.PointLight(0x00cce8, 0.9, 9, 1.8);
    underGlow.position.set(-1.2, -1.4, 1.4);
    scene.add(key, rim, underGlow);

    let model: THREE.Object3D | null = null;
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) {
          gltf.scene.traverse((object) => {
            const mesh = object as THREE.Mesh;
            mesh.geometry?.dispose();
          });
          return;
        }

        model = gltf.scene;
        model.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.frustumCulled = true;
        });

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = 3.2 / Math.max(0.001, size.y);
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        stage.add(model);
        setStatus("ready");
      },
      undefined,
      () => {
        if (!disposed) setStatus("error");
      },
    );

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
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    intersectionObserver.observe(container);

    const onVisibilityChange = () => {
      pageVisible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startedAt = performance.now();
    const minFrameTime = 1000 / FRAME_CAP;
    const render = (now: number) => {
      rafId = requestAnimationFrame(render);
      if (!visible || !pageVisible || now - lastFrameAt < minFrameTime) return;
      lastFrameAt = now;
      const time = (now - startedAt) / 1000;
      if (!reducedMotion) {
        stage.position.y = Math.sin(time * 0.85) * 0.025;
        platformRing.rotation.z += 0.0028;
        rim.intensity = 2.6 + Math.sin(time * 1.7) * 0.3;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose());
        } else {
          mesh.material?.dispose();
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [accent, modelUrl]);

  return (
    <div
      className={`relative h-full w-full cursor-grab overflow-hidden active:cursor-grabbing ${className}`}
      aria-label={`${label} 3D operative preview`}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {status !== "ready" && (
        <Image
          src={fallbackImage}
          alt=""
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          loading="eager"
          className="object-contain object-center opacity-45"
        />
      )}
      {status === "loading" && (
        <div className="absolute inset-x-0 top-1/2 z-10 text-center font-mono text-[8px] uppercase tracking-normal text-white/45">
          Loading 3D chassis
        </div>
      )}
    </div>
  );
}
