"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import ARENA_CONFIG from "@/data/arena-config.json";
import { MATERIALS_BY_ID, type MaterialId } from "@/data/crafting";
import {
  ARENA_POWER_DROPS,
  type ArenaPowerDropId,
} from "@/data/arenaPowerDrops";
import { artifactTransmission } from "@/data/arenaStory";
import { arenaAudio } from "@/lib/arenaAudio";
import {
  useArenaSession,
  type ArenaBossRewardId,
} from "@/store/arenaSession";
import { useGameStore } from "@/store/gameStore";
import { useArenaWorld } from "./world";

type Drop = {
  active: boolean;
  kind: "xp" | "health" | "material" | "power" | "relic" | "bossReward";
  position: THREE.Vector3;
  amount: number;
  age: number;
  materialId: MaterialId;
  powerId: ArenaPowerDropId;
  bossRewardId: ArenaBossRewardId;
};

const BOSS_REWARDS: Record<
  ArenaBossRewardId,
  {
    label: string;
    color: string;
    tier: 1 | 2 | 3;
    materials: Partial<Record<MaterialId, number>>;
  }
> = {
  artifact_spark: {
    label: "ARTIFACT SPARK BOUND · PROTOTYPE AWAKENED",
    color: "#eaffff",
    tier: 1,
    materials: { crystal_dust: 2, iron_shard: 2 },
  },
  class_augment: {
    label: "CLASS AUGMENT BOUND · SPECIALIZATION ONLINE",
    color: "#c58cff",
    tier: 2,
    materials: { plasma_core: 2, neon_circuit: 2, void_thread: 1 },
  },
  mythic_core: {
    label: "MYTHIC CORE BOUND · CAPSTONE ONLINE",
    color: "#ffca58",
    tier: 3,
    materials: { ancient_gear_core: 2, solar_fragment: 2, titanium_plate: 2 },
  },
};

const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const tempMatrix = new THREE.Matrix4();
const tempQuat = new THREE.Quaternion();
const tempScale = new THREE.Vector3(1, 1, 1);
const tempPosition = new THREE.Vector3();
const tempColor = new THREE.Color();
const yAxis = new THREE.Vector3(0, 1, 0);
const DROP_MODEL = "/models/pickups/data-core.glb";
const HEALTH_MODEL = "/models/pickups/health-core.glb";
const RELIC_MODEL = DROP_MODEL;

function prepareDropModel(scene: THREE.Object3D, label: string, targetSize = 0.85): {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
} {
  scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child);
  });
  const source = meshes[0];
  if (!source) throw new Error(`${label} GLB does not contain a mesh`);

  const geometry = source.geometry.clone();
  geometry.applyMatrix4(source.matrixWorld);
  geometry.computeBoundingBox();
  const initialSize = geometry.boundingBox!.getSize(new THREE.Vector3());
  // Najtanja osa postaje Y, pa se lice core-a vidi iz top-down kamere.
  if (initialSize.x <= initialSize.y && initialSize.x <= initialSize.z) {
    geometry.rotateZ(Math.PI / 2);
  } else if (initialSize.z <= initialSize.x && initialSize.z <= initialSize.y) {
    geometry.rotateX(Math.PI / 2);
  }
  geometry.center();
  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new THREE.Vector3());
  const scale = targetSize / Math.max(size.x, size.y, size.z, 0.001);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingSphere();

  const sourceMaterial = Array.isArray(source.material) ? source.material[0] : source.material;
  const material = sourceMaterial.clone();
  if (material instanceof THREE.MeshStandardMaterial) {
    material.envMapIntensity = Math.max(material.envMapIntensity, 1.3);
    material.emissive.set("#ffffff");
    material.emissiveIntensity = Math.max(material.emissiveIntensity, 0.14);
  }
  return { geometry, material };
}

export default function Drops() {
  const world = useArenaWorld();
  const xpMeshRef = useRef<THREE.InstancedMesh>(null);
  const healthMeshRef = useRef<THREE.InstancedMesh>(null);
  const materialMeshRef = useRef<THREE.InstancedMesh>(null);
  const relicMeshRef = useRef<THREE.InstancedMesh>(null);
  const xpGlowRef = useRef<THREE.InstancedMesh>(null);
  const healthGlowRef = useRef<THREE.InstancedMesh>(null);
  const materialGlowRef = useRef<THREE.InstancedMesh>(null);
  const relicGlowRef = useRef<THREE.InstancedMesh>(null);
  const initialHealthSpawned = useRef(false);
  const { scene: xpScene } = useGLTF(DROP_MODEL);
  const { scene: healthScene } = useGLTF(HEALTH_MODEL);
  const { scene: relicScene } = useGLTF(RELIC_MODEL);
  const preparedXp = useMemo(() => prepareDropModel(xpScene, "Data core"), [xpScene]);
  const preparedHealth = useMemo(() => prepareDropModel(healthScene, "Health core"), [healthScene]);
  const preparedRelic = useMemo(
    () => prepareDropModel(relicScene, "Artifact spark", 1.2),
    [relicScene]
  );
  const materialDropMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        metalness: 0.58,
        roughness: 0.26,
        emissive: "#d8ffff",
        emissiveIntensity: 0.18,
        vertexColors: true,
      }),
    []
  );
  const glowGeometry = useMemo(() => {
    const geometry = new THREE.RingGeometry(0.37, 0.5, 28);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, []);

  const drops = useMemo<Drop[]>(
    () =>
      Array.from({ length: ARENA_CONFIG.limits.drops }, () => ({
        active: false,
        kind: "xp" as const,
        position: new THREE.Vector3(),
        amount: 0,
        age: 0,
        materialId: "iron_shard" as const,
        powerId: "cycle_surge" as const,
        bossRewardId: "class_augment" as const,
      })),
    []
  );

  useEffect(() => {
    world.spawnDrop = (position: THREE.Vector3, xp: number) => {
      const drop = drops.find((d) => !d.active);
      if (!drop) return;
      drop.active = true;
      drop.kind = "xp";
      drop.position.set(position.x, 0.6, position.z);
      drop.amount = xp;
      drop.age = 0;
    };
    world.spawnHealthDrop = (position: THREE.Vector3, health: number) => {
      const drop = drops.find((candidate) => !candidate.active);
      if (!drop) return;
      drop.active = true;
      drop.kind = "health";
      drop.position.set(position.x, 0.58, position.z);
      drop.amount = health;
      drop.age = 0;
    };
    world.spawnMaterialDrop = (
      position: THREE.Vector3,
      materialId: MaterialId,
      amount = 1
    ) => {
      const drop = drops.find((candidate) => !candidate.active);
      if (!drop) return;
      drop.active = true;
      drop.kind = "material";
      drop.position.set(position.x, 0.62, position.z);
      drop.amount = Math.max(1, Math.floor(amount));
      drop.age = 0;
      drop.materialId = materialId;
    };
    world.spawnPowerDrop = (position: THREE.Vector3, powerId: ArenaPowerDropId) => {
      const drop = drops.find((candidate) => !candidate.active);
      if (!drop) return;
      drop.active = true;
      drop.kind = "power";
      drop.position.set(position.x, 0.68, position.z);
      drop.amount = 1;
      drop.age = 0;
      drop.powerId = powerId;
    };
    world.spawnRelicDrop = (position: THREE.Vector3) => {
      const drop = drops.find((candidate) => !candidate.active);
      if (!drop) return;
      drop.active = true;
      drop.kind = "relic";
      drop.position.set(position.x, 0.72, position.z);
      drop.amount = 1;
      drop.age = 0;
    };
    world.spawnBossRewardDrop = (
      position: THREE.Vector3,
      rewardId: ArenaBossRewardId
    ) => {
      const drop = drops.find((candidate) => !candidate.active);
      if (!drop) return;
      drop.active = true;
      drop.kind = "bossReward";
      drop.position.set(position.x, 0.74, position.z);
      drop.amount = 1;
      drop.age = 0;
      drop.bossRewardId = rewardId;
    };
    return () => {
      world.spawnDrop = () => {};
      world.spawnHealthDrop = () => {};
      world.spawnMaterialDrop = () => {};
      world.spawnPowerDrop = () => {};
      world.spawnRelicDrop = () => {};
      world.spawnBossRewardDrop = () => {};
    };
  }, [world, drops]);

  useEffect(
    () => () => {
      preparedXp.geometry.dispose();
      preparedXp.material.dispose();
      preparedHealth.geometry.dispose();
      preparedHealth.material.dispose();
      preparedRelic.geometry.dispose();
      preparedRelic.material.dispose();
      materialDropMaterial.dispose();
      glowGeometry.dispose();
    },
    [preparedXp, preparedHealth, preparedRelic, materialDropMaterial, glowGeometry]
  );

  useFrame((_, dt) => {
    if (performance.now() < world.hitStopUntil) return;
    const xpMesh = xpMeshRef.current;
    const healthMesh = healthMeshRef.current;
    const materialMesh = materialMeshRef.current;
    const relicMesh = relicMeshRef.current;
    const xpGlow = xpGlowRef.current;
    const healthGlow = healthGlowRef.current;
    const materialGlow = materialGlowRef.current;
    const relicGlow = relicGlowRef.current;
    if (
      !xpMesh ||
      !healthMesh ||
      !materialMesh ||
      !relicMesh ||
      !xpGlow ||
      !healthGlow ||
      !materialGlow ||
      !relicGlow
    ) return;
    const session = useArenaSession.getState();
    const running = session.phase === "running";
    const pickupRadius = ARENA_CONFIG.player.pickupRadius + session.mods.pickupRadiusAdd;

    if (running && !initialHealthSpawned.current) {
      initialHealthSpawned.current = true;
      world.spawnHealthDrop(world.playerPosition.clone().add(new THREE.Vector3(7, 0, 4.5)), 24);
    }

    drops.forEach((drop, index) => {
      if (drop.active && running) {
        drop.age += dt;
        const dx = world.playerPosition.x - drop.position.x;
        const dz = world.playerPosition.z - drop.position.z;
        const distSq = dx * dx + dz * dz;
        const canCollect = drop.kind !== "health" || session.health < session.maxHealth;
        if (canCollect && distSq < pickupRadius * pickupRadius) {
          const dist = Math.sqrt(distSq) || 0.001;
          const pull = Math.min(1, dt * (14 / Math.max(1.5, dist)) * 6);
          drop.position.x += dx * pull;
          drop.position.z += dz * pull;
          if (dist < 0.7) {
            const pickupPosition = drop.position.clone().setY(1.65);
            const collectedAmount = drop.amount;
            const collectedKind = drop.kind;
            drop.active = false;
            arenaAudio.sfx("pickup");
            if (collectedKind === "relic") {
              const reward = BOSS_REWARDS.artifact_spark;
              session.collectBossReward("artifact_spark");
              const game = useGameStore.getState();
              game.claimArtifactMilestone(reward.tier);
              const transmission = artifactTransmission(reward.tier);
              if (transmission) session.queueStoryTransmission(transmission);
              game.addMaterials(reward.materials);
              world.spawnEffect("nova", drop.position, reward.color, 1.65);
              world.spawnCombatText(
                pickupPosition.clone().setY(3.1),
                reward.label,
                reward.color,
                2.15
              );
              world.triggerScreenShake(1, 320);
            } else if (collectedKind === "bossReward") {
              const reward = BOSS_REWARDS[drop.bossRewardId];
              session.collectBossReward(drop.bossRewardId);
              const game = useGameStore.getState();
              game.claimArtifactMilestone(reward.tier);
              const transmission = artifactTransmission(reward.tier);
              if (transmission) session.queueStoryTransmission(transmission);
              game.addMaterials(reward.materials);
              world.spawnEffect("nova", drop.position, reward.color, 1.85);
              world.spawnEffect("burst", drop.position, reward.color, 1.15);
              world.spawnCombatText(
                pickupPosition.clone().setY(3.2),
                reward.label,
                reward.color,
                2.35
              );
              world.triggerHitStop(105);
              world.triggerScreenShake(1.2, 420);
            } else if (collectedKind === "power") {
              const power = ARENA_POWER_DROPS[drop.powerId];
              let suffix = power.description;
              if (power.effect.artifactPower) {
                const points = useGameStore.getState().addArtifactPower(power.effect.artifactPower);
                suffix = points > 0
                  ? `+${power.effect.artifactPower} ARTIFACT POWER · TRAIT POINT EARNED`
                  : `+${power.effect.artifactPower} ARTIFACT POWER`;
              } else {
                session.activatePowerDrop(drop.powerId);
              }
              world.spawnEffect("nova", drop.position, power.color, 0.95);
              world.spawnEffect("burst", drop.position, power.color, 0.8);
              world.spawnCombatText(
                pickupPosition.clone().setY(2.8),
                `${power.label} · ${suffix}`,
                power.color,
                2.05
              );
            } else if (collectedKind === "material") {
              const material = MATERIALS_BY_ID[drop.materialId];
              useGameStore.getState().addMaterials({ [drop.materialId]: collectedAmount });
              world.spawnEffect("burst", drop.position, material.color, 0.72);
              world.spawnCombatText(
                pickupPosition,
                `+${collectedAmount} ${material.name.toUpperCase()}`,
                material.color,
                1.85
              );
            } else if (collectedKind === "health") {
              const restored = session.healPlayer(collectedAmount);
              world.spawnEffect("nova", drop.position, "#48ff8a", 0.72);
              world.spawnCombatText(
                pickupPosition,
                `+${Math.ceil(restored)} HP`,
                "#48ff8a",
                1.95
              );
            } else {
              const previousLevel = session.xpLevel;
              session.recordCorePickup();
              session.addArenaXp(collectedAmount);
              session.addScore(collectedAmount * 5);
              world.spawnEffect("burst", drop.position, "#7dffc9", 0.55);
              world.spawnCombatText(
                pickupPosition,
                `+${collectedAmount} XP`,
                "#7dffc9",
                1.55 + Math.min(0.35, collectedAmount * 0.025)
              );
              const nextLevel = useArenaSession.getState().xpLevel;
              if (nextLevel > previousLevel) {
                world.spawnCombatText(
                  pickupPosition.clone().setY(3.2),
                  `LINK LEVEL ${nextLevel}`,
                  ARENA_CONFIG.meta.accent,
                  2.05
                );
                world.spawnEffect("nova", pickupPosition, ARENA_CONFIG.meta.accent, 1.2);
                world.triggerScreenShake(0.62, 220);
              }
            }
          }
        }
      }
      if (drop.active) {
        tempQuat.setFromAxisAngle(yAxis, drop.age * 2.4);
        tempPosition.set(drop.position.x, 0.6 + Math.sin(drop.age * 3) * 0.12, drop.position.z);
        tempMatrix.compose(
          tempPosition,
          tempQuat,
          tempScale
        );
        xpMesh.setMatrixAt(index, drop.kind === "xp" ? tempMatrix : hiddenMatrix);
        healthMesh.setMatrixAt(index, drop.kind === "health" ? tempMatrix : hiddenMatrix);
        materialMesh.setMatrixAt(
          index,
          drop.kind === "material" || drop.kind === "power" || drop.kind === "bossReward" ? tempMatrix : hiddenMatrix
        );
        relicMesh.setMatrixAt(index, drop.kind === "relic" ? tempMatrix : hiddenMatrix);
        if (drop.kind === "material" || drop.kind === "power" || drop.kind === "bossReward") {
          tempColor.set(
            drop.kind === "bossReward"
              ? BOSS_REWARDS[drop.bossRewardId].color
              : drop.kind === "power"
                ? ARENA_POWER_DROPS[drop.powerId].color
              : MATERIALS_BY_ID[drop.materialId].color
          );
          materialMesh.setColorAt(index, tempColor);
          materialGlow.setColorAt(index, tempColor);
        }
        tempPosition.set(drop.position.x, 0.05, drop.position.z);
        tempScale.setScalar(0.88 + Math.sin(drop.age * 3) * 0.08);
        tempMatrix.compose(tempPosition, tempQuat.identity(), tempScale);
        xpGlow.setMatrixAt(index, drop.kind === "xp" ? tempMatrix : hiddenMatrix);
        healthGlow.setMatrixAt(index, drop.kind === "health" ? tempMatrix : hiddenMatrix);
        materialGlow.setMatrixAt(
          index,
          drop.kind === "material" || drop.kind === "power" || drop.kind === "bossReward" ? tempMatrix : hiddenMatrix
        );
        relicGlow.setMatrixAt(index, drop.kind === "relic" ? tempMatrix : hiddenMatrix);
        tempScale.setScalar(1);
      } else {
        xpMesh.setMatrixAt(index, hiddenMatrix);
        healthMesh.setMatrixAt(index, hiddenMatrix);
        materialMesh.setMatrixAt(index, hiddenMatrix);
        relicMesh.setMatrixAt(index, hiddenMatrix);
        xpGlow.setMatrixAt(index, hiddenMatrix);
        healthGlow.setMatrixAt(index, hiddenMatrix);
        materialGlow.setMatrixAt(index, hiddenMatrix);
        relicGlow.setMatrixAt(index, hiddenMatrix);
      }
    });
    xpMesh.instanceMatrix.needsUpdate = true;
    healthMesh.instanceMatrix.needsUpdate = true;
    materialMesh.instanceMatrix.needsUpdate = true;
    relicMesh.instanceMatrix.needsUpdate = true;
    xpGlow.instanceMatrix.needsUpdate = true;
    healthGlow.instanceMatrix.needsUpdate = true;
    materialGlow.instanceMatrix.needsUpdate = true;
    relicGlow.instanceMatrix.needsUpdate = true;
    if (materialMesh.instanceColor) materialMesh.instanceColor.needsUpdate = true;
    if (materialGlow.instanceColor) materialGlow.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh
        ref={xpMeshRef}
        args={[preparedXp.geometry, preparedXp.material, ARENA_CONFIG.limits.drops]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={healthMeshRef}
        args={[preparedHealth.geometry, preparedHealth.material, ARENA_CONFIG.limits.drops]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={materialMeshRef}
        args={[preparedXp.geometry, materialDropMaterial, ARENA_CONFIG.limits.drops]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={relicMeshRef}
        args={[preparedRelic.geometry, preparedRelic.material, ARENA_CONFIG.limits.drops]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={xpGlowRef}
        args={[glowGeometry, undefined, ARENA_CONFIG.limits.drops]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          color={ARENA_CONFIG.meta.support}
          transparent
          opacity={0.38}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
      <instancedMesh
        ref={healthGlowRef}
        args={[glowGeometry, undefined, ARENA_CONFIG.limits.drops]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          color="#48ff8a"
          transparent
          opacity={0.58}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
      <instancedMesh
        ref={materialGlowRef}
        args={[glowGeometry, undefined, ARENA_CONFIG.limits.drops]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          color="#ffffff"
          vertexColors
          transparent
          opacity={0.72}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
      <instancedMesh
        ref={relicGlowRef}
        args={[glowGeometry, undefined, ARENA_CONFIG.limits.drops]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          color="#eaffff"
          transparent
          opacity={0.88}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
}

useGLTF.preload(DROP_MODEL);
useGLTF.preload(HEALTH_MODEL);
useGLTF.preload(RELIC_MODEL);
