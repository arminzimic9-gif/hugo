"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useGameStore } from "@/store/gameStore";
import { useArenaSession } from "@/store/arenaSession";
import { useArenaWorld } from "./world";

const PORTAL_POSITION = new THREE.Vector3(0, 0, -10.5);
const PORTAL_ENTER_RADIUS = 2.05;
const PORTAL_NEAR_RADIUS = 5.25;
const PORTAL_CHARGE_SECONDS = 1.35;

function PortalMaterial({ color, opacity }: { color: string; opacity: number }) {
  return (
    <meshBasicMaterial
      color={color}
      transparent
      opacity={opacity}
      depthWrite={false}
      toneMapped={false}
      blending={THREE.AdditiveBlending}
      side={THREE.DoubleSide}
    />
  );
}

export default function ArenaPortal() {
  const world = useArenaWorld();
  const endgameUnlocked = useGameStore((state) => state.stats.endgameUnlocked);
  const chassisCoreActive = useArenaSession((state) => state.chassisCoreActive);
  const operativeCycles = useGameStore((state) => state.stats.operativeCycles);
  const portalActive = endgameUnlocked || chassisCoreActive;
  const outerRef = useRef<THREE.Mesh>(null);
  const middleRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const membraneRef = useRef<THREE.Mesh>(null);
  const glyphRef = useRef<THREE.Group>(null);
  const chargeRef = useRef(0);
  const lastNearRef = useRef(false);
  const lastChargeRef = useRef(-1);
  const transitionedRef = useRef(false);

  useEffect(
    () => () => {
      const session = useArenaSession.getState();
      if (session.environment === "surface") session.setPortalContact(false, 0);
    },
    []
  );

  useFrame((state, dt) => {
    const elapsed = state.clock.elapsedTime;
    if (outerRef.current) outerRef.current.rotation.z = elapsed * 0.28;
    if (middleRef.current) middleRef.current.rotation.z = -elapsed * 0.47;
    if (innerRef.current) innerRef.current.rotation.z = elapsed * 0.72;
    if (glyphRef.current) glyphRef.current.rotation.y = -elapsed * 0.34;
    if (membraneRef.current) {
      const pulse = 1 + Math.sin(elapsed * 3.4) * (portalActive ? 0.035 : 0.012);
      membraneRef.current.scale.setScalar(pulse);
    }

    const session = useArenaSession.getState();
    if (session.environment !== "surface" || session.phase !== "running") return;
    const dx = world.playerPosition.x - PORTAL_POSITION.x;
    const dz = world.playerPosition.z - PORTAL_POSITION.z;
    const distance = Math.hypot(dx, dz);
    const near = distance <= PORTAL_NEAR_RADIUS;
    if (portalActive && distance <= PORTAL_ENTER_RADIUS) {
      chargeRef.current = Math.min(1, chargeRef.current + dt / PORTAL_CHARGE_SECONDS);
    } else {
      chargeRef.current = Math.max(0, chargeRef.current - dt * 1.8);
    }
    const reportedCharge = Math.round(chargeRef.current * 20) / 20;
    if (near !== lastNearRef.current || reportedCharge !== lastChargeRef.current) {
      lastNearRef.current = near;
      lastChargeRef.current = reportedCharge;
      session.setPortalContact(near, reportedCharge);
    }
    if (!portalActive || chargeRef.current < 1 || transitionedRef.current) return;

    transitionedRef.current = true;
    const impact = PORTAL_POSITION.clone().setY(1.3);
    world.spawnEffect("nova", impact, "#62ffd1", 2.8);
    world.spawnEffect("ring", impact, "#a66bff", 2.25);
    world.spawnCombatText(impact.clone().setY(3.8), "UNDERGROUND LINK ESTABLISHED", "#62ffd1", 2.1);
    world.triggerScreenShake(1.3, 520);
    for (const enemy of world.enemies.values()) enemy.hit(Number.MAX_SAFE_INTEGER);
    world.playerBody?.setTranslation({ x: 0, y: 0, z: 4 }, true);
    world.playerBody?.setLinvel({ x: 0, y: 0, z: 0 }, true);
    session.enterUnderground(operativeCycles + 1);
    session.queueStoryTransmission("endgame_loop");
  });

  const activeColor = portalActive ? "#62ffd1" : "#36536b";
  const secondaryColor = portalActive ? "#a66bff" : "#273343";
  return (
    <group position={PORTAL_POSITION}>
      <group position={[0, 2.45, 0]}>
        <mesh ref={outerRef} renderOrder={18}>
          <torusGeometry args={[2.48, 0.14, 12, 72]} />
          <PortalMaterial color={activeColor} opacity={portalActive ? 0.92 : 0.28} />
        </mesh>
        <mesh ref={middleRef} renderOrder={19}>
          <torusGeometry args={[2.12, 0.055, 10, 8]} />
          <PortalMaterial color={secondaryColor} opacity={portalActive ? 0.88 : 0.2} />
        </mesh>
        <mesh ref={innerRef} renderOrder={20}>
          <torusGeometry args={[1.78, 0.035, 8, 6]} />
          <PortalMaterial color="#e8ffff" opacity={portalActive ? 0.72 : 0.1} />
        </mesh>
        <mesh ref={membraneRef} position={[0, 0, -0.035]} renderOrder={17}>
          <circleGeometry args={[1.72, 64]} />
          <meshBasicMaterial
            color={portalActive ? "#152b43" : "#08101a"}
            transparent
            opacity={portalActive ? 0.66 : 0.28}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0, 0.015]} renderOrder={21}>
          <ringGeometry args={[0.18, 1.62, 6]} />
          <PortalMaterial color={secondaryColor} opacity={portalActive ? 0.22 : 0.06} />
        </mesh>
        {portalActive ? (
          <Sparkles count={48} scale={[3.2, 4.1, 1.2]} size={3.4} speed={0.65} color="#c8fff2" opacity={0.78} />
        ) : null}
        <pointLight color={activeColor} intensity={portalActive ? 34 : 4} distance={14} />
      </group>

      <group ref={glyphRef} position={[0, 0.045, 0]}>
        {[1.85, 2.45, 3.15].map((radius, index) => (
          <mesh key={radius} rotation={[-Math.PI / 2, 0, index * 0.38]} renderOrder={16}>
            <ringGeometry args={[radius - 0.035, radius + 0.035, index === 1 ? 8 : 48]} />
            <PortalMaterial
              color={index === 1 ? secondaryColor : activeColor}
              opacity={portalActive ? 0.58 - index * 0.1 : 0.12}
            />
          </mesh>
        ))}
      </group>

      {[-2.82, 2.82].map((x) => (
        <group key={x} position={[x, 1.25, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.48, 2.5, 0.72]} />
            <meshStandardMaterial
              color="#0b1320"
              emissive={activeColor}
              emissiveIntensity={portalActive ? 0.42 : 0.08}
              metalness={0.8}
              roughness={0.32}
            />
          </mesh>
          <mesh position={[0, 1.05, 0.38]}>
            <boxGeometry args={[0.2, 0.24, 0.04]} />
            <PortalMaterial color={activeColor} opacity={portalActive ? 0.95 : 0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
