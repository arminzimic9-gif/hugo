"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import ARENA_CONFIG from "@/data/arena-config.json";
import ARENA_ENEMIES from "@/data/arena-enemies.json";
import { useArenaSession } from "@/store/arenaSession";
import { nearestEnemy, useArenaWorld, type PlayerProjectileOptions } from "./world";
import { ARENA_BOUNDS } from "./TileFloor";

const WEAPON = ARENA_CONFIG.weapon;
const LIMITS = ARENA_CONFIG.limits;

type PlayerShot = {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  lifeMs: number;
  damage: number;
  bounces: number;
  bounceRange: number;
  lastHitId: number;
};

type EnemyShot = {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  lifeMs: number;
  damage: number;
};

const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const tempMatrix = new THREE.Matrix4();

function outOfBounds(position: THREE.Vector3): boolean {
  return (
    Math.abs(position.x) > ARENA_BOUNDS.halfWidth + 2 ||
    Math.abs(position.z) > ARENA_BOUNDS.halfDepth + 2
  );
}

export default function Projectiles() {
  const world = useArenaWorld();
  const playerMeshRef = useRef<THREE.InstancedMesh>(null);
  const enemyMeshRef = useRef<THREE.InstancedMesh>(null);

  const playerShots = useMemo<PlayerShot[]>(
    () =>
      Array.from({ length: LIMITS.projectiles }, () => ({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        lifeMs: 0,
        damage: 0,
        bounces: 0,
        bounceRange: 0,
        lastHitId: -1,
      })),
    []
  );

  const enemyShots = useMemo<EnemyShot[]>(
    () =>
      Array.from({ length: LIMITS.enemyProjectiles }, () => ({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        lifeMs: 0,
        damage: 0,
      })),
    []
  );

  useEffect(() => {
    world.firePlayerProjectile = (
      origin: THREE.Vector3,
      direction: THREE.Vector3,
      options: PlayerProjectileOptions
    ) => {
      const shot = playerShots.find((s) => !s.active);
      if (!shot) return;
      shot.active = true;
      shot.position.copy(origin);
      shot.velocity.copy(direction).multiplyScalar(WEAPON.projectileSpeed);
      shot.lifeMs = WEAPON.projectileLifeMs;
      shot.damage = options.damage;
      shot.bounces = options.bounces;
      shot.bounceRange = options.bounceRange;
      shot.lastHitId = -1;
    };
    world.fireEnemyProjectile = (origin, direction, speed, damage) => {
      const shot = enemyShots.find((s) => !s.active);
      if (!shot) return;
      shot.active = true;
      shot.position.copy(origin);
      shot.velocity.copy(direction).multiplyScalar(speed);
      shot.lifeMs = 4200;
      shot.damage = damage;
    };
    return () => {
      world.firePlayerProjectile = () => {};
      world.fireEnemyProjectile = () => {};
    };
  }, [world, playerShots, enemyShots]);

  useFrame((_, dt) => {
    const session = useArenaSession.getState();
    const running = session.phase === "running";
    const stepMs = dt * 1000;

    const playerMesh = playerMeshRef.current;
    if (playerMesh) {
      playerShots.forEach((shot, index) => {
        if (shot.active && running) {
          shot.position.addScaledVector(shot.velocity, dt);
          shot.lifeMs -= stepMs;
          if (shot.lifeMs <= 0 || outOfBounds(shot.position)) {
            shot.active = false;
          } else {
            for (const enemy of world.enemies.values()) {
              if (enemy.health <= 0 || enemy.id === shot.lastHitId) continue;
              const radius = ARENA_ENEMIES[enemy.kind].radius + WEAPON.projectileRadius;
              const dx = enemy.position.x - shot.position.x;
              const dz = enemy.position.z - shot.position.z;
              if (dx * dx + dz * dz <= radius * radius) {
                enemy.hit(shot.damage);
                if (shot.bounces > 0) {
                  const next = nearestEnemy(world, shot.position, shot.bounceRange, enemy.id);
                  if (next) {
                    shot.bounces -= 1;
                    shot.lastHitId = enemy.id;
                    shot.lifeMs = WEAPON.projectileLifeMs;
                    shot.velocity
                      .set(next.position.x - shot.position.x, 0, next.position.z - shot.position.z)
                      .normalize()
                      .multiplyScalar(WEAPON.projectileSpeed);
                    break;
                  }
                }
                shot.active = false;
                break;
              }
            }
          }
        }
        playerMesh.setMatrixAt(
          index,
          shot.active ? tempMatrix.makeTranslation(shot.position.x, shot.position.y, shot.position.z) : hiddenMatrix
        );
      });
      playerMesh.instanceMatrix.needsUpdate = true;
    }

    const enemyMesh = enemyMeshRef.current;
    if (enemyMesh) {
      const playerHitRadius = ARENA_CONFIG.player.radius + 0.2;
      enemyShots.forEach((shot, index) => {
        if (shot.active && running) {
          shot.position.addScaledVector(shot.velocity, dt);
          shot.lifeMs -= stepMs;
          if (shot.lifeMs <= 0 || outOfBounds(shot.position)) {
            shot.active = false;
          } else {
            const dx = world.playerPosition.x - shot.position.x;
            const dz = world.playerPosition.z - shot.position.z;
            if (dx * dx + dz * dz <= playerHitRadius * playerHitRadius) {
              session.damagePlayer(shot.damage);
              shot.active = false;
            }
          }
        }
        enemyMesh.setMatrixAt(
          index,
          shot.active ? tempMatrix.makeTranslation(shot.position.x, shot.position.y, shot.position.z) : hiddenMatrix
        );
      });
      enemyMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={playerMeshRef} args={[undefined, undefined, LIMITS.projectiles]} frustumCulled={false}>
        <sphereGeometry args={[WEAPON.projectileRadius, 8, 8]} />
        <meshStandardMaterial
          color={ARENA_CONFIG.meta.accent}
          emissive={ARENA_CONFIG.meta.accent}
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={enemyMeshRef} args={[undefined, undefined, LIMITS.enemyProjectiles]} frustumCulled={false}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial
          color={ARENA_CONFIG.meta.danger}
          emissive={ARENA_CONFIG.meta.danger}
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}
