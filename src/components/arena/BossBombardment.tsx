"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Sparkles, useGLTF } from "@react-three/drei";
import ARENA_CONFIG from "@/data/arena-config.json";
import SPAWN_TABLE from "@/data/arena-spawn-tables.json";
import { arenaAudio } from "@/lib/arenaAudio";
import { isArenaGameplayActive, useArenaSession } from "@/store/arenaSession";
import { useArenaWorld } from "./world";

const MISSILE_MODEL = "/models/projectiles/orbital-incendiary-missile.glb";
const FALL_DURATION = 1.18;

type IncomingMissile = {
  id: string;
  targetX: number;
  targetZ: number;
  tier: number;
};

function prepareMissile(scene: THREE.Object3D) {
  const clone = scene.clone(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 3.8 / Math.max(size.x, size.y, size.z, 0.001);
  clone.scale.setScalar(scale);
  clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  clone.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      material.envMapIntensity = Math.max(material.envMapIntensity, 1.35);
      if (material.emissiveMap) material.emissiveIntensity = Math.max(material.emissiveIntensity, 1.5);
    }
  });
  return clone;
}

function FallingMissile({
  missile,
  onImpact,
}: {
  missile: IncomingMissile;
  onImpact: (missile: IncomingMissile) => void;
}) {
  const { scene } = useGLTF(MISSILE_MODEL);
  const model = useMemo(() => prepareMissile(scene), [scene]);
  const missileRef = useRef<THREE.Group>(null);
  const warningRef = useRef<THREE.Mesh>(null);
  const age = useRef(0);
  const impacted = useRef(false);
  const drift = useMemo(
    () => ({
      x: Math.sin(missile.targetX * 0.37 + missile.tier) * 4.2,
      z: Math.cos(missile.targetZ * 0.29 - missile.tier) * 3.2,
    }),
    [missile.targetX, missile.targetZ, missile.tier]
  );

  useFrame((_, dt) => {
    if (impacted.current) return;
    age.current += dt;
    const progress = Math.min(1, age.current / FALL_DURATION);
    const eased = progress * progress * (3 - 2 * progress);
    const missileGroup = missileRef.current;
    if (missileGroup) {
      missileGroup.position.set(
        THREE.MathUtils.lerp(missile.targetX + drift.x, missile.targetX, eased),
        THREE.MathUtils.lerp(24, 0.82, eased),
        THREE.MathUtils.lerp(missile.targetZ + drift.z, missile.targetZ, eased)
      );
      missileGroup.rotation.y += dt * 2.8;
      const plunge = 0.9 + Math.sin(progress * Math.PI) * 0.18;
      missileGroup.scale.setScalar(plunge);
    }
    const warning = warningRef.current;
    if (warning) {
      warning.rotation.z += dt * 2.5;
      const pulse = 0.82 + Math.sin(age.current * 13) * 0.14;
      warning.scale.setScalar(pulse);
      const material = warning.material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = 0.32 + progress * 0.58;
      }
    }
    if (progress >= 1) {
      impacted.current = true;
      onImpact(missile);
    }
  });

  return (
    <group>
      <mesh
        ref={warningRef}
        position={[missile.targetX, 0.065, missile.targetZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[2.25, 2.65, 48]} />
        <meshBasicMaterial
          color="#ff3d17"
          transparent
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <group ref={missileRef} rotation={[0, 0, -Math.PI / 2]}>
        <primitive object={model} />
        <Sparkles
          count={18}
          scale={[0.8, 4.8, 0.8]}
          position={[0, 2.2, 0]}
          size={4.2}
          speed={2.2}
          color="#ff6a24"
          opacity={0.9}
        />
        <pointLight color="#ff5522" intensity={18} distance={10} position={[0, 2, 0]} />
      </group>
    </group>
  );
}

export default function BossBombardment() {
  const world = useArenaWorld();
  const [missiles, setMissiles] = useState<IncomingMissile[]>([]);
  const fired = useRef(new Set<string>());

  const impact = useCallback(
    (missile: IncomingMissile) => {
      const session = useArenaSession.getState();
      const impact = new THREE.Vector3(missile.targetX, 0.8, missile.targetZ);
      const radius = 3.25 + missile.tier * 0.16;
      session.triggerCataclysm(missile.targetX, missile.targetZ, radius, 0);
      for (const enemy of world.enemies.values()) {
        if (enemy.health <= 0) continue;
        const dx = enemy.position.x - missile.targetX;
        const dz = enemy.position.z - missile.targetZ;
        if (dx * dx + dz * dz <= radius * radius) enemy.hit(18 + missile.tier * 5);
      }
      const playerDx = world.playerPosition.x - missile.targetX;
      const playerDz = world.playerPosition.z - missile.targetZ;
      if (playerDx * playerDx + playerDz * playerDz <= radius * radius) {
        session.damagePlayer(12 + missile.tier * 2, "ORBITAL INCENDIARY STRIKE");
      }
      world.spawnEffect("nova", impact, "#ff4a16", 1.25);
      world.spawnEffect("ring", impact, "#ffcf40", 1.7);
      world.spawnCombatText(impact.clone().setY(3.1), "INCENDIARY STRIKE", "#ff7a24", 1.75);
      world.triggerHitStop(58);
      world.triggerScreenShake(1.05 + missile.tier * 0.12, 330);
      arenaAudio.sfx("ability");
      setMissiles((current) => current.filter((candidate) => candidate.id !== missile.id));
    },
    [world]
  );

  useFrame(() => {
    const session = useArenaSession.getState();
    if (!isArenaGameplayActive(session)) return;
    const elapsed = ARENA_CONFIG.meta.durationSeconds - session.timeLeft;
    for (const event of SPAWN_TABLE.scripted) {
      const count = 3 + event.count;
      const start = event.second - 9.2;
      for (let index = 0; index < count; index++) {
        const launchSecond = start + (index / Math.max(1, count - 1)) * 7.5;
        const id = `${event.second}:${index}`;
        if (elapsed < launchSecond || elapsed >= event.second || fired.current.has(id)) continue;
        fired.current.add(id);
        const angle = index * 2.399963 + event.count * 0.73;
        const distance = 5.5 + ((index * 37 + event.count * 11) % 8);
        setMissiles((current) => [
          ...current,
          {
            id,
            targetX: world.playerPosition.x + Math.cos(angle) * distance,
            targetZ: world.playerPosition.z + Math.sin(angle) * distance,
            tier: event.count,
          },
        ]);
      }
    }
  });

  return (
    <group>
      {missiles.map((missile) => (
        <FallingMissile key={missile.id} missile={missile} onImpact={impact} />
      ))}
    </group>
  );
}

useGLTF.preload(MISSILE_MODEL);
