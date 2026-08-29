"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BallCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import ARENA_CONFIG from "@/data/arena-config.json";
import ARENA_ENEMIES from "@/data/arena-enemies.json";
import SPAWN_TABLE from "@/data/arena-spawn-tables.json";
import { useArenaSession } from "@/store/arenaSession";
import { useArenaWorld, type ArenaWorld, type EnemyHandle, type EnemyKind } from "./world";
import { ARENA_BOUNDS } from "./TileFloor";

type Spawned = { id: number; kind: EnemyKind; x: number; z: number };

function PlaceholderMesh({ kind }: { kind: EnemyKind }) {
  const def = ARENA_ENEMIES[kind];
  const { shape, size, color } = def.placeholder;
  const geometry = useMemo(() => {
    switch (shape) {
      case "box":
        return new THREE.BoxGeometry(size, size, size);
      case "cone":
        return new THREE.ConeGeometry(size * 0.55, size, 6);
      case "tetrahedron":
        return new THREE.TetrahedronGeometry(size * 0.7);
      case "dodecahedron":
        return new THREE.DodecahedronGeometry(size * 0.62);
      case "octahedron":
      default:
        return new THREE.OctahedronGeometry(size * 0.62);
    }
  }, [shape, size]);
  return (
    <group>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial
          color="#0d1424"
          emissive={color}
          emissiveIntensity={1.7}
          metalness={0.55}
          roughness={0.35}
        />
      </mesh>
      <mesh geometry={geometry} scale={1.06}>
        <meshBasicMaterial color={color} wireframe transparent opacity={0.35} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Enemy({
  spawned,
  world,
  onDeath,
}: {
  spawned: Spawned;
  world: ArenaWorld;
  onDeath: (id: number, kind: EnemyKind, position: THREE.Vector3) => void;
}) {
  const def = ARENA_ENEMIES[spawned.kind];
  const bodyRef = useRef<RapierRigidBody>(null);
  const meshGroupRef = useRef<THREE.Group>(null);
  const deadRef = useRef(false);
  const fireTimer = useRef(800 + Math.random() * Math.max(1, def.fireIntervalMs));
  const age = useRef(Math.random() * Math.PI * 2);

  const handle = useMemo<EnemyHandle>(() => {
    const h: EnemyHandle = {
      id: spawned.id,
      kind: spawned.kind,
      position: new THREE.Vector3(spawned.x, 0, spawned.z),
      health: def.health,
      hit: (damage: number) => {
        h.health -= damage;
      },
    };
    return h;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    world.enemies.set(spawned.id, handle);
    return () => {
      world.enemies.delete(spawned.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body || deadRef.current) return;

    const translation = body.translation();
    handle.position.set(translation.x, translation.y, translation.z);

    if (handle.health <= 0) {
      deadRef.current = true;
      onDeath(spawned.id, spawned.kind, handle.position.clone());
      return;
    }

    const session = useArenaSession.getState();
    const currentVel = body.linvel();
    if (session.phase !== "running") {
      body.setLinvel({ x: 0, y: currentVel.y, z: 0 }, true);
      return;
    }

    age.current += dt;
    const dx = world.playerPosition.x - translation.x;
    const dz = world.playerPosition.z - translation.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const dirX = dx / dist;
    const dirZ = dz / dist;

    let vx = 0;
    let vz = 0;
    if (def.behavior === "melee") {
      vx = dirX * def.speed;
      vz = dirZ * def.speed;
    } else if (dist > def.preferredDistance + 1) {
      vx = dirX * def.speed;
      vz = dirZ * def.speed;
    } else if (dist < def.preferredDistance - 1.5) {
      vx = -dirX * def.speed;
      vz = -dirZ * def.speed;
    } else {
      const side = spawned.id % 2 === 0 ? 1 : -1;
      vx = -dirZ * side * def.speed * 0.6;
      vz = dirX * side * def.speed * 0.6;
    }
    body.setLinvel({ x: vx, y: currentVel.y, z: vz }, true);

    // Contact damage
    if (dist < def.radius + ARENA_CONFIG.player.radius + 0.2) {
      session.damagePlayer(def.contactDamage);
      if (def.behavior === "melee") handle.health = 0; // kamikaze
    }

    // Ranged fire
    if (def.behavior === "ranged" && dist < ARENA_CONFIG.weapon.targetRange + 4) {
      fireTimer.current -= dt * 1000;
      if (fireTimer.current <= 0) {
        fireTimer.current = def.fireIntervalMs;
        const origin = handle.position.clone().setY(1);
        const direction = new THREE.Vector3(dirX, 0, dirZ);
        world.fireEnemyProjectile(
          origin,
          direction,
          def.projectileSpeed,
          def.projectileDamage,
          def.placeholder.color
        );
      }
    }

    const meshGroup = meshGroupRef.current;
    if (meshGroup) {
      meshGroup.position.y =
        def.placeholder.hoverHeight - def.radius + Math.sin(age.current * 3) * 0.1;
      meshGroup.rotation.y += dt * 1.4;
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      lockRotations
      position={[spawned.x, def.radius + 0.4, spawned.z]}
      linearDamping={0.6}
    >
      <BallCollider args={[def.radius]} />
      <group ref={meshGroupRef}>
        <PlaceholderMesh kind={spawned.kind} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -def.radius - 0.32, 0]}>
        <ringGeometry args={[def.radius * 0.85, def.radius * 1.05, 32]} />
        <meshBasicMaterial color={def.placeholder.color} transparent opacity={0.55} toneMapped={false} />
      </mesh>
    </RigidBody>
  );
}

function pickWeightedKind(weights: Partial<Record<string, number>>): EnemyKind {
  let total = 0;
  for (const weight of Object.values(weights)) total += weight ?? 0;
  let roll = Math.random() * total;
  for (const [kind, weight] of Object.entries(weights)) {
    roll -= weight ?? 0;
    if (roll <= 0) return kind as EnemyKind;
  }
  return Object.keys(weights)[0] as EnemyKind;
}

export default function Enemies() {
  const world = useArenaWorld();
  const [enemies, setEnemies] = useState<Spawned[]>([]);
  const sequence = useRef(0);
  const spawnTimer = useRef(SPAWN_TABLE.phases[0].intervalStartMs);
  const scriptedFired = useRef(new Set<number>());
  const aliveCount = useRef(0);
  aliveCount.current = enemies.length;

  const spawnEnemy = useCallback(
    (kind: EnemyKind) => {
      if (aliveCount.current >= ARENA_CONFIG.limits.enemies) return;
      const angle = Math.random() * Math.PI * 2;
      const marginX = ARENA_BOUNDS.halfWidth - 2;
      const marginZ = ARENA_BOUNDS.halfDepth - 2;
      const x = THREE.MathUtils.clamp(
        world.playerPosition.x + Math.cos(angle) * SPAWN_TABLE.spawnDistance,
        -marginX,
        marginX
      );
      const z = THREE.MathUtils.clamp(
        world.playerPosition.z + Math.sin(angle) * SPAWN_TABLE.spawnDistance,
        -marginZ,
        marginZ
      );
      const id = ++sequence.current;
      setEnemies((prev) => [...prev, { id, kind, x, z }]);
    },
    [world]
  );

  const handleDeath = useCallback(
    (id: number, kind: EnemyKind, position: THREE.Vector3) => {
      const def = ARENA_ENEMIES[kind];
      const session = useArenaSession.getState();
      session.addScore(def.score);
      session.addKill();
      world.spawnDrop(position, def.xp);

      const mods = session.mods;
      if (mods.clusterProjectiles > 0) {
        world.killsSinceCluster += 1;
        if (world.killsSinceCluster >= mods.clusterEveryKills) {
          world.killsSinceCluster = 0;
          const origin = world.playerPosition.clone().setY(1);
          for (let i = 0; i < mods.clusterProjectiles; i++) {
            const angle = (i / mods.clusterProjectiles) * Math.PI * 2;
            world.firePlayerProjectile(
              origin,
              new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
              {
                damage: ARENA_CONFIG.weapon.damage * mods.damageMult,
                bounces: 0,
                bounceRange: 0,
              }
            );
          }
        }
      }
      setEnemies((prev) => prev.filter((enemy) => enemy.id !== id));
    },
    [world]
  );

  useFrame((_, dt) => {
    const session = useArenaSession.getState();
    if (session.phase !== "running") return;

    const elapsed = ARENA_CONFIG.meta.durationSeconds - session.timeLeft;
    let phaseStart = 0;
    let phase = SPAWN_TABLE.phases[SPAWN_TABLE.phases.length - 1];
    for (const candidate of SPAWN_TABLE.phases) {
      if (elapsed <= candidate.untilSecond) {
        phase = candidate;
        break;
      }
      phaseStart = candidate.untilSecond;
    }
    const phaseProgress = THREE.MathUtils.clamp(
      (elapsed - phaseStart) / Math.max(1, phase.untilSecond - phaseStart),
      0,
      1
    );
    const interval = THREE.MathUtils.lerp(
      phase.intervalStartMs,
      phase.intervalEndMs,
      phaseProgress
    );

    spawnTimer.current -= dt * 1000;
    if (spawnTimer.current <= 0) {
      spawnTimer.current = interval;
      spawnEnemy(pickWeightedKind(phase.weights));
    }

    for (const scripted of SPAWN_TABLE.scripted) {
      if (elapsed >= scripted.second && !scriptedFired.current.has(scripted.second)) {
        scriptedFired.current.add(scripted.second);
        for (let i = 0; i < scripted.count; i++) spawnEnemy(scripted.kind as EnemyKind);
      }
    }
  });

  return (
    <group>
      {enemies.map((spawned) => (
        <Enemy key={spawned.id} spawned={spawned} world={world} onDeath={handleDeath} />
      ))}
    </group>
  );
}
