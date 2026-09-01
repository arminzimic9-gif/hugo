"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import ARENA_CONFIG from "@/data/arena-config.json";
import ARENA_ENEMIES from "@/data/arena-enemies.json";
import ARENA_PROJECTILES from "@/data/arena-projectiles.json";
import { arenaAudio } from "@/lib/arenaAudio";
import { useArenaSession } from "@/store/arenaSession";
import {
  nearestEnemy,
  useArenaWorld,
  type EffectKind,
  type EnemyProjectileKind,
  type PlayerProjectileOptions,
} from "./world";

const WEAPON = ARENA_CONFIG.weapon;
const LIMITS = ARENA_CONFIG.limits;
const CULL_DISTANCE = ARENA_CONFIG.world.projectileCullDistance;

type ProjectileVisualDefinition = {
  label: string;
  model: string;
  pattern: "single" | "twin" | "radial";
  orientation: "forward" | "omni";
  modelLength: number;
  collisionRadius: number;
  lifeMs: number;
  lateralOffset?: number;
  spreadRadians?: number;
  burstCount?: number;
  impactEffect: EffectKind;
  impactScale: number;
  haloScale: number;
  accent: string;
};

const PROJECTILE_DEFINITIONS = ARENA_PROJECTILES as unknown as Record<
  EnemyProjectileKind,
  ProjectileVisualDefinition
>;
const ENEMY_PROJECTILE_KINDS = Object.keys(PROJECTILE_DEFINITIONS) as EnemyProjectileKind[];

type PlayerShot = {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  lifeMs: number;
  damage: number;
  bounces: number;
  bounceRange: number;
  pierces: number;
  lastHitId: number;
  scale: number;
  speed: number;
};

type EnemyShot = {
  active: boolean;
  kind: EnemyProjectileKind;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  lifeMs: number;
  damage: number;
  age: number;
};

const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const tempMatrix = new THREE.Matrix4();
const tempQuat = new THREE.Quaternion();
const tempDir = new THREE.Vector3();
const tempOrigin = new THREE.Vector3();
const tempScale = new THREE.Vector3(1, 1, 1);
const unitScale = new THREE.Vector3(1, 1, 1);
const FORWARD = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function outOfBounds(position: THREE.Vector3, playerPosition: THREE.Vector3): boolean {
  const dx = position.x - playerPosition.x;
  const dz = position.z - playerPosition.z;
  return dx * dx + dz * dz > CULL_DISTANCE * CULL_DISTANCE;
}

function firstMesh(scene: THREE.Object3D): THREE.Mesh {
  let result: THREE.Mesh | null = null;
  scene.updateMatrixWorld(true);
  scene.traverse((child) => {
    if (!result && child instanceof THREE.Mesh) result = child;
  });
  if (!result) throw new Error("Projectile GLB does not contain a mesh");
  return result;
}

function orientAndNormalizeGeometry(
  source: THREE.Mesh,
  orientation: ProjectileVisualDefinition["orientation"],
  targetSize: number
): THREE.BufferGeometry {
  const geometry = source.geometry.clone();
  geometry.applyMatrix4(source.matrixWorld);
  geometry.computeBoundingBox();
  const initialSize = geometry.boundingBox!.getSize(new THREE.Vector3());

  if (orientation === "forward") {
    if (initialSize.x >= initialSize.y && initialSize.x >= initialSize.z) {
      geometry.rotateY(-Math.PI / 2);
    } else if (initialSize.y >= initialSize.x && initialSize.y >= initialSize.z) {
      geometry.rotateX(Math.PI / 2);
    }
  } else {
    // Diskaste mine se polazu u XZ ravan da im se lice cita iz top-down kamere.
    if (initialSize.x <= initialSize.y && initialSize.x <= initialSize.z) {
      geometry.rotateZ(Math.PI / 2);
    } else if (initialSize.z <= initialSize.x && initialSize.z <= initialSize.y) {
      geometry.rotateX(Math.PI / 2);
    }
  }

  geometry.center();
  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new THREE.Vector3());
  const scale = targetSize / Math.max(size.x, size.y, size.z, 0.001);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingSphere();
  return geometry;
}

function EnemyProjectileInstances({
  kind,
  onModelRef,
  onHaloRef,
}: {
  kind: EnemyProjectileKind;
  onModelRef: (kind: EnemyProjectileKind, instance: THREE.InstancedMesh | null) => void;
  onHaloRef: (kind: EnemyProjectileKind, instance: THREE.InstancedMesh | null) => void;
}) {
  const definition = PROJECTILE_DEFINITIONS[kind];
  const { scene } = useGLTF(definition.model);
  const prepared = useMemo(() => {
    const source = firstMesh(scene);
    const geometry = orientAndNormalizeGeometry(
      source,
      definition.orientation,
      definition.modelLength
    );
    const sourceMaterial = Array.isArray(source.material) ? source.material[0] : source.material;
    const material = sourceMaterial.clone();
    if (material instanceof THREE.MeshStandardMaterial) {
      material.envMapIntensity = Math.max(material.envMapIntensity, 1.2);
      material.emissive.set(definition.accent);
      material.emissiveIntensity = Math.max(material.emissiveIntensity, 0.38);
    }
    return { geometry, material };
  }, [scene, definition.accent, definition.modelLength, definition.orientation]);

  useEffect(
    () => () => {
      prepared.geometry.dispose();
      prepared.material.dispose();
    },
    [prepared]
  );

  return (
    <>
      <instancedMesh
        ref={(instance) => onModelRef(kind, instance)}
        args={[prepared.geometry, prepared.material, LIMITS.enemyProjectiles]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={(instance) => onHaloRef(kind, instance)}
        args={[undefined, undefined, LIMITS.enemyProjectiles]}
        frustumCulled={false}
      >
        <sphereGeometry args={[definition.collisionRadius, 10, 10]} />
        <meshBasicMaterial
          color={definition.accent}
          transparent
          opacity={0.22}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </>
  );
}

export default function Projectiles({ playerAccent }: { playerAccent: string }) {
  const world = useArenaWorld();
  const playerMeshRef = useRef<THREE.InstancedMesh>(null);
  const enemyMeshRefs = useRef<Partial<Record<EnemyProjectileKind, THREE.InstancedMesh>>>({});
  const enemyHaloRefs = useRef<Partial<Record<EnemyProjectileKind, THREE.InstancedMesh>>>({});

  const bindEnemyMesh = useCallback(
    (kind: EnemyProjectileKind, instance: THREE.InstancedMesh | null) => {
      if (instance) enemyMeshRefs.current[kind] = instance;
      else delete enemyMeshRefs.current[kind];
    },
    []
  );
  const bindEnemyHalo = useCallback(
    (kind: EnemyProjectileKind, instance: THREE.InstancedMesh | null) => {
      if (instance) enemyHaloRefs.current[kind] = instance;
      else delete enemyHaloRefs.current[kind];
    },
    []
  );

  // Igracev osnovni bolt ostaje lagani VFX; fizicki enemy projektili koriste odobrene GLB-ove.
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
        pierces: 0,
        lastHitId: -1,
        scale: 1,
        speed: WEAPON.projectileSpeed,
      })),
    []
  );

  const enemyShots = useMemo<EnemyShot[]>(
    () =>
      Array.from({ length: LIMITS.enemyProjectiles }, () => ({
        active: false,
        kind: "drone" as EnemyProjectileKind,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        lifeMs: 0,
        damage: 0,
        age: 0,
      })),
    []
  );

  useEffect(() => {
    world.firePlayerProjectile = (
      origin: THREE.Vector3,
      direction: THREE.Vector3,
      options: PlayerProjectileOptions
    ) => {
      const shot = playerShots.find((candidate) => !candidate.active);
      if (!shot) return;
      shot.active = true;
      shot.position.copy(origin);
      shot.speed = WEAPON.projectileSpeed * (options.projectileSpeedMult ?? 1);
      shot.scale = options.projectileScale ?? 1;
      shot.velocity.copy(direction).multiplyScalar(shot.speed);
      shot.lifeMs = WEAPON.projectileLifeMs;
      shot.damage = options.damage;
      shot.bounces = options.bounces;
      shot.bounceRange = options.bounceRange;
      shot.pierces = options.pierces;
      shot.lastHitId = -1;
    };

    const spawnEnemyShot = (
      origin: THREE.Vector3,
      direction: THREE.Vector3,
      kind: EnemyProjectileKind
    ) => {
      const shot = enemyShots.find((candidate) => !candidate.active);
      if (!shot) return;
      const enemyDefinition = ARENA_ENEMIES[kind];
      const projectileDefinition = PROJECTILE_DEFINITIONS[kind];
      shot.active = true;
      shot.kind = kind;
      shot.position.copy(origin);
      shot.velocity.copy(direction).normalize().multiplyScalar(enemyDefinition.projectileSpeed);
      shot.lifeMs = projectileDefinition.lifeMs;
      shot.damage = enemyDefinition.projectileDamage;
      shot.age = 0;
    };

    world.fireEnemyProjectile = (origin, direction, kind) => {
      arenaAudio.enemyShot(kind);
      const definition = PROJECTILE_DEFINITIONS[kind];
      if (definition.pattern === "twin") {
        tempDir.set(-direction.z, 0, direction.x).normalize();
        for (const side of [-1, 1]) {
          tempOrigin.copy(origin).addScaledVector(tempDir, (definition.lateralOffset ?? 0.2) * side);
          const shotDirection = direction
            .clone()
            .applyAxisAngle(Y_AXIS, (definition.spreadRadians ?? 0.03) * side);
          spawnEnemyShot(tempOrigin, shotDirection, kind);
        }
        return;
      }
      if (definition.pattern === "radial") {
        const count = definition.burstCount ?? 6;
        const baseAngle = Math.atan2(direction.z, direction.x);
        for (let index = 0; index < count; index++) {
          const angle = baseAngle + (index / count) * Math.PI * 2;
          spawnEnemyShot(origin, new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)), kind);
        }
        return;
      }
      spawnEnemyShot(origin, direction, kind);
    };

    return () => {
      world.firePlayerProjectile = () => {};
      world.fireEnemyProjectile = () => {};
    };
  }, [world, playerShots, enemyShots]);

  useFrame((_, dt) => {
    if (performance.now() < world.hitStopUntil) return;
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
                session.recordDamageDealt(shot.damage);
                arenaAudio.sfx("hit");
                world.spawnDamageNumber(enemy.position.clone().setY(2), shot.damage);
                world.spawnEffect("burst", shot.position, ARENA_CONFIG.meta.accent, 0.45);
                if (shot.pierces > 0) {
                  shot.pierces -= 1;
                  shot.lastHitId = enemy.id;
                  break;
                }
                if (shot.bounces > 0) {
                  const next = nearestEnemy(world, shot.position, shot.bounceRange, enemy.id);
                  if (next) {
                    shot.bounces -= 1;
                    shot.lastHitId = enemy.id;
                    shot.lifeMs = WEAPON.projectileLifeMs;
                    shot.velocity
                      .set(next.position.x - shot.position.x, 0, next.position.z - shot.position.z)
                      .normalize()
                      .multiplyScalar(shot.speed);
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
          tempScale.setScalar(shot.scale);
          tempMatrix.compose(shot.position, tempQuat, tempScale);
          playerMesh.setMatrixAt(index, tempMatrix);
        } else {
          playerMesh.setMatrixAt(index, hiddenMatrix);
        }
      });
      playerMesh.instanceMatrix.needsUpdate = true;
    }

    const playerRadius = ARENA_CONFIG.player.radius;
    enemyShots.forEach((shot) => {
      if (!shot.active || !running) return;
      const definition = PROJECTILE_DEFINITIONS[shot.kind];
      shot.age += dt;
      shot.position.addScaledVector(shot.velocity, dt);
      shot.lifeMs -= stepMs;
      if (shot.lifeMs <= 0 || outOfBounds(shot.position, world.playerPosition)) {
        shot.active = false;
        return;
      }
      const dx = world.playerPosition.x - shot.position.x;
      const dz = world.playerPosition.z - shot.position.z;
      const hitRadius = playerRadius + definition.collisionRadius;
      if (dx * dx + dz * dz <= hitRadius * hitRadius) {
        const damageTaken = session.damagePlayer(
          shot.damage,
          `${ARENA_ENEMIES[shot.kind].label} · ${PROJECTILE_DEFINITIONS[shot.kind].label}`
        );
        if (damageTaken > 0) {
          world.spawnCombatText(
            world.playerPosition.clone().setY(2.3),
            `-${Math.round(damageTaken)}`,
            ARENA_CONFIG.meta.danger,
            1.5
          );
        }
        world.triggerScreenShake(shot.kind === "heavy" || shot.kind === "elite" ? 0.75 : 0.42);
        world.spawnEffect(
          definition.impactEffect,
          shot.position,
          definition.accent,
          definition.impactScale
        );
        shot.active = false;
      }
    });

    for (const kind of ENEMY_PROJECTILE_KINDS) {
      const mesh = enemyMeshRefs.current[kind];
      const halo = enemyHaloRefs.current[kind];
      if (!mesh && !halo) continue;
      const definition = PROJECTILE_DEFINITIONS[kind];
      enemyShots.forEach((shot, index) => {
        if (shot.active && shot.kind === kind) {
          if (definition.orientation === "forward") {
            tempDir.copy(shot.velocity).normalize();
            tempQuat.setFromUnitVectors(FORWARD, tempDir);
          } else {
            tempQuat.setFromAxisAngle(Y_AXIS, shot.age * 2.8);
          }
          tempMatrix.compose(shot.position, tempQuat, unitScale);
          mesh?.setMatrixAt(index, tempMatrix);
          tempScale.setScalar(definition.haloScale);
          tempMatrix.compose(shot.position, tempQuat.identity(), tempScale);
          halo?.setMatrixAt(index, tempMatrix);
        } else {
          mesh?.setMatrixAt(index, hiddenMatrix);
          halo?.setMatrixAt(index, hiddenMatrix);
        }
      });
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
      if (halo) halo.instanceMatrix.needsUpdate = true;
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
        <meshBasicMaterial color={playerAccent} toneMapped={false} />
      </instancedMesh>
      {ENEMY_PROJECTILE_KINDS.map((kind) => (
        <EnemyProjectileInstances
          key={kind}
          kind={kind}
          onModelRef={bindEnemyMesh}
          onHaloRef={bindEnemyHalo}
        />
      ))}
    </group>
  );
}

for (const definition of Object.values(PROJECTILE_DEFINITIONS)) {
  useGLTF.preload(definition.model);
}
