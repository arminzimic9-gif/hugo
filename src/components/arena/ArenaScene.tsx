"use client";

import { useFrame } from "@react-three/fiber";
import { Grid, Sparkles } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import ARENA_CONFIG from "@/data/arena-config.json";
import { useArenaSession } from "@/store/arenaSession";
import TileFloor from "./TileFloor";
import Player from "./Player";
import Enemies from "./Enemies";
import Projectiles from "./Projectiles";
import Drops from "./Drops";

function SessionTicker() {
  useFrame((_, dt) => {
    if (process.env.NODE_ENV === "development") {
      const w = window as unknown as Record<string, number>;
      w.__arenaDt = dt;
      w.__arenaFrames = (w.__arenaFrames ?? 0) + 1;
    }
    useArenaSession.getState().tick(Math.min(dt, 0.1));
  });
  return null;
}

export default function ArenaScene({ heroModel }: { heroModel: string }) {
  return (
    <>
      <color attach="background" args={["#05070d"]} />
      <fog attach="fog" args={["#05070d", 34, 95]} />
      <ambientLight intensity={0.55} color="#8fb8ff" />
      <directionalLight
        position={[14, 26, 8]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
      />
      <hemisphereLight args={["#1c2c4a", "#05070d", 0.6]} />
      <SessionTicker />
      <TileFloor />
      <Grid
        position={[0, 0.02, 0]}
        args={[80, 80]}
        cellSize={2}
        cellThickness={0.6}
        cellColor="#0e2a3f"
        sectionSize={10}
        sectionThickness={1.2}
        sectionColor={ARENA_CONFIG.meta.accent}
        fadeDistance={70}
        fadeStrength={2}
        infiniteGrid={false}
      />
      <Sparkles count={140} scale={[80, 10, 80]} size={2.2} speed={0.25} color={ARENA_CONFIG.meta.accent} opacity={0.5} />
      <Player heroModel={heroModel} />
      <Enemies />
      <Projectiles />
      <Drops />
      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.35} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette eskil={false} offset={0.18} darkness={0.78} />
      </EffectComposer>
    </>
  );
}

export const ARENA_ACCENT = ARENA_CONFIG.meta.accent;
