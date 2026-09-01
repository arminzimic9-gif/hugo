"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import ARENA_CONFIG from "@/data/arena-config.json";
import type { ArenaOperatorDefinition } from "@/data/arenaOperators";
import type { ArenaPilotAnimationSet } from "@/data/arenaPilots";
import { useArenaSession } from "@/store/arenaSession";
import { useArenaWorld, type ArenaControlMode } from "./world";
import DistrictFloor from "./DistrictFloor";
import Player from "./Player";
import Enemies from "./Enemies";
import Projectiles from "./Projectiles";
import Drops from "./Drops";
import Effects from "./Effects";
import DamageNumbers from "./DamageNumbers";
import BossBombardment from "./BossBombardment";
import HoloFixer from "./HoloFixer";
import ArenaPortal from "./ArenaPortal";
import UndergroundLevel from "./UndergroundLevel";

function AmbientSparkles({ color }: { color: string }) {
  const world = useArenaWorld();
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    groupRef.current?.position.set(world.playerPosition.x, 0, world.playerPosition.z);
  });
  return (
    <group ref={groupRef}>
      <Sparkles
        count={140}
        scale={[80, 10, 80]}
        size={2.2}
        speed={0.25}
        color={color}
        opacity={0.5}
      />
    </group>
  );
}

function SessionTicker() {
  const world = useArenaWorld();
  useFrame((_, dt) => {
    if (performance.now() < world.hitStopUntil) return;
    if (process.env.NODE_ENV === "development") {
      const w = window as unknown as Record<string, number>;
      w.__arenaDt = dt;
      w.__arenaFrames = (w.__arenaFrames ?? 0) + 1;
    }
    useArenaSession.getState().tick(Math.min(dt, 0.1));
  });
  return null;
}

export default function ArenaScene({
  heroModel,
  heroAnimations,
  heroAccent,
  operator,
  controlMode,
}: {
  heroModel: string;
  heroAnimations: ArenaPilotAnimationSet | null;
  heroAccent: string;
  operator: ArenaOperatorDefinition;
  controlMode: ArenaControlMode;
}) {
  const environment = useArenaSession((state) => state.environment);
  const underground = environment === "underground";
  return (
    <>
      <color attach="background" args={[underground ? "#010407" : "#05070d"]} />
      <fog attach="fog" args={[underground ? "#02080c" : "#05070d", underground ? 24 : 34, underground ? 72 : 95]} />
      <ambientLight intensity={underground ? 0.5 : 0.78} color={underground ? "#6ca6a2" : "#a9c8ff"} />
      <directionalLight
        position={[14, 26, 8]}
        intensity={underground ? 0.72 : 1.45}
        color={underground ? "#71ffe0" : "#ffffff"}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
      />
      <directionalLight position={[-12, 10, -16]} intensity={underground ? 0.8 : 0.45} color="#b13bff" />
      <hemisphereLight args={[underground ? "#183d38" : "#27436f", "#010305", underground ? 0.46 : 0.82]} />
      <SessionTicker />
      {underground ? <UndergroundLevel /> : <DistrictFloor />}
      {!underground ? <ArenaPortal /> : null}
      <AmbientSparkles color={underground ? "#62ffd1" : heroAccent} />
      <Player
        heroModel={heroModel}
        heroAnimations={heroAnimations}
        heroAccent={heroAccent}
        operator={operator}
        controlMode={controlMode}
      />
      <Enemies />
      <Projectiles playerAccent={heroAccent} />
      <Drops />
      <Effects />
      <BossBombardment />
      <HoloFixer />
      <DamageNumbers />
      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.35} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette eskil={false} offset={0.18} darkness={0.78} />
      </EffectComposer>
    </>
  );
}

export const ARENA_ACCENT = ARENA_CONFIG.meta.accent;
