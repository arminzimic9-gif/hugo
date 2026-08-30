"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { CapsuleCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import ARENA_CONFIG from "@/data/arena-config.json";
import ARENA_ABILITIES from "@/data/arena-abilities.json";
import { HEROES } from "@/data/heroes";
import { useGameStore } from "@/store/gameStore";
import { useArenaSession } from "@/store/arenaSession";
import { nearestEnemy, useArenaWorld } from "./world";

const PLAYER = ARENA_CONFIG.player;
const WEAPON = ARENA_CONFIG.weapon;
const CAMERA = ARENA_CONFIG.camera;

function usePlayerModel(url: string) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const scale = PLAYER.modelHeight / Math.max(0.001, size.y);
    clone.scale.setScalar(scale);
    const scaledBox = new THREE.Box3().setFromObject(clone);
    clone.position.y -= scaledBox.min.y;
    clone.position.x -= (scaledBox.min.x + scaledBox.max.x) / 2;
    clone.position.z -= (scaledBox.min.z + scaledBox.max.z) / 2;
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) child.castShadow = true;
    });
    return clone;
  }, [scene]);
}

export default function Player({ heroModel }: { heroModel: string }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const modelGroupRef = useRef<THREE.Group>(null);
  const world = useArenaWorld();
  const model = usePlayerModel(heroModel);
  const camera = useThree((state) => state.camera);

  const input = useRef({ up: false, down: false, left: false, right: false });
  const shieldRef = useRef<THREE.Mesh>(null);
  const fireTimer = useRef(0);
  const headingAngle = useRef(0);
  const cameraTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    const keyMap: Record<string, keyof typeof input.current> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      KeyW: "up",
      KeyS: "down",
      KeyA: "left",
      KeyD: "right",
    };
    const abilityByCode: Record<string, string> = { KeyQ: "nova", KeyE: "timewarp", KeyR: "overdrive" };

    // WoW/PoE stil: svaka moc ima svoj efekat kad se aktivira
    const triggerAbility = (abilityId: string) => {
      const ability = ARENA_ABILITIES.find((a) => a.id === abilityId);
      if (!ability) return;
      if (!useGameStore.getState().stats.skills.includes(ability.skillId)) return;
      const session = useArenaSession.getState();
      if (!session.activateAbility(ability.id)) return;
      const origin = world.playerPosition.clone().setY(1);
      const params = ability.params as Partial<Record<string, number>>;
      if (ability.kind === "nova") {
        const radius = params.radius ?? 8;
        const damage = (params.damage ?? 3) * session.mods.damageMult;
        for (const enemy of world.enemies.values()) {
          const dx = enemy.position.x - origin.x;
          const dz = enemy.position.z - origin.z;
          if (dx * dx + dz * dz <= radius * radius) enemy.hit(damage);
        }
        world.spawnEffect("nova", origin, ability.color, radius / 9);
      } else {
        world.spawnEffect("nova", origin, ability.color, 0.7);
      }
    };

    const onKey = (pressed: boolean) => (event: KeyboardEvent) => {
      if (pressed && !event.repeat) {
        const abilityId = event.code === "KeyF" ? "barrier" : abilityByCode[event.code];
        if (abilityId) triggerAbility(abilityId);
      }
      const key = keyMap[event.code];
      if (!key) return;
      input.current[key] = pressed;
      event.preventDefault();
    };
    const down = onKey(true);
    const up = onKey(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    world.playerBody = bodyRef.current;
    return () => {
      world.playerBody = null;
    };
  }, [world]);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body) return;
    const session = useArenaSession.getState();
    const running = session.phase === "running";

    const translation = body.translation();
    world.playerPosition.set(translation.x, translation.y, translation.z);

    // Movement
    const keys = input.current;
    const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const moveZ = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    const length = Math.hypot(moveX, moveZ);
    const speed = PLAYER.speed * session.mods.speedMult;
    if (running && length > 0) {
      body.setLinvel({ x: (moveX / length) * speed, y: 0, z: (moveZ / length) * speed }, true);
      headingAngle.current = Math.atan2(moveX, moveZ);
    } else {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    const modelGroup = modelGroupRef.current;
    if (modelGroup) {
      let delta = headingAngle.current - modelGroup.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      modelGroup.rotation.y += delta * Math.min(1, dt * 12);
    }

    // Auto-fire at the nearest enemy
    if (running) {
      fireTimer.current -= dt * 1000;
      if (fireTimer.current <= 0) {
        const target = nearestEnemy(world, world.playerPosition, WEAPON.targetRange);
        if (target) {
          const direction = new THREE.Vector3(
            target.position.x - world.playerPosition.x,
            0,
            target.position.z - world.playerPosition.z
          ).normalize();
          const origin = world.playerPosition.clone().setY(1);
          world.firePlayerProjectile(origin, direction, {
            damage: WEAPON.damage * session.mods.damageMult,
            bounces: session.mods.bounces,
            bounceRange: session.mods.bounceRange,
          });
          const overdriveMult =
            performance.now() < session.buffs.overdriveUntil ? session.buffs.overdriveMult : 1;
          fireTimer.current = (WEAPON.fireIntervalMs * session.mods.fireIntervalMult) / overdriveMult;
        }
      }
    }

    // Barrier bubble oko igraca dok stit traje
    const shield = shieldRef.current;
    if (shield) {
      const active = performance.now() < session.buffs.shieldUntil;
      shield.visible = active;
      if (active) {
        const pulse = 1 + Math.sin(performance.now() * 0.012) * 0.05;
        shield.scale.setScalar(pulse);
        shield.rotation.y += dt * 1.5;
      }
    }

    // Top-down follow camera
    cameraTarget.current.set(
      translation.x,
      CAMERA.height,
      translation.z + CAMERA.offsetZ
    );
    camera.position.lerp(cameraTarget.current, Math.min(1, dt * CAMERA.followLerp));
    camera.lookAt(translation.x, 0, translation.z);
  });

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      lockRotations
      gravityScale={0}
      enabledTranslations={[true, false, true]}
      position={[0, 0, 4]}
      linearDamping={0.4}
    >
      <CapsuleCollider args={[PLAYER.modelHeight / 2 - PLAYER.radius, PLAYER.radius]} position={[0, PLAYER.modelHeight / 2, 0]} />
      <group ref={modelGroupRef}>
        <primitive object={model} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.75, 0.92, 48]} />
        <meshBasicMaterial color={ARENA_CONFIG.meta.accent} transparent opacity={0.65} toneMapped={false} />
      </mesh>
      <mesh ref={shieldRef} position={[0, PLAYER.modelHeight / 2, 0]} visible={false}>
        <sphereGeometry args={[1.35, 24, 16]} />
        <meshBasicMaterial
          color="#37ffb0"
          transparent
          opacity={0.16}
          toneMapped={false}
          depthWrite={false}
          side={THREE.DoubleSide}
          wireframe
        />
      </mesh>
      <pointLight color={ARENA_CONFIG.meta.accent} intensity={8} distance={9} position={[0, 2.4, 0]} />
    </RigidBody>
  );
}

for (const hero of Object.values(HEROES)) {
  if (hero.model) useGLTF.preload(hero.model);
}
