"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import ARENA_CONFIG from "@/data/arena-config.json";
import ARENA_ENEMIES from "@/data/arena-enemies.json";
import { useArenaSession } from "@/store/arenaSession";
import { nearestEnemy, useArenaWorld, type PlayerProjectileOptions } from "./world";

const WEAPON = ARENA_CONFIG.weapon;
const LIMITS = ARENA_CONFIG.limits;
const CULL_DISTANCE = ARENA_CONFIG.world.projectileCullDistance;

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
const tempQuat = new THREE.Quaternion();
const tempDir = new THREE.Vector3();
const unitScale = new THREE.Vector3(1, 1, 1);
const haloScale = new THREE.Vector3(1.9, 1.9, 1.9);
const FORWARD = new THREE.Vector3(0, 0, 1);

function outOfBounds(position: THREE.Vector3, playerPosition: THREE.Vector3): boolean {
  const dx = position.x - playerPosition.x;
  const dz = position.z - playerPosition.z;
  return dx * dx + dz * dz > CULL_DISTANCE * CULL_DISTANCE;
}

export default function Projectiles() {
  const world = useArenaWorld();
  const playerMeshRef = useRef<THREE.InstancedMesh>(null);
  const enemyMeshRef = useRef<THREE.InstancedMesh>(null);
  const enemyHaloRef = useRef<THREE.InstancedMesh>(null);

  // Izduzeni energy bolt, duzina po +Z (smjeru leta)
  const boltGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(0.075, 0.075, 1.25, 6);
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }, []);

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
          if (shot.lifeMs <= 0 || outOfBounds(shot.position, world.playerPosition)) {
            shot.active = false;
          } else {
            for (const enemy of world.enemies.values()) {
              if (enemy.health <= 0 || enemy.id === shot.lastHitId) continue;
              const radius = ARENA_ENEMIES[enemy.kind].radius + WEAPON.projectileRadius;
              const dx = enemy.position.x - shot.position.x;
              const dz = enemy.position.z - shot.position.z;
              if (dx * dx + dz * dz <= radius * radius) {
                enemy.hit(shot.damage);
                world.spawnEffect("burst", shot.position, ARENA_CONFIG.meta.accent, 0.45);
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
        if (shot.active) {
          tempDir.copy(shot.velocity).normalize();
          tempQuat.setFromUnitVectors(FORWARD, tempDir);
          tempMatrix.compose(shot.position, tempQuat, unitScale);
          playerMesh.setMatrixAt(index, tempMatrix);
        } else {
          playerMesh.setMatrixAt(index, hiddenMatrix);
        }
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
          if (shot.lifeMs <= 0 || outOfBounds(shot.position, world.playerPosition)) {
            shot.active = false;
          } else {
            const dx = world.playerPosition.x - shot.position.x;
            const dz = world.playerPosition.z - shot.position.z;
            if (dx * dx + dz * dz <= playerHitRadius * playerHitRadius) {
              session.damagePlayer(shot.damage);
              world.spawnEffect("burst", shot.position, ARENA_CONFIG.meta.danger, 0.5);
              shot.active = false;
            }
          }
        }
        if (shot.active) {
          tempMatrix.compose(shot.position, tempQuat.identity(), unitScale);
          enemyMesh.setMatrixAt(index, tempMatrix);
          if (enemyHaloRef.current) {
            tempMatrix.compose(shot.position, tempQuat, haloScale);
            enemyHaloRef.current.setMatrixAt(index, tempMatrix);
          }
        } else {
          enemyMesh.setMatrixAt(index, hiddenMatrix);
          enemyHaloRef.current?.setMatrixAt(index, hiddenMatrix);
        }
      });
      enemyMesh.instanceMatrix.needsUpdate = true;
      if (enemyHaloRef.current) enemyHaloRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh
        ref={playerMeshRef}
        geometry={boltGeometry}
        args={[undefined, undefined, LIMITS.projectiles]}
        frustumCulled={false}
      >
        <meshBasicMaterial color="#aef6ff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={enemyMeshRef} args={[undefined, undefined, LIMITS.enemyProjectiles]} frustumCulled={false}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshBasicMaterial color="#ffd7e0" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={enemyHaloRef} args={[undefined, undefined, LIMITS.enemyProjectiles]} frustumCulled={false}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshBasicMaterial
          color={ARENA_CONFIG.meta.danger}
          transparent
          opacity={0.35}
          toneMapped={false}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}
