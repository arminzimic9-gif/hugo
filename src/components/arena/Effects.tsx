"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useArenaWorld, type EffectKind } from "./world";

const RING_POOL = 16;
const PARTICLE_POOL = 320;
const PARTICLES_PER_BURST = 18;

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

const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const tempMatrix = new THREE.Matrix4();
const tempQuat = new THREE.Quaternion();
const flatQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const tempScale = new THREE.Vector3();

export default function Effects() {
  const world = useArenaWorld();
  const ringMeshRef = useRef<THREE.InstancedMesh>(null);
  const particleMeshRef = useRef<THREE.InstancedMesh>(null);

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
    return () => {
      world.spawnEffect = () => {};
    };
  }, [world, rings, particles]);

  useFrame((_, dt) => {
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
  });

  return (
    <group>
      <instancedMesh ref={ringMeshRef} args={[undefined, undefined, RING_POOL]} frustumCulled={false}>
        <ringGeometry args={[0.82, 1, 48]} />
        <meshBasicMaterial transparent opacity={0.9} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={particleMeshRef} args={[undefined, undefined, PARTICLE_POOL]} frustumCulled={false}>
        <octahedronGeometry args={[1]} />
        <meshBasicMaterial transparent opacity={0.95} toneMapped={false} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
