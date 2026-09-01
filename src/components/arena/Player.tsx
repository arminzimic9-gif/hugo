"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { CapsuleCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import ARENA_CONFIG from "@/data/arena-config.json";
import ARENA_ABILITIES from "@/data/arena-abilities.json";
import type { ArenaOperatorDefinition } from "@/data/arenaOperators";
import type { ArenaPilotAnimationSet } from "@/data/arenaPilots";
import { arenaAudio } from "@/lib/arenaAudio";
import { useGameStore } from "@/store/gameStore";
import { isArenaGameplayActive, useArenaSession, type ArenaRelicClass } from "@/store/arenaSession";
import { nearestEnemy, useArenaWorld, type ArenaControlMode } from "./world";

const PLAYER = ARENA_CONFIG.player;
const WEAPON = ARENA_CONFIG.weapon;
const CAMERA = ARENA_CONFIG.camera;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const RELIC_WEAPON_MODELS = {
  warrior: "/models/weapons/relic-warrior-greatsword-web.glb",
  rogue: "/models/weapons/relic-rogue-monoblade-web.glb",
  warlock: "/models/weapons/relic-warlock-glaive-web.glb",
} as const;

const RELIC_ATTACKS: Record<
  ArenaRelicClass,
  { damage: number; range: number; halfAngle: number; cooldownMs: number; color: string; scale: number }
> = {
  warrior: {
    damage: 7.5,
    range: 5.2,
    halfAngle: 1.02,
    cooldownMs: 720,
    color: "#37f6ff",
    scale: 1.2,
  },
  rogue: {
    damage: 4.2,
    range: 4.35,
    halfAngle: 0.82,
    cooldownMs: 310,
    color: "#ff5ad9",
    scale: 0.78,
  },
  warlock: {
    damage: 5.6,
    range: 7.1,
    halfAngle: 1.18,
    cooldownMs: 570,
    color: "#76ff55",
    scale: 1.05,
  },
};

const ATTACK_ANIMATION_BY_RELIC: Record<ArenaRelicClass, string> = {
  warrior: "WarriorAttack",
  rogue: "RogueAttack",
  warlock: "WarlockAttack",
};

/**
 * Meshy action-library clips are authored on a travelling rig. Arena movement
 * belongs to Rapier, so horizontal Hips translation must never displace the
 * rendered skin away from the player body. Preserve vertical footwork/bob.
 */
function lockClipToPlayer(
  clip: THREE.AnimationClip,
  hipsRestPosition: THREE.Vector3
): THREE.AnimationClip {
  const locked = clip.clone();
  locked.tracks = locked.tracks.map((track) => {
    const path = track.name.toLowerCase();
    if (!(track instanceof THREE.VectorKeyframeTrack) || !path.endsWith("hips.position")) {
      return track;
    }
    const anchored = track.clone();
    const values = anchored.values;
    for (let index = 0; index < values.length; index += 3) {
      values[index] = hipsRestPosition.x;
      values[index + 1] = hipsRestPosition.y;
      values[index + 2] = hipsRestPosition.z;
    }
    return anchored;
  });
  return locked;
}

function socketWeapon(
  scene: THREE.Object3D,
  targetLength: number,
  relicClass: ArenaRelicClass
): THREE.Group {
  const clone = scene.clone(true);
  clone.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.frustumCulled = false;
    }
  });
  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetLength / longest;
  clone.scale.setScalar(scale);
  clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

  // All runtime weapons leave the palm along local +Y. The grip, rather than
  // the visual center, is placed at the hand socket so long weapons never float.
  const aligned = new THREE.Group();
  aligned.add(clone);
  aligned.rotation.z = relicClass === "rogue" ? Math.PI : -Math.PI / 2;
  aligned.updateMatrixWorld(true);
  const alignedBox = new THREE.Box3().setFromObject(aligned);
  const alignedSize = alignedBox.getSize(new THREE.Vector3());
  const alignedCenter = alignedBox.getCenter(new THREE.Vector3());
  const gripY = alignedBox.min.y + alignedSize.y * (relicClass === "warlock" ? 0.28 : 0.17);
  aligned.position.set(-alignedCenter.x, -gripY, -alignedCenter.z);

  const pivot = new THREE.Group();
  pivot.add(aligned);
  return pivot;
}

function RelicWeaponDisplay({
  relicClass,
  rightWeaponRef,
  leftWeaponRef,
}: {
  relicClass: ArenaRelicClass | null;
  rightWeaponRef: RefObject<THREE.Group | null>;
  leftWeaponRef: RefObject<THREE.Group | null>;
}) {
  const warrior = useGLTF(RELIC_WEAPON_MODELS.warrior).scene;
  const rogue = useGLTF(RELIC_WEAPON_MODELS.rogue).scene;
  const warlock = useGLTF(RELIC_WEAPON_MODELS.warlock).scene;
  const models = useMemo(() => {
    if (relicClass === "warrior") return [socketWeapon(warrior, 1.85, relicClass)];
    if (relicClass === "rogue") {
      return [socketWeapon(rogue, 1.08, relicClass), socketWeapon(rogue, 1.08, relicClass)];
    }
    if (relicClass === "warlock") return [socketWeapon(warlock, 2.05, relicClass)];
    return [];
  }, [relicClass, rogue, warlock, warrior]);

  return (
    <>
      <group ref={rightWeaponRef} visible={relicClass !== null}>
        {models[0] ? <primitive key={`${relicClass}-right`} object={models[0]} /> : null}
      </group>
      <group ref={leftWeaponRef} visible={relicClass === "rogue"}>
        {relicClass === "rogue" && models[1] ? (
          <primitive key={`${relicClass}-left`} object={models[1]} rotation={[0, Math.PI, 0]} />
        ) : null}
      </group>
    </>
  );
}

function usePlayerModel(url: string, animationSet: ArenaPilotAnimationSet | null) {
  const base = useGLTF(url);
  const walk = useGLTF(animationSet?.walk ?? url);
  const run = useGLTF(animationSet?.run ?? url);
  const combatStance = useGLTF(animationSet?.combatStance ?? url);
  const combatWalk = useGLTF(animationSet?.combatWalk ?? url);
  const meleeAttack = useGLTF(animationSet?.meleeAttack ?? url);
  const warriorAttack = useGLTF(animationSet?.warriorAttack ?? url);
  const rogueAttack = useGLTF(animationSet?.rogueAttack ?? url);
  const warlockAttack = useGLTF(animationSet?.warlockAttack ?? url);
  const hipsRestPosition = useMemo(
    () => base.scene.getObjectByName("Hips")?.position.clone() ?? new THREE.Vector3(),
    [base.scene]
  );
  const animations = useMemo(
    () =>
      (animationSet
        ? [
            ...base.animations,
            ...walk.animations,
            ...run.animations,
            ...combatStance.animations,
            ...combatWalk.animations,
            ...meleeAttack.animations,
            ...warriorAttack.animations,
            ...rogueAttack.animations,
            ...warlockAttack.animations,
          ]
        : base.animations
      ).map((clip) => lockClipToPlayer(clip, hipsRestPosition)),
    [
      animationSet,
      base.animations,
      combatStance.animations,
      combatWalk.animations,
      meleeAttack.animations,
      rogueAttack.animations,
      run.animations,
      walk.animations,
      warlockAttack.animations,
      warriorAttack.animations,
      hipsRestPosition,
    ]
  );
  const scene = base.scene;
  const model = useMemo(() => {
    const clone = cloneSkeleton(scene);
    clone.updateMatrixWorld(true);
    clone.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        // glTF's cached geometry box describes the undeformed centimeter mesh.
        // Recompute it through the bound skeleton before normalizing the pilot.
        child.computeBoundingBox();
      }
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    // The unarmoured pilot must remain readable under the high top-down camera.
    const targetHeight = animationSet ? PLAYER.modelHeight * 1.24 : PLAYER.modelHeight;
    const scale = targetHeight / Math.max(0.001, size.y);
    clone.scale.setScalar(scale);
    const scaledBox = new THREE.Box3().setFromObject(clone);
    clone.position.y -= scaledBox.min.y;
    clone.position.x -= (scaledBox.min.x + scaledBox.max.x) / 2;
    clone.position.z -= (scaledBox.min.z + scaledBox.max.z) / 2;
    clone.userData.playerModelDebug = {
      sourceSize: size.toArray(),
      normalizedScale: scale,
      normalizedPosition: clone.position.toArray(),
      scaledBounds: {
        min: scaledBox.min.toArray(),
        max: scaledBox.max.toArray(),
      },
    };
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        // Retargeted skeletal clips move the Meshy bounds between poses; stale
        // bind-pose bounds would otherwise cull the pilot while still on screen.
        child.frustumCulled = false;
      }
    });
    return clone;
  }, [animationSet, scene]);
  return { animations, model };
}

export default function Player({
  heroModel,
  heroAnimations,
  heroAccent,
  operator,
  controlMode,
}: {
  heroModel: string;
  heroAnimations: ArenaPilotAnimationSet | null;
  heroAccent: string;
  operator: ArenaOperatorDefinition;
  controlMode: ArenaControlMode;
}) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const modelGroupRef = useRef<THREE.Group>(null);
  const aimGroupRef = useRef<THREE.Group>(null);
  const rightWeaponRef = useRef<THREE.Group>(null);
  const leftWeaponRef = useRef<THREE.Group>(null);
  const world = useArenaWorld();
  const { animations, model } = usePlayerModel(heroModel, heroAnimations);
  const { actions } = useAnimations(animations, modelGroupRef);
  const rightHand = useMemo(
    () => model.getObjectByName("RightHand") ?? model.getObjectByName("hand.R"),
    [model]
  );
  const leftHand = useMemo(
    () => model.getObjectByName("LeftHand") ?? model.getObjectByName("hand.L"),
    [model]
  );
  const camera = useThree((state) => state.camera);
  const pointer = useThree((state) => state.pointer);
  const raycaster = useThree((state) => state.raycaster);
  const relicClass = useArenaSession((state) => state.relicClass);

  const input = useRef({ up: false, down: false, left: false, right: false, sprint: false });
  const shieldRef = useRef<THREE.Mesh>(null);
  const fireTimer = useRef(0);
  const headingAngle = useRef(0);
  const desiredHeadingAngle = useRef(0);
  const cursorWorld = useRef(new THREE.Vector3());
  const mouseHeld = useRef(false);
  const pointerAimActive = useRef(false);
  const activeAnimation = useRef<string | null>(null);
  const sprintActive = useRef(false);
  const meleeQueued = useRef(false);
  const meleeReadyAt = useRef(0);
  const meleeAnimationUntil = useRef(0);
  const cameraTarget = useRef(new THREE.Vector3());
  const socketWorldPosition = useRef(new THREE.Vector3());
  const socketWorldQuaternion = useRef(new THREE.Quaternion());
  const modelWorldQuaternion = useRef(new THREE.Quaternion());
  const socketOffset = useRef(new THREE.Vector3());

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      (window as unknown as Record<string, unknown>).__arenaPilotDebug = {
        ...model.userData.playerModelDebug,
        clips: animations.map((clip) => ({ name: clip.name, duration: clip.duration })),
        rightHand: rightHand?.name ?? null,
        leftHand: leftHand?.name ?? null,
      };
    }
  }, [animations, leftHand, model, rightHand]);

  useEffect(() => {
    const idle = actions.Idle;
    if (!idle) return;
    idle.reset().fadeIn(0.18).play();
    activeAnimation.current = "Idle";
    return () => {
      Object.values(actions).forEach((action) => action?.stop());
      activeAnimation.current = null;
    };
  }, [actions]);

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
      Space: "sprint",
    };
    const abilityByCode: Record<string, string> = { KeyQ: "nova", KeyE: "timewarp", KeyR: "overdrive" };

    // WoW/PoE stil: svaka moc ima svoj efekat kad se aktivira
    const triggerAbility = (abilityId: string) => {
      const ability = ARENA_ABILITIES.find((a) => a.id === abilityId);
      if (!ability) return;
      if (!useGameStore.getState().stats.skills.includes(ability.skillId)) return;
      const session = useArenaSession.getState();
      if (!session.activateAbility(ability.id)) return;
      arenaAudio.sfx("ability");
      const origin = world.playerPosition.clone().setY(1);
      const params = ability.params as Partial<Record<string, number>>;
      if (ability.kind === "nova") {
        const radius = params.radius ?? 8;
        const damage = (params.damage ?? 3) * session.mods.damageMult;
        for (const enemy of world.enemies.values()) {
          const dx = enemy.position.x - origin.x;
          const dz = enemy.position.z - origin.z;
          if (dx * dx + dz * dz <= radius * radius) {
            enemy.hit(damage);
            session.recordDamageDealt(damage);
            world.spawnDamageNumber(enemy.position.clone().setY(2), damage, ability.color);
          }
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
    const onPointerMove = (event: PointerEvent) => {
      if (event.target instanceof HTMLCanvasElement) pointerAimActive.current = true;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof HTMLCanvasElement)) return;
      pointerAimActive.current = true;
      if (event.button === 0 && relicClass) meleeQueued.current = true;
      if (event.button === 2) mouseHeld.current = true;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.button === 2) mouseHeld.current = false;
    };
    const onContextMenu = (event: MouseEvent) => {
      if (event.target instanceof HTMLCanvasElement) event.preventDefault();
    };
    const onBlur = () => {
      mouseHeld.current = false;
      input.current.sprint = false;
      useArenaSession.getState().setSprintRequested(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("blur", onBlur);
      useArenaSession.getState().setSprintRequested(false);
    };
  }, [relicClass, world]);

  useEffect(() => {
    world.playerBody = bodyRef.current;
    return () => {
      world.playerBody = null;
    };
  }, [world]);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body) return;
    if (performance.now() < world.hitStopUntil) {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }
    const session = useArenaSession.getState();
    const running = isArenaGameplayActive(session);

    const translation = body.translation();
    world.playerPosition.set(translation.x, translation.y, translation.z);

    // Movement
    const keys = input.current;
    raycaster.setFromCamera(pointer, camera);
    const cursorHit = raycaster.ray.intersectPlane(GROUND_PLANE, cursorWorld.current);
    const cursorDx = cursorHit ? cursorWorld.current.x - translation.x : 0;
    const cursorDz = cursorHit ? cursorWorld.current.z - translation.z : 0;
    const cursorDistance = Math.hypot(cursorDx, cursorDz);

    let moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let moveZ = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (controlMode === "mouse") {
      moveX = 0;
      moveZ = 0;
      if (mouseHeld.current && pointerAimActive.current && cursorDistance > 0.85) {
        moveX = cursorDx / cursorDistance;
        moveZ = cursorDz / cursorDistance;
      }
    }
    const length = Math.hypot(moveX, moveZ);
    const wantsSprint =
      running && length > 0 && keys.sprint && session.sprintEnergy > 0.01;
    if (sprintActive.current !== wantsSprint) {
      sprintActive.current = wantsSprint;
      session.setSprintRequested(wantsSprint);
    }
    const nextAnimation =
      running && length > 0
        ? wantsSprint && actions.Run
          ? "Run"
          : relicClass && actions.CombatWalk
            ? "CombatWalk"
          : actions.Walk
            ? "Walk"
            : "Idle"
        : relicClass && actions.CombatStance
          ? "CombatStance"
          : "Idle";
    const meleeAnimationActive = performance.now() < meleeAnimationUntil.current;
    if (
      !meleeAnimationActive &&
      activeAnimation.current !== nextAnimation &&
      actions[nextAnimation]
    ) {
      const previous = activeAnimation.current;
      if (previous) actions[previous]?.fadeOut(0.12);
      actions[nextAnimation]?.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.12).play();
      activeAnimation.current = nextAnimation;
    }
    const sprintMultiplier = wantsSprint ? PLAYER.sprint.speedMultiplier : 1;
    if (actions.Walk) {
      actions.Walk.setEffectiveTimeScale(
        Math.max(0.75, session.mods.speedMult)
      );
    }
    if (actions.Run) actions.Run.setEffectiveTimeScale(Math.max(0.82, session.mods.speedMult));
    if (actions.CombatWalk) {
      actions.CombatWalk.setEffectiveTimeScale(Math.max(0.78, session.mods.speedMult));
    }
    const speed = PLAYER.speed * session.mods.speedMult * sprintMultiplier;
    if (running && length > 0) {
      body.setLinvel({ x: (moveX / length) * speed, y: 0, z: (moveZ / length) * speed }, true);
    } else {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    if (pointerAimActive.current && cursorDistance > 0.35) {
      desiredHeadingAngle.current = Math.atan2(cursorDx, cursorDz);
    } else if (length > 0) {
      desiredHeadingAngle.current = Math.atan2(moveX, moveZ);
    }
    let aimDelta = desiredHeadingAngle.current - headingAngle.current;
    aimDelta = Math.atan2(Math.sin(aimDelta), Math.cos(aimDelta));
    headingAngle.current += aimDelta * Math.min(1, dt * 15);

    const modelGroup = modelGroupRef.current;
    if (modelGroup) {
      let delta = headingAngle.current - modelGroup.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      modelGroup.rotation.y += delta * Math.min(1, dt * 12);
    }
    world.playerAimDirection.set(
      Math.sin(headingAngle.current),
      0,
      Math.cos(headingAngle.current)
    );
    if (aimGroupRef.current) {
      aimGroupRef.current.rotation.y = headingAngle.current;
      aimGroupRef.current.visible = running;
    }

    if (modelGroup) {
      const syncWeaponToHand = (
        weapon: THREE.Group | null,
        hand: THREE.Object3D | undefined
      ) => {
        if (!weapon || !hand) return;
        modelGroup.updateWorldMatrix(true, false);
        hand.updateWorldMatrix(true, false);
        hand.getWorldPosition(socketWorldPosition.current);
        hand.getWorldQuaternion(socketWorldQuaternion.current);
        modelGroup.getWorldQuaternion(modelWorldQuaternion.current);
        weapon.position.copy(modelGroup.worldToLocal(socketWorldPosition.current));
        weapon.quaternion
          .copy(modelWorldQuaternion.current.invert())
          .multiply(socketWorldQuaternion.current);
        socketOffset.current.set(0, 0.075, 0).applyQuaternion(weapon.quaternion);
        weapon.position.add(socketOffset.current);
      };
      syncWeaponToHand(rightWeaponRef.current, rightHand);
      syncWeaponToHand(leftWeaponRef.current, leftHand);
    }

    if (meleeQueued.current) {
      meleeQueued.current = false;
      if (running && relicClass && performance.now() >= meleeReadyAt.current) {
        const attack = RELIC_ATTACKS[relicClass];
        const origin = world.playerPosition.clone().setY(1);
        const direction = world.playerAimDirection;
        const minDot = Math.cos(attack.halfAngle);
        let hits = 0;
        for (const enemy of world.enemies.values()) {
          if (enemy.health <= 0) continue;
          const dx = enemy.position.x - origin.x;
          const dz = enemy.position.z - origin.z;
          const distance = Math.hypot(dx, dz);
          if (distance > attack.range || distance < 0.001) continue;
          const dot = (dx * direction.x + dz * direction.z) / distance;
          if (dot < minDot) continue;
          const damage =
            attack.damage *
            session.mods.damageMult *
            (1 + session.relicAugmentLevel * 0.35);
          enemy.hit(damage);
          session.recordDamageDealt(damage);
          world.spawnDamageNumber(enemy.position.clone().setY(2), damage, attack.color);
          hits += 1;
        }
        meleeReadyAt.current = performance.now() + attack.cooldownMs;
        const attackDuration =
          relicClass === "rogue" ? 0.3 : relicClass === "warrior" ? 0.58 : 0.46;
        const attackAnimation = ATTACK_ANIMATION_BY_RELIC[relicClass];
        const meleeAction = actions[attackAnimation] ?? actions.MeleeAttack;
        if (meleeAction) {
          const previous = activeAnimation.current;
          if (previous) actions[previous]?.fadeOut(0.06);
          meleeAction
            .reset()
            .setLoop(THREE.LoopOnce, 1)
            .setEffectiveTimeScale(meleeAction.getClip().duration / attackDuration)
            .fadeIn(0.045)
            .play();
          meleeAction.clampWhenFinished = true;
          activeAnimation.current = actions[attackAnimation] ? attackAnimation : "MeleeAttack";
          meleeAnimationUntil.current = performance.now() + attackDuration * 1000;
        }
        const impact = origin
          .clone()
          .addScaledVector(direction, Math.min(attack.range * 0.62, 3.8));
        world.spawnEffect(
          relicClass === "warlock" ? "nova" : "ring",
          impact,
          attack.color,
          attack.scale
        );
        world.spawnEffect("burst", impact, attack.color, attack.scale * 0.72);
        world.triggerScreenShake(relicClass === "warrior" ? 0.55 : 0.3, 120);
        if (hits > 0) world.triggerHitStop(relicClass === "warrior" ? 58 : 34);
        arenaAudio.sfx("ability");
      }
    }

    // Oruzje puca u smjeru u kojem je lik okrenut. Najblizi neprijatelj samo
    // aktivira vatru; vise ne preuzima kontrolu nad pravcem projektila.
    if (running) {
      fireTimer.current -= dt * 1000;
      if (fireTimer.current <= 0) {
        const hostileInRange = nearestEnemy(world, world.playerPosition, WEAPON.targetRange);
        if (hostileInRange) {
          const direction = world.playerAimDirection.clone();
          const origin = world.playerPosition.clone().setY(1);
          const shotCount = 1 + session.mods.multishot;
          for (let index = 0; index < shotCount; index++) {
            const offset =
              shotCount === 1
                ? 0
                : (index - (shotCount - 1) / 2) * session.mods.spreadRadians;
            world.firePlayerProjectile(origin, direction.clone().applyAxisAngle(Y_AXIS, offset), {
              damage: WEAPON.damage * session.mods.damageMult,
              bounces: session.mods.bounces,
              bounceRange: session.mods.bounceRange,
              pierces: session.mods.pierces,
              projectileScale: operator.weapon.projectileScale,
              projectileSpeedMult: operator.weapon.projectileSpeedMult,
            });
          }
          arenaAudio.sfx("playerShot");
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
    if (performance.now() < world.shakeUntil) {
      const shake = world.shakeIntensity;
      cameraTarget.current.x += (Math.random() - 0.5) * shake;
      cameraTarget.current.y += (Math.random() - 0.5) * shake * 0.35;
      cameraTarget.current.z += (Math.random() - 0.5) * shake;
    } else {
      world.shakeIntensity = 0;
    }
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
        <RelicWeaponDisplay
          relicClass={relicClass}
          rightWeaponRef={rightWeaponRef}
          leftWeaponRef={leftWeaponRef}
        />
      </group>
      <group ref={aimGroupRef} position={[0, 0.055, 0]} visible={false}>
        <mesh position={[0, 0, 2.35]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={12}>
          <planeGeometry args={[0.085, 3.25]} />
          <meshBasicMaterial
            color={heroAccent}
            transparent
            opacity={0.52}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh position={[0, 0.004, 4.05]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={13}>
          <ringGeometry args={[0.22, 0.34, 20]} />
          <meshBasicMaterial
            color={heroAccent}
            transparent
            opacity={0.82}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, 0.006, 4.05]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} renderOrder={13}>
          <circleGeometry args={[0.17, 3]} />
          <meshBasicMaterial
            color="#eaffff"
            transparent
            opacity={0.9}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.75, 0.92, 48]} />
        <meshBasicMaterial color={heroAccent} transparent opacity={0.65} toneMapped={false} />
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
      <pointLight color={heroAccent} intensity={8} distance={9} position={[0, 2.4, 0]} />
    </RigidBody>
  );
}

for (const model of Object.values(RELIC_WEAPON_MODELS)) useGLTF.preload(model);
