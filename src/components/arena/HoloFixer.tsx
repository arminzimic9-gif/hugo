"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import ARENA_CONFIG from "@/data/arena-config.json";
import { ARENA_CONTRACTS } from "@/data/arenaContracts";
import { useGameStore } from "@/store/gameStore";
import { isArenaGameplayActive, useArenaSession } from "@/store/arenaSession";
import { useArenaWorld } from "./world";

const FIXER_MODEL = "/models/props/relay-tower.glb";
const ENCOUNTER_SECONDS = [75, 255, 435];
const OFFER_SECONDS = 15;
const ACCEPT_RADIUS = 2.8;
const DEFENSE_RADIUS = 6;

type FixerSignal = {
  contractId: string;
  position: THREE.Vector3;
  spawnElapsed: number;
  accepted: boolean;
};

function prepareHologram(scene: THREE.Group): THREE.Group {
  const clone = scene.clone(true);
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = false;
    object.receiveShadow = false;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const hologramMaterials = materials.map((source) => {
      const material = source.clone();
      material.transparent = true;
      material.opacity = 0.76;
      material.depthWrite = false;
      if (material instanceof THREE.MeshStandardMaterial) {
        material.color.set("#6affd5");
        material.emissive.set("#00e8af");
        material.emissiveIntensity = 1.7;
        material.metalness = 0.28;
        material.roughness = 0.32;
      }
      return material;
    });
    object.material = Array.isArray(object.material) ? hologramMaterials : hologramMaterials[0];
  });
  return clone;
}

export default function HoloFixer() {
  const world = useArenaWorld();
  const { scene } = useGLTF(FIXER_MODEL);
  const hologram = useMemo(() => prepareHologram(scene), [scene]);
  const groupRef = useRef<THREE.Group>(null);
  const encounterIndex = useRef(0);
  const signalRef = useRef<FixerSignal | null>(null);
  const [signal, setSignal] = useState<FixerSignal | null>(null);

  const updateSignal = (next: FixerSignal | null) => {
    signalRef.current = next;
    setSignal(next);
  };

  useFrame((_, dt) => {
    const session = useArenaSession.getState();
    const elapsed = ARENA_CONFIG.meta.durationSeconds - session.timeLeft;
    const current = signalRef.current;

    if (groupRef.current && current) {
      groupRef.current.rotation.y += dt * 0.7;
      groupRef.current.position.y = 1.25 + Math.sin(elapsed * 3.2) * 0.18;
    }

    if (!isArenaGameplayActive(session)) return;

    if (!current && !session.activeContract && encounterIndex.current < ENCOUNTER_SECONDS.length) {
      if (elapsed < ENCOUNTER_SECONDS[encounterIndex.current]) return;
      const runOffset = useGameStore.getState().stats.arenaRunsCompleted;
      const contract = ARENA_CONTRACTS[(runOffset + encounterIndex.current) % ARENA_CONTRACTS.length];
      const angle = 0.7 + encounterIndex.current * 2.15;
      const position = world.playerPosition
        .clone()
        .add(new THREE.Vector3(Math.cos(angle) * 7.5, 0, Math.sin(angle) * 7.5));
      updateSignal({ contractId: contract.id, position, spawnElapsed: elapsed, accepted: false });
      session.setFixerOffer(contract.id);
      world.spawnEffect("ring", position.clone().setY(0.2), "#58ffd4", 1.25);
      return;
    }

    if (!current) return;
    const dx = world.playerPosition.x - current.position.x;
    const dz = world.playerPosition.z - current.position.z;
    const distanceSq = dx * dx + dz * dz;

    if (!current.accepted) {
      if (distanceSq <= ACCEPT_RADIUS * ACCEPT_RADIUS && session.startContract(current.contractId)) {
        updateSignal({ ...current, accepted: true });
        world.spawnEffect("nova", current.position.clone().setY(1.2), "#58ffd4", 1.15);
        world.spawnCombatText(
          current.position.clone().setY(3.5),
          "UGOVOR PRIHVAĆEN",
          "#58ffd4",
          1.65
        );
        return;
      }
      if (elapsed - current.spawnElapsed >= OFFER_SECONDS) {
        session.setFixerOffer(null);
        updateSignal(null);
        encounterIndex.current += 1;
      }
      return;
    }

    if (session.activeContract?.kind === "defense") {
      session.advanceDefenseContract(dt, distanceSq <= DEFENSE_RADIUS * DEFENSE_RADIUS);
    }

    if (!session.activeContract) {
      const success = session.contractResult?.status === "complete";
      world.spawnEffect(
        success ? "nova" : "ring",
        current.position.clone().setY(1),
        success ? "#58ffd4" : "#ff4d62",
        success ? 1.7 : 1
      );
      updateSignal(null);
      encounterIndex.current += 1;
    }
  });

  if (!signal) return null;

  return (
    <group position={[signal.position.x, 0, signal.position.z]}>
      <group ref={groupRef} scale={0.68}>
        <primitive object={hologram} />
        <pointLight color="#58ffd4" intensity={4.2} distance={12} decay={2} />
        <Sparkles count={24} scale={[3.5, 4.5, 3.5]} size={4} speed={0.8} color="#58ffd4" />
      </group>
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.09, 10, 56]} />
        <meshStandardMaterial color="#58ffd4" emissive="#20ffc4" emissiveIntensity={3} />
      </mesh>
      <mesh position={[0, 6.5, 0]}>
        <cylinderGeometry args={[0.035, 0.16, 12, 12, 1, true]} />
        <meshBasicMaterial color="#58ffd4" transparent opacity={0.28} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

useGLTF.preload(FIXER_MODEL);
