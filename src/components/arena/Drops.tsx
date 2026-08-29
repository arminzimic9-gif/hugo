"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import ARENA_CONFIG from "@/data/arena-config.json";
import { useArenaSession } from "@/store/arenaSession";
import { useArenaWorld } from "./world";

type Drop = {
  active: boolean;
  position: THREE.Vector3;
  xp: number;
  age: number;
};

const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const tempMatrix = new THREE.Matrix4();
const tempQuat = new THREE.Quaternion();
const tempScale = new THREE.Vector3(1, 1, 1);
const yAxis = new THREE.Vector3(0, 1, 0);

export default function Drops() {
  const world = useArenaWorld();
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const drops = useMemo<Drop[]>(
    () =>
      Array.from({ length: ARENA_CONFIG.limits.drops }, () => ({
        active: false,
        position: new THREE.Vector3(),
        xp: 0,
        age: 0,
      })),
    []
  );

  useEffect(() => {
    world.spawnDrop = (position: THREE.Vector3, xp: number) => {
      const drop = drops.find((d) => !d.active);
      if (!drop) return;
      drop.active = true;
      drop.position.set(position.x, 0.6, position.z);
      drop.xp = xp;
      drop.age = 0;
    };
    return () => {
      world.spawnDrop = () => {};
    };
  }, [world, drops]);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const session = useArenaSession.getState();
    const running = session.phase === "running";
    const pickupRadius = ARENA_CONFIG.player.pickupRadius + session.mods.pickupRadiusAdd;

    drops.forEach((drop, index) => {
      if (drop.active && running) {
        drop.age += dt;
        const dx = world.playerPosition.x - drop.position.x;
        const dz = world.playerPosition.z - drop.position.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < pickupRadius * pickupRadius) {
          const dist = Math.sqrt(distSq) || 0.001;
          const pull = Math.min(1, dt * (14 / Math.max(1.5, dist)) * 6);
          drop.position.x += dx * pull;
          drop.position.z += dz * pull;
          if (dist < 0.7) {
            drop.active = false;
            session.addArenaXp(drop.xp);
            session.addScore(drop.xp * 5);
          }
        }
      }
      if (drop.active) {
        tempQuat.setFromAxisAngle(yAxis, drop.age * 2.4);
        tempMatrix.compose(
          drop.position.clone().setY(0.6 + Math.sin(drop.age * 3) * 0.12),
          tempQuat,
          tempScale
        );
        mesh.setMatrixAt(index, tempMatrix);
      } else {
        mesh.setMatrixAt(index, hiddenMatrix);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, ARENA_CONFIG.limits.drops]} frustumCulled={false}>
      <octahedronGeometry args={[0.28]} />
      <meshStandardMaterial
        color={ARENA_CONFIG.meta.support}
        emissive={ARENA_CONFIG.meta.support}
        emissiveIntensity={1.8}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
