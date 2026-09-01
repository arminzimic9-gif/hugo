"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  BallCollider,
  RigidBody,
  interactionGroups,
  type RapierRigidBody,
} from "@react-three/rapier";
import ARENA_CONFIG from "@/data/arena-config.json";
import ARENA_ENEMIES from "@/data/arena-enemies.json";
import SPAWN_TABLE from "@/data/arena-spawn-tables.json";
import { rollMaterialForLevel } from "@/data/crafting";
import { rollArenaPowerDrop } from "@/data/arenaPowerDrops";
import { bossArrivalTransmission, bossDefeatTransmission } from "@/data/arenaStory";
import { ARENA_BOSSES, isArenaBossTier } from "@/data/arenaBosses";
import { arenaAudio } from "@/lib/arenaAudio";
import { getArenaWaveState } from "@/lib/arenaWaves";
import { useArenaSession } from "@/store/arenaSession";
import {
  useArenaWorld,
  type ArenaWorld,
  type EnemyHandle,
  type EnemyKind,
  type EnemyProjectileKind,
} from "./world";

type Spawned = {
  id: number;
  kind: EnemyKind;
  x: number;
  z: number;
  bossTier?: number;
  bossGroupSize?: number;
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function EnemyModel({ kind }: { kind: EnemyKind }) {
  const def = ARENA_ENEMIES[kind];
  const { scene } = useGLTF(def.model);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.z, 0.001);
    const scale = (def.radius * 2.4) / maxDim;
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) child.castShadow = true;
    });
    return clone;
  }, [scene, def.radius]);
  return <primitive object={model} />;
}

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
  onDespawn,
}: {
  spawned: Spawned;
  world: ArenaWorld;
  onDeath: (spawned: Spawned, position: THREE.Vector3) => void;
  onDespawn: (id: number) => void;
}) {
  const def = ARENA_ENEMIES[spawned.kind];
  const bodyRef = useRef<RapierRigidBody>(null);
  const meshGroupRef = useRef<THREE.Group>(null);
  const deadRef = useRef(false);
  const fireTimer = useRef(800 + Math.random() * Math.max(1, def.fireIntervalMs));
  const age = useRef(Math.random() * Math.PI * 2);
  const bossAbilityTimer = useRef(2200 + (spawned.id % 5) * 180);
  const bossAbilityFireAt = useRef(0);

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
    if (performance.now() < world.hitStopUntil) {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    const translation = body.translation();
    handle.position.set(translation.x, translation.y, translation.z);

    if (handle.health <= 0) {
      deadRef.current = true;
      onDeath(spawned, handle.position.clone());
      return;
    }

    const session = useArenaSession.getState();
    if (session.phase !== "running") {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    age.current += dt;
    const dx = world.playerPosition.x - translation.x;
    const dz = world.playerPosition.z - translation.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const dirX = dx / dist;
    const dirZ = dz / dist;

    // Predaleko od igraca na beskonacnoj mapi — tiho ukloni bez nagrade.
    if (dist > SPAWN_TABLE.despawnDistance) {
      if (isArenaBossTier(spawned.bossTier)) {
        // Boss se nikad ne gubi: kljuc za portal ne smije nestati u beskonacnosti.
        // Umjesto despawna relociraj ga na spawn prsten oko igraca da nastavi lov.
        body.setTranslation(
          {
            x: world.playerPosition.x - dirX * SPAWN_TABLE.spawnDistance,
            y: translation.y,
            z: world.playerPosition.z - dirZ * SPAWN_TABLE.spawnDistance,
          },
          true
        );
        return;
      }
      deadRef.current = true;
      onDespawn(spawned.id);
      return;
    }

    // Time Warp usporava neprijatelje
    const slowMult =
      performance.now() < session.buffs.slowUntil ? session.buffs.slowFactor : 1;
    const moveSpeed = def.speed * slowMult;

    let vx = dirX * moveSpeed;
    let vz = dirZ * moveSpeed;
    if (def.behavior === "ranged" && dist <= def.preferredDistance + 1) {
      // Ranged enemies strafe while closing the ring, but never flee. A stable
      // inward component keeps large waves aggressive and prevents idle walls.
      const side = spawned.id % 2 === 0 ? 1 : -1;
      const inwardWeight = dist < def.preferredDistance ? 0.38 : 0.58;
      const orbitWeight = dist < def.preferredDistance ? 0.72 : 0.56;
      const steerX = dirX * inwardWeight - dirZ * side * orbitWeight;
      const steerZ = dirZ * inwardWeight + dirX * side * orbitWeight;
      const steerLength = Math.hypot(steerX, steerZ) || 1;
      vx = (steerX / steerLength) * moveSpeed;
      vz = (steerZ / steerLength) * moveSpeed;
    }
    body.setLinvel({ x: vx, y: 0, z: vz }, true);

    // Contact damage
    if (dist < def.radius + ARENA_CONFIG.player.radius + 0.2) {
      const damageTaken = session.damagePlayer(def.contactDamage, `${def.label} · CONTACT`);
      if (damageTaken > 0) {
        world.spawnCombatText(
          world.playerPosition.clone().setY(2.3),
          `-${Math.round(damageTaken)}`,
          ARENA_CONFIG.meta.danger,
          1.5
        );
      }
      world.triggerScreenShake(0.48, 120);
      if (def.behavior === "melee") handle.health = 0; // kamikaze
    }

    // Ranged fire
    if (def.behavior === "ranged" && dist < ARENA_CONFIG.weapon.targetRange + 4) {
      fireTimer.current -= dt * 1000;
      if (fireTimer.current <= 0) {
        fireTimer.current = def.fireIntervalMs;
        const origin = handle.position.clone().setY(1);
        const direction = new THREE.Vector3(dirX, 0, dirZ);
        const projectileKind: EnemyProjectileKind =
          spawned.bossTier === 1
            ? "heavy"
            : spawned.bossTier === 2
              ? "hunter"
              : spawned.bossTier === 3
                ? "elite"
                : (spawned.kind as EnemyProjectileKind);
        world.fireEnemyProjectile(origin, direction, projectileKind);
      }
    }

    if (isArenaBossTier(spawned.bossTier)) {
      const boss = ARENA_BOSSES[spawned.bossTier];
      const now = performance.now();
      if (bossAbilityFireAt.current > 0 && now >= bossAbilityFireAt.current) {
        const origin = handle.position.clone().setY(1.3);
        const direction = new THREE.Vector3(dirX, 0, dirZ);
        if (spawned.bossTier === 1) {
          for (const offset of [-0.42, -0.21, 0, 0.21, 0.42]) {
            world.fireEnemyProjectile(
              origin,
              direction.clone().applyAxisAngle(Y_AXIS, offset),
              "heavy"
            );
          }
        } else if (spawned.bossTier === 2) {
          const sideBias = spawned.id % 2 === 0 ? 0.16 : -0.16;
          for (const offset of [-0.3, -0.1, 0.1, 0.3]) {
            world.fireEnemyProjectile(
              origin,
              direction.clone().applyAxisAngle(Y_AXIS, offset + sideBias),
              "hunter"
            );
          }
        } else {
          world.fireEnemyProjectile(
            origin,
            direction.clone().applyAxisAngle(Y_AXIS, (spawned.id % 3) * 0.35),
            "elite"
          );
        }
        world.spawnEffect("nova", origin, boss.accent, spawned.bossTier === 3 ? 1.55 : 1.05);
        world.triggerScreenShake(0.55 + spawned.bossTier * 0.14, 180);
        bossAbilityFireAt.current = 0;
      } else if (bossAbilityFireAt.current === 0) {
        bossAbilityTimer.current -= dt * 1000;
        if (bossAbilityTimer.current <= 0) {
          bossAbilityTimer.current = boss.specialCooldownMs;
          bossAbilityFireAt.current = now + boss.telegraphMs;
          const warning = handle.position.clone().setY(0.18);
          world.spawnEffect("ring", warning, boss.accent, 1.45 + spawned.bossTier * 0.22);
          world.spawnCombatText(
            handle.position.clone().setY(3.7),
            boss.ability,
            boss.accent,
            1.65
          );
          arenaAudio.sfx("ability");
        }
      }
    }

    const meshGroup = meshGroupRef.current;
    if (meshGroup) {
      meshGroup.position.y =
        def.placeholder.hoverHeight - def.radius + Math.sin(age.current * 3) * 0.1;
      if (def.modelReady) {
        // Modeli gledaju u smjeru kretanja
        const targetAngle = Math.atan2(vx, vz);
        if (Math.abs(vx) + Math.abs(vz) > 0.05) {
          let delta = targetAngle - meshGroup.rotation.y;
          delta = Math.atan2(Math.sin(delta), Math.cos(delta));
          meshGroup.rotation.y += delta * Math.min(1, dt * 6);
        }
      } else {
        meshGroup.rotation.y += dt * 1.4;
      }
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      lockRotations
      gravityScale={0}
      enabledTranslations={[true, false, true]}
      position={[spawned.x, def.radius + 0.4, spawned.z]}
      linearDamping={0.6}
    >
      <BallCollider
        args={[def.radius]}
        collisionGroups={interactionGroups([1], [0])}
      />
      <group ref={meshGroupRef}>
        {def.modelReady ? (
          <Suspense fallback={<PlaceholderMesh kind={spawned.kind} />}>
            <EnemyModel kind={spawned.kind} />
          </Suspense>
        ) : (
          <PlaceholderMesh kind={spawned.kind} />
        )}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -def.radius - 0.32, 0]}>
        <ringGeometry args={[def.radius * 0.85, def.radius * 1.05, 32]} />
        <meshBasicMaterial color={def.placeholder.color} transparent opacity={0.55} toneMapped={false} />
      </mesh>
    </RigidBody>
  );
}

for (const def of Object.values(ARENA_ENEMIES)) {
  if (def.modelReady) useGLTF.preload(def.model);
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
  const lastTestJumpRevision = useRef(0);
  const activePhaseIndex = useRef(0);
  const aliveCount = useRef(0);
  aliveCount.current = enemies.length;

  const spawnEnemy = useCallback(
    (
      kind: EnemyKind,
      forcedPosition?: { x: number; z: number },
      bossMeta?: Pick<Spawned, "bossTier" | "bossGroupSize">
    ) => {
      if (aliveCount.current >= ARENA_CONFIG.limits.enemies) return;
      const angle = Math.random() * Math.PI * 2;
      const x =
        forcedPosition?.x ?? world.playerPosition.x + Math.cos(angle) * SPAWN_TABLE.spawnDistance;
      const z =
        forcedPosition?.z ?? world.playerPosition.z + Math.sin(angle) * SPAWN_TABLE.spawnDistance;
      const id = ++sequence.current;
      setEnemies((prev) => [...prev, { id, kind, x, z, ...bossMeta }]);
    },
    [world]
  );

  const handleDespawn = useCallback((id: number) => {
    setEnemies((prev) => prev.filter((enemy) => enemy.id !== id));
  }, []);

  const handleDeath = useCallback(
    (spawned: Spawned, position: THREE.Vector3) => {
      const { id, kind, bossTier, bossGroupSize } = spawned;
      const def = ARENA_ENEMIES[kind];
      const session = useArenaSession.getState();
      const isBoss = isArenaBossTier(bossTier);
      session.addScore(def.score);
      const milestone = session.addKill();
      const bossRewardReady = isBoss
        ? session.recordBossUnitKill(bossTier, bossGroupSize ?? 1)
        : false;
      if (bossRewardReady && bossTier && session.environment === "surface") {
        const transmission = bossDefeatTransmission(bossTier);
        if (transmission) session.queueStoryTransmission(transmission);
      }
      if (kind === "elite" || isBoss) session.recordEliteKill();
      arenaAudio.sfx("kill");
      world.triggerHitStop(isBoss || kind === "elite" ? 70 : 42);
      world.triggerScreenShake(isBoss || kind === "elite" ? 0.95 : kind === "heavy" ? 0.55 : 0.28);
      world.spawnDrop(position, def.xp);
      const healthDropChance = isBoss || kind === "elite" ? 1 : kind === "heavy" ? 0.2 : 0.055;
      if (session.health < session.maxHealth && Math.random() < healthDropChance) {
        world.spawnHealthDrop(position.clone().add(new THREE.Vector3(0.75, 0, 0.45)), isBoss || kind === "elite" ? 42 : kind === "heavy" ? 28 : 20);
      }
      const materialDropCount =
        isBoss || kind === "elite" ? 3 : kind === "heavy" ? 1 : Math.random() < 0.075 ? 1 : 0;
      const materialLevel = Math.min(
        10,
        session.xpLevel + (isBoss || kind === "elite" ? 2 : kind === "heavy" ? 1 : 0)
      );
      for (let dropIndex = 0; dropIndex < materialDropCount; dropIndex++) {
        const angle = (dropIndex / Math.max(1, materialDropCount)) * Math.PI * 2;
        const offset = new THREE.Vector3(Math.cos(angle) * 0.95, 0, Math.sin(angle) * 0.95);
        world.spawnMaterialDrop(
          position.clone().add(offset),
          rollMaterialForLevel(materialLevel)
        );
      }
      const powerDropChance = isBoss || kind === "elite" ? 0.8 : kind === "heavy" ? 0.16 : 0.035;
      if (Math.random() < powerDropChance) {
        const rolled = rollArenaPowerDrop();
        const powerId = rolled === "artifact_residue" && session.relicAugmentLevel === 0
          ? "cycle_surge"
          : rolled;
        world.spawnPowerDrop(
          position.clone().add(new THREE.Vector3(-0.8, 0, 0.65)),
          powerId
        );
      }
      if (bossRewardReady && session.environment === "underground") {
        world.spawnPowerDrop(
          position.clone().add(new THREE.Vector3(0, 0, -1.25)),
          "artifact_residue"
        );
        world.spawnEffect("nova", position, "#62ffd1", 2.1);
        world.spawnCombatText(
          position.clone().setY(3.5),
          `DEPTH ${session.undergroundDepth} · ARTIFACT RESIDUE CACHE`,
          "#62ffd1",
          2.3
        );
        world.triggerScreenShake(1.35, 460);
      } else if (bossRewardReady && bossTier === 1) {
        world.spawnRelicDrop(position.clone().add(new THREE.Vector3(0, 0, -1.25)));
        world.spawnEffect("nova", position, "#eaffff", 1.8);
        world.spawnCombatText(
          position.clone().setY(3.4),
          "BOSS I · ARTIFACT SPARK DROPPED",
          "#eaffff",
          2.2
        );
        world.triggerScreenShake(1.2, 420);
      } else if (bossRewardReady && bossTier === 2) {
        world.spawnBossRewardDrop(
          position.clone().add(new THREE.Vector3(0, 0, -1.25)),
          "class_augment"
        );
        world.spawnEffect("nova", position, "#b87cff", 2.05);
        world.spawnCombatText(
          position.clone().setY(3.5),
          "BOSS II · CLASS AUGMENT DROPPED",
          "#d6adff",
          2.3
        );
        world.triggerScreenShake(1.35, 460);
      } else if (bossRewardReady && bossTier === 3) {
        world.spawnBossRewardDrop(
          position.clone().add(new THREE.Vector3(0, 0, -1.25)),
          "mythic_core"
        );
        world.spawnEffect("nova", position, "#ffbd42", 2.3);
        world.spawnCombatText(
          position.clone().setY(3.5),
          "BOSS III · MYTHIC CORE DROPPED",
          "#ffda78",
          2.45
        );
        world.triggerScreenShake(1.5, 520);
      }
      // PoE-style smrt: eksplozija cestica + sok-prsten u boji neprijatelja
      world.spawnEffect("burst", position, def.placeholder.color, Math.min(2, def.radius * 1.1));
      world.spawnEffect("ring", position, def.placeholder.color, Math.min(2.4, def.radius));

      if (milestone) {
        const origin = world.playerPosition.clone().setY(1);
        const radiusSq = milestone.radius * milestone.radius;
        for (const enemy of world.enemies.values()) {
          if (enemy.id === id || enemy.health <= 0) continue;
          const dx = enemy.position.x - origin.x;
          const dz = enemy.position.z - origin.z;
          if (dx * dx + dz * dz <= radiusSq) enemy.hit(Number.MAX_SAFE_INTEGER);
        }
        world.spawnEffect("nova", origin, milestone.color, milestone.radius / 8);
        world.spawnEffect("ring", origin, milestone.color, milestone.radius / 10);
        world.spawnCombatText(
          origin.clone().setY(3),
          `${milestone.combo}× ${milestone.label}`,
          milestone.color,
          1.55
        );
        world.triggerHitStop(115);
        world.triggerScreenShake(1.4, 360);
      } else {
        const combo = useArenaSession.getState().combo;
        if (combo >= 10 && combo % 10 === 0) {
          const surgeTier = Math.min(10, combo / 10);
          const surgeLabels = ["ARC POP", "RIFT BLAST", "NEON CASCADE", "CHAIN REACTION"];
          const surgeColors = ["#37f6ff", "#b87cff", "#ffcf40", "#ff5ad9"];
          const label = surgeLabels[(surgeTier - 1) % surgeLabels.length];
          const color = surgeColors[(surgeTier - 1) % surgeColors.length];
          const origin = world.playerPosition.clone().setY(1.25);
          world.spawnCombatText(
            origin.clone().setY(3.4),
            `${combo}× ${label}`,
            color,
            1.9 + Math.min(0.35, surgeTier * 0.04)
          );
          world.spawnComboSurge(origin, color, surgeTier, () => {
            const liveSession = useArenaSession.getState();
            const radius = 5.5 + Math.min(4.5, surgeTier * 0.45);
            const radiusSq = radius * radius;
            const surgeDamage =
              ARENA_CONFIG.weapon.damage * liveSession.mods.damageMult * (1.4 + surgeTier * 0.14);
            for (const enemy of world.enemies.values()) {
              if (enemy.health <= 0) continue;
              const dx = enemy.position.x - origin.x;
              const dz = enemy.position.z - origin.z;
              if (dx * dx + dz * dz > radiusSq) continue;
              enemy.hit(surgeDamage);
              liveSession.recordDamageDealt(surgeDamage);
              world.spawnDamageNumber(enemy.position.clone().setY(2.25), surgeDamage, color);
            }
            const projectileCount = 6 + Math.min(10, surgeTier);
            for (let projectile = 0; projectile < projectileCount; projectile++) {
              const angle = (projectile / projectileCount) * Math.PI * 2;
              world.firePlayerProjectile(
                origin,
                new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
                {
                  damage: ARENA_CONFIG.weapon.damage * liveSession.mods.damageMult,
                  bounces: 0,
                  bounceRange: 0,
                  pierces: Math.min(2, Math.floor(surgeTier / 3)),
                }
              );
            }
            arenaAudio.sfx("ability");
            world.triggerHitStop(72);
            world.triggerScreenShake(0.72 + surgeTier * 0.055, 230);
          });
        }
      }

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
                pierces: 0,
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
    if (session.testJumpRevision !== lastTestJumpRevision.current) {
      scriptedFired.current.clear();
      const target = session.testTargetElapsed ?? elapsed;
      for (const scripted of SPAWN_TABLE.scripted) {
        if (scripted.second < target) scriptedFired.current.add(scripted.second);
      }
      spawnTimer.current = 0;
      lastTestJumpRevision.current = session.testJumpRevision;
    }
    const wave = getArenaWaveState(elapsed);
    if (wave.index !== activePhaseIndex.current) {
      activePhaseIndex.current = wave.index;
      arenaAudio.sfx("ability");
    }

    for (const scripted of SPAWN_TABLE.scripted) {
      if (elapsed >= scripted.second && !scriptedFired.current.has(scripted.second)) {
        scriptedFired.current.add(scripted.second);
        if (isArenaBossTier(scripted.bossTier)) {
          // Timer hold prati samo grupe koje su stvarno usle u arenu.
          session.markBossGroupEngaged(scripted.bossTier);
          arenaAudio.sfx("eliteSpawn");
          const impactAngle = Math.random() * Math.PI * 2;
          const impactDistance = 14 + scripted.count * 1.5;
          const impactX = world.playerPosition.x + Math.cos(impactAngle) * impactDistance;
          const impactZ = world.playerPosition.z + Math.sin(impactAngle) * impactDistance;
          const impactRadius = 9.5 + scripted.count * 2.25;
          session.triggerCataclysm(impactX, impactZ, impactRadius, scripted.count);
          for (const enemy of world.enemies.values()) {
            if (enemy.kind === "elite" || enemy.health <= 0) continue;
            const dx = enemy.position.x - impactX;
            const dz = enemy.position.z - impactZ;
            if (dx * dx + dz * dz <= impactRadius * impactRadius) {
              enemy.hit(Number.MAX_SAFE_INTEGER);
            }
          }
          for (let i = 0; i < scripted.count; i++) {
            const bossAngle = (i / scripted.count) * Math.PI * 2;
            const spread = scripted.count === 1 ? 0 : 2.8;
            const bossTier = scripted.bossTier;
            if (i === 0 && session.environment === "surface") {
              const transmission = bossArrivalTransmission(bossTier);
              if (transmission) session.queueStoryTransmission(transmission);
            }
            spawnEnemy(
              scripted.kind as EnemyKind,
              {
                x: impactX + Math.cos(bossAngle) * spread,
                z: impactZ + Math.sin(bossAngle) * spread,
              },
              { bossTier, bossGroupSize: scripted.count }
            );
          }
        } else {
          for (let i = 0; i < scripted.count; i++) spawnEnemy(scripted.kind as EnemyKind);
        }
      }
    }

    if (wave.breakWindow) {
      spawnTimer.current = Math.max(spawnTimer.current, 450);
      return;
    }

    const phase = wave.phase;
    const interval = THREE.MathUtils.lerp(
      phase.intervalStartMs,
      phase.intervalEndMs,
      wave.phaseProgress
    );

    spawnTimer.current -= dt * 1000 * Math.max(1, session.testTimeScale);
    if (spawnTimer.current <= 0) {
      spawnTimer.current = interval;
      spawnEnemy(pickWeightedKind(phase.weights));
    }

  });

  return (
    <group>
      {enemies.map((spawned) => (
        <Enemy
          key={spawned.id}
          spawned={spawned}
          world={world}
          onDeath={handleDeath}
          onDespawn={handleDespawn}
        />
      ))}
    </group>
  );
}
