"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Sparkles, useTexture } from "@react-three/drei";
import { useArenaSession, type CataclysmZone } from "@/store/arenaSession";
import { useArenaWorld, type EffectKind } from "./world";

const RING_POOL = 16;
const PARTICLE_POOL = 320;
const PARTICLES_PER_BURST = 18;
const COMBO_SURGE_POOL = 8;

type Ring = {
  active: boolean;
  position: THREE.Vector3;
  color: THREE.Color;
  age: number;
  lifetime: number;
  maxScale: number;
};

type Particle = {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  age: number;
  lifetime: number;
  size: number;
};

type ComboSurge = {
  active: boolean;
  age: number;
  color: THREE.Color;
  onDetonate: (() => void) | null;
  position: THREE.Vector3;
  power: number;
};

const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const tempMatrix = new THREE.Matrix4();
const tempQuat = new THREE.Quaternion();
const flatQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const tempScale = new THREE.Vector3();
const fireMatrix = new THREE.Matrix4();
const firePosition = new THREE.Vector3();
const fireQuaternion = new THREE.Quaternion();
const fireRollQuaternion = new THREE.Quaternion();
const fireScale = new THREE.Vector3();
const Z_AXIS = new THREE.Vector3(0, 0, 1);

type FirePoint = { x: number; z: number; phase: number; size: number };

function CataclysmZoneVisual({ zone }: { zone: CataclysmZone }) {
  const world = useArenaWorld();
  const fireTexture = useTexture("/images/effects/fire-plume.png");
  const outerFireRef = useRef<THREE.InstancedMesh>(null);
  const innerFireRef = useRef<THREE.InstancedMesh>(null);
  const elapsed = useRef(0);
  const arrivalPlayed = useRef(false);
  const firePoints = useMemo<FirePoint[]>(() => {
    const count = 12 + zone.tier * 5;
    return Array.from({ length: count }, (_, index) => {
      const angle = index * 2.399963 + zone.id * 0.71;
      const normalizedRadius = 0.22 + (((index * 47 + zone.id * 13) % 71) / 70) * 0.7;
      return {
        x: Math.cos(angle) * zone.radius * normalizedRadius,
        z: Math.sin(angle) * zone.radius * normalizedRadius,
        phase: angle * 1.7,
        size: 0.62 + ((index * 31) % 17) / 20 + zone.tier * 0.06,
      };
    });
  }, [zone.id, zone.radius, zone.tier]);

  useEffect(() => {
    fireTexture.colorSpace = THREE.SRGBColorSpace;
    fireTexture.wrapS = THREE.ClampToEdgeWrapping;
    fireTexture.wrapT = THREE.ClampToEdgeWrapping;
    fireTexture.needsUpdate = true;
  }, [fireTexture]);

  useEffect(() => {
    if (arrivalPlayed.current) return;
    arrivalPlayed.current = true;
    const origin = new THREE.Vector3(zone.x, 1, zone.z);
    world.spawnEffect("nova", origin, "#ff4a1f", 2.5 + zone.tier * 0.7);
    world.spawnEffect("ring", origin, "#ffcf40", 3.4 + zone.tier * 0.8);
    world.spawnCombatText(
      origin.clone().setY(4.2),
      zone.tier === 0
        ? "INCENDIARY IMPACT"
        : zone.tier > 1
          ? `BOSS IMPACT ×${zone.tier}`
          : "BOSS IMPACT",
      "#ff6a24",
      zone.tier === 0 ? 1.7 : 2.45
    );
    world.triggerHitStop(145);
    world.triggerScreenShake(1.9 + zone.tier * 0.28, 720);
  }, [world, zone]);

  useFrame(({ camera }, dt) => {
    elapsed.current += dt;
    const outer = outerFireRef.current;
    const inner = innerFireRef.current;
    if (!outer || !inner) return;
    firePoints.forEach((point, index) => {
      const wave = 0.82 + Math.sin(elapsed.current * 6.5 + point.phase) * 0.2;
      const height = point.size * wave;
      firePosition.set(point.x, 0.48 + height * 0.82, point.z);
      fireQuaternion.copy(camera.quaternion);
      fireRollQuaternion.setFromAxisAngle(Z_AXIS, Math.sin(elapsed.current * 2.1 + point.phase) * 0.07);
      fireQuaternion.multiply(fireRollQuaternion);
      fireScale.set(point.size * (0.92 + wave * 0.12), height * 2.2, 1);
      fireMatrix.compose(firePosition, fireQuaternion, fireScale);
      outer.setMatrixAt(index, fireMatrix);
      fireScale.set(point.size * 0.48, height * 1.42, 1);
      firePosition.y += height * 0.08;
      fireMatrix.compose(firePosition, fireQuaternion, fireScale);
      inner.setMatrixAt(index, fireMatrix);
    });
    outer.instanceMatrix.needsUpdate = true;
    inner.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={[zone.x, 0, zone.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]}>
        <circleGeometry args={[zone.radius, 64]} />
        <meshBasicMaterial color="#110403" transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.031, 0]}>
        <ringGeometry args={[zone.radius * 0.82, zone.radius, 64]} />
        <meshBasicMaterial
          color="#ff3c12"
          transparent
          opacity={0.34}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <instancedMesh ref={outerFireRef} args={[undefined, undefined, firePoints.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={fireTexture}
          color="#ff7a22"
          transparent
          opacity={0.82}
          alphaTest={0.025}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      <instancedMesh ref={innerFireRef} args={[undefined, undefined, firePoints.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={fireTexture}
          color="#fff0a3"
          transparent
          opacity={0.62}
          alphaTest={0.025}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      <Sparkles
        count={zone.tier === 0 ? 18 : 55 + zone.tier * 25}
        scale={[zone.radius * 1.8, 5 + zone.tier, zone.radius * 1.8]}
        size={3.2 + zone.tier * 0.6}
        speed={1.45 + zone.tier * 0.18}
        color="#ff6a24"
        opacity={0.78}
      />
      {zone.tier > 0 ? (
        <pointLight
          color="#ff4d16"
          intensity={18 + zone.tier * 7}
          distance={zone.radius * 2.4}
          position={[0, 3.2, 0]}
        />
      ) : null}
    </group>
  );
}

function CataclysmVisuals() {
  const zones = useArenaSession((state) => state.cataclysmZones);
  return (
    <group>
      {zones.map((zone) => (
        <CataclysmZoneVisual key={zone.id} zone={zone} />
      ))}
    </group>
  );
}

export default function Effects() {
  const world = useArenaWorld();
  const ringMeshRef = useRef<THREE.InstancedMesh>(null);
  const particleMeshRef = useRef<THREE.InstancedMesh>(null);
  const comboSurgeMeshRef = useRef<THREE.InstancedMesh>(null);

  const rings = useMemo<Ring[]>(
    () =>
      Array.from({ length: RING_POOL }, () => ({
        active: false,
        position: new THREE.Vector3(),
        color: new THREE.Color(),
        age: 0,
        lifetime: 0.6,
        maxScale: 6,
      })),
    []
  );

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: PARTICLE_POOL }, () => ({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(),
        age: 0,
        lifetime: 0.5,
        size: 1,
      })),
    []
  );
  const comboSurges = useMemo<ComboSurge[]>(
    () =>
      Array.from({ length: COMBO_SURGE_POOL }, () => ({
        active: false,
        age: 0,
        color: new THREE.Color(),
        onDetonate: null,
        position: new THREE.Vector3(),
        power: 1,
      })),
    []
  );

  useEffect(() => {
    world.spawnEffect = (kind: EffectKind, position: THREE.Vector3, color: string, scale = 1) => {
      if (kind === "ring" || kind === "nova") {
        const ring = rings.find((r) => !r.active);
        if (ring) {
          ring.active = true;
          ring.position.set(position.x, 0.15, position.z);
          ring.color.set(color);
          ring.age = 0;
          ring.lifetime = kind === "nova" ? 0.5 : 0.7;
          ring.maxScale = (kind === "nova" ? 9 : 4.5) * scale;
        }
      }
      if (kind === "burst" || kind === "nova") {
        let spawned = 0;
        for (const particle of particles) {
          if (particle.active) continue;
          particle.active = true;
          particle.position.set(position.x, Math.max(0.5, position.y), position.z);
          const angle = Math.random() * Math.PI * 2;
          const up = 1.5 + Math.random() * 3;
          const out = (2.5 + Math.random() * 4) * scale;
          particle.velocity.set(Math.cos(angle) * out, up, Math.sin(angle) * out);
          particle.color.set(color);
          particle.age = 0;
          particle.lifetime = 0.35 + Math.random() * 0.35;
          particle.size = (0.1 + Math.random() * 0.14) * scale;
          if (++spawned >= PARTICLES_PER_BURST * scale) break;
        }
      }
    };
    world.spawnComboSurge = (position, color, power, onDetonate) => {
      const surge = comboSurges.find((candidate) => !candidate.active) ?? comboSurges[0];
      surge.active = true;
      surge.age = 0;
      surge.color.set(color);
      surge.onDetonate = onDetonate;
      surge.position.copy(position);
      surge.power = power;
    };
    return () => {
      world.spawnEffect = () => {};
      world.spawnComboSurge = () => {};
    };
  }, [world, rings, particles, comboSurges]);

  useFrame((_, dt) => {
    if (performance.now() < world.hitStopUntil) return;
    const ringMesh = ringMeshRef.current;
    if (ringMesh) {
      rings.forEach((ring, index) => {
        if (ring.active) {
          ring.age += dt;
          if (ring.age >= ring.lifetime) ring.active = false;
        }
        if (ring.active) {
          const t = ring.age / ring.lifetime;
          const s = 0.5 + t * ring.maxScale;
          tempScale.set(s, s, s);
          tempMatrix.compose(ring.position, flatQuat, tempScale);
          ringMesh.setMatrixAt(index, tempMatrix);
          ringMesh.setColorAt(index, ring.color.clone().multiplyScalar(1.6 * (1 - t)));
        } else {
          ringMesh.setMatrixAt(index, hiddenMatrix);
        }
      });
      ringMesh.instanceMatrix.needsUpdate = true;
      if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
    }

    const particleMesh = particleMeshRef.current;
    if (particleMesh) {
      particles.forEach((particle, index) => {
        if (particle.active) {
          particle.age += dt;
          if (particle.age >= particle.lifetime) particle.active = false;
        }
        if (particle.active) {
          particle.velocity.y -= 9 * dt;
          particle.position.addScaledVector(particle.velocity, dt);
          const t = particle.age / particle.lifetime;
          const s = particle.size * (1 - t * 0.7);
          tempScale.set(s, s, s);
          tempQuat.identity();
          tempMatrix.compose(particle.position, tempQuat, tempScale);
          particleMesh.setMatrixAt(index, tempMatrix);
          particleMesh.setColorAt(index, particle.color.clone().multiplyScalar(2.2 * (1 - t)));
        } else {
          particleMesh.setMatrixAt(index, hiddenMatrix);
        }
      });
      particleMesh.instanceMatrix.needsUpdate = true;
      if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
    }

    const comboSurgeMesh = comboSurgeMeshRef.current;
    if (comboSurgeMesh) {
      comboSurges.forEach((surge, index) => {
        if (surge.active) surge.age += dt;
        if (surge.active && surge.age >= 0.42) {
          surge.active = false;
          const detonate = surge.onDetonate;
          surge.onDetonate = null;
          world.spawnEffect("nova", surge.position, surge.color.getStyle(), 0.8 + surge.power * 0.16);
          detonate?.();
        }
        if (surge.active) {
          const progress = surge.age / 0.42;
          const rise = Math.sin(progress * Math.PI * 0.62) * (2.8 + surge.power * 0.18);
          const pulse = 0.42 + progress * 0.36 + Math.sin(progress * Math.PI * 5) * 0.08;
          tempScale.setScalar(pulse * (1 + surge.power * 0.045));
          tempQuat.setFromEuler(new THREE.Euler(progress * 5, progress * 8, progress * 3));
          tempMatrix.compose(
            new THREE.Vector3(surge.position.x, surge.position.y + rise, surge.position.z),
            tempQuat,
            tempScale
          );
          comboSurgeMesh.setMatrixAt(index, tempMatrix);
          comboSurgeMesh.setColorAt(index, surge.color.clone().multiplyScalar(2.4));
        } else {
          comboSurgeMesh.setMatrixAt(index, hiddenMatrix);
        }
      });
      comboSurgeMesh.instanceMatrix.needsUpdate = true;
      if (comboSurgeMesh.instanceColor) comboSurgeMesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <CataclysmVisuals />
      <instancedMesh ref={ringMeshRef} args={[undefined, undefined, RING_POOL]} frustumCulled={false}>
        <ringGeometry args={[0.82, 1, 48]} />
        <meshBasicMaterial transparent opacity={0.9} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={particleMeshRef} args={[undefined, undefined, PARTICLE_POOL]} frustumCulled={false}>
        <octahedronGeometry args={[1]} />
        <meshBasicMaterial transparent opacity={0.95} toneMapped={false} depthWrite={false} />
      </instancedMesh>
      <instancedMesh
        ref={comboSurgeMeshRef}
        args={[undefined, undefined, COMBO_SURGE_POOL]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial
          transparent
          opacity={0.92}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
}
