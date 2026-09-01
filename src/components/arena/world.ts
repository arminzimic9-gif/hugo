import { createContext, useContext } from "react";
import * as THREE from "three";
import type { RapierRigidBody } from "@react-three/rapier";
import ARENA_ENEMIES from "@/data/arena-enemies.json";
import ARENA_PROJECTILES from "@/data/arena-projectiles.json";
import type { MaterialId } from "@/data/crafting";
import type { ArenaPowerDropId } from "@/data/arenaPowerDrops";
import type { ArenaBossRewardId } from "@/store/arenaSession";

export type EnemyKind = keyof typeof ARENA_ENEMIES;
export type EnemyDefinition = (typeof ARENA_ENEMIES)[EnemyKind];
export type EnemyProjectileKind = keyof typeof ARENA_PROJECTILES;
export type ArenaControlMode = "keyboard" | "mouse";

export type EnemyHandle = {
  id: number;
  kind: EnemyKind;
  position: THREE.Vector3;
  health: number;
  hit: (damage: number) => void;
};

export type PlayerProjectileOptions = {
  damage: number;
  bounces: number;
  bounceRange: number;
  pierces: number;
  projectileScale?: number;
  projectileSpeedMult?: number;
};

export type EffectKind = "ring" | "burst" | "nova";

export type ArenaWorld = {
  playerBody: RapierRigidBody | null;
  playerPosition: THREE.Vector3;
  playerAimDirection: THREE.Vector3;
  enemies: Map<number, EnemyHandle>;
  killsSinceCluster: number;
  hitStopUntil: number;
  shakeIntensity: number;
  shakeUntil: number;
  spawnEffect: (kind: EffectKind, position: THREE.Vector3, color: string, scale?: number) => void;
  spawnDamageNumber: (position: THREE.Vector3, damage: number, color?: string) => void;
  spawnCombatText: (
    position: THREE.Vector3,
    text: string,
    color?: string,
    emphasis?: number
  ) => void;
  spawnComboSurge: (
    position: THREE.Vector3,
    color: string,
    power: number,
    onDetonate: () => void
  ) => void;
  triggerHitStop: (durationMs?: number) => void;
  triggerScreenShake: (intensity: number, durationMs?: number) => void;
  firePlayerProjectile: (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    options: PlayerProjectileOptions
  ) => void;
  fireEnemyProjectile: (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    kind: EnemyProjectileKind
  ) => void;
  spawnDrop: (position: THREE.Vector3, xp: number) => void;
  spawnHealthDrop: (position: THREE.Vector3, health: number) => void;
  spawnMaterialDrop: (position: THREE.Vector3, materialId: MaterialId, amount?: number) => void;
  spawnPowerDrop: (position: THREE.Vector3, powerId: ArenaPowerDropId) => void;
  spawnRelicDrop: (position: THREE.Vector3) => void;
  spawnBossRewardDrop: (position: THREE.Vector3, rewardId: ArenaBossRewardId) => void;
};

export function createArenaWorld(): ArenaWorld {
  return {
    playerBody: null,
    playerPosition: new THREE.Vector3(),
    playerAimDirection: new THREE.Vector3(0, 0, 1),
    enemies: new Map(),
    killsSinceCluster: 0,
    hitStopUntil: 0,
    shakeIntensity: 0,
    shakeUntil: 0,
    spawnEffect: () => {},
    spawnDamageNumber: () => {},
    spawnCombatText: () => {},
    spawnComboSurge: () => {},
    triggerHitStop(durationMs = 42) {
      this.hitStopUntil = Math.max(this.hitStopUntil, performance.now() + durationMs);
    },
    triggerScreenShake(intensity, durationMs = 140) {
      this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
      this.shakeUntil = Math.max(this.shakeUntil, performance.now() + durationMs);
    },
    firePlayerProjectile: () => {},
    fireEnemyProjectile: () => {},
    spawnDrop: () => {},
    spawnHealthDrop: () => {},
    spawnMaterialDrop: () => {},
    spawnPowerDrop: () => {},
    spawnRelicDrop: () => {},
    spawnBossRewardDrop: () => {},
  };
}

export const ArenaWorldContext = createContext<ArenaWorld | null>(null);

export function useArenaWorld(): ArenaWorld {
  const world = useContext(ArenaWorldContext);
  if (!world) throw new Error("ArenaWorldContext missing");
  return world;
}

export function nearestEnemy(
  world: ArenaWorld,
  from: THREE.Vector3,
  range: number,
  excludedId = -1
): EnemyHandle | null {
  let nearest: EnemyHandle | null = null;
  let best = range * range;
  for (const enemy of world.enemies.values()) {
    if (enemy.id === excludedId || enemy.health <= 0) continue;
    const dx = enemy.position.x - from.x;
    const dz = enemy.position.z - from.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < best) {
      best = distSq;
      nearest = enemy;
    }
  }
  return nearest;
}
