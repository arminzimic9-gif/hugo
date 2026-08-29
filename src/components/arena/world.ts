import { createContext, useContext } from "react";
import * as THREE from "three";
import type { RapierRigidBody } from "@react-three/rapier";
import ARENA_ENEMIES from "@/data/arena-enemies.json";

export type EnemyKind = keyof typeof ARENA_ENEMIES;
export type EnemyDefinition = (typeof ARENA_ENEMIES)[EnemyKind];

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
};

export type ArenaWorld = {
  playerBody: RapierRigidBody | null;
  playerPosition: THREE.Vector3;
  enemies: Map<number, EnemyHandle>;
  killsSinceCluster: number;
  firePlayerProjectile: (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    options: PlayerProjectileOptions
  ) => void;
  fireEnemyProjectile: (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number,
    damage: number,
    color: string
  ) => void;
  spawnDrop: (position: THREE.Vector3, xp: number) => void;
};

export function createArenaWorld(): ArenaWorld {
  return {
    playerBody: null,
    playerPosition: new THREE.Vector3(),
    enemies: new Map(),
    killsSinceCluster: 0,
    firePlayerProjectile: () => {},
    fireEnemyProjectile: () => {},
    spawnDrop: () => {},
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
