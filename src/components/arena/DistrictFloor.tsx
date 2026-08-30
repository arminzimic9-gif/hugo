"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import ARENA_CONFIG from "@/data/arena-config.json";
import { useArenaWorld } from "./world";

const { districtSize, chunkRadius, propColliderHeight, nodeChance, maxPropsPerChunk } =
  ARENA_CONFIG.world;
const DISTRICT_IMAGES = ARENA_CONFIG.districts.map((district) => district.image);
const PROP_KINDS = ARENA_CONFIG.propKinds;

const PROP_BY_KIND = Object.fromEntries(PROP_KINDS.map((kind) => [kind.kind, kind]));

// Deterministicki hash po chunk koordinatama — mapa je ista pri svakom povratku.
function hash2(cx: number, cz: number, salt: number): number {
  let h = Math.imul(cx, 374761393) ^ Math.imul(cz, 668265263) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type ChunkProp = { key: number; kind: string; radius: number; x: number; z: number };

function ChunkProps({ cx, cz }: { cx: number; cz: number }) {
  const props = useMemo<ChunkProp[]>(() => {
    // Pocetni chunk ostaje prazan da igrac ne krene zaglavljen u prop.
    if (cx === 0 && cz === 0) return [];
    if (hash2(cx, cz, 11) > nodeChance) return [];
    const count = 1 + Math.floor(hash2(cx, cz, 12) * maxPropsPerChunk) % maxPropsPerChunk;
    const list: ChunkProp[] = [];
    for (let i = 0; i < count; i++) {
      const kind = PROP_KINDS[Math.floor(hash2(cx, cz, 20 + i) * PROP_KINDS.length)];
      list.push({
        key: i,
        kind: kind.kind,
        radius: kind.radius,
        x: cx * districtSize + (hash2(cx, cz, 30 + i) - 0.5) * (districtSize - 12),
        z: cz * districtSize + (hash2(cx, cz, 40 + i) - 0.5) * (districtSize - 12),
      });
    }
    return list;
  }, [cx, cz]);

  return (
    <>
      {props.map((prop) => (
        <RigidBody key={prop.key} type="fixed" position={[prop.x, 0, prop.z]}>
          <CuboidCollider
            args={[prop.radius, propColliderHeight / 2, prop.radius]}
            position={[0, propColliderHeight / 2, 0]}
          />
          <PropVisual kind={prop.kind} radius={prop.radius} />
        </RigidBody>
      ))}
    </>
  );
}

function PropPlaceholder({ kind, radius }: { kind: string; radius: number }) {
  return (
    <mesh position={[0, propColliderHeight / 2, 0]} castShadow>
      <cylinderGeometry args={[radius * 0.8, radius, propColliderHeight, 8]} />
      <meshStandardMaterial
        color="#131d31"
        emissive={PROP_BY_KIND[kind]?.accent ?? "#ffffff"}
        emissiveIntensity={0.9}
        metalness={0.6}
        roughness={0.35}
      />
    </mesh>
  );
}

function PropModel({ kind, radius }: { kind: string; radius: number }) {
  const def = PROP_BY_KIND[kind];
  const { scene } = useGLTF(def.model);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const maxFootprint = Math.max(size.x, size.z, 0.001);
    let scale = (radius * 2.2) / maxFootprint;
    // Vrlo visoki modeli (npr. antenske kule) se ogranicavaju po visini
    const maxHeight = ARENA_CONFIG.world.maxPropHeight;
    if (size.y * scale > maxHeight) scale = maxHeight / size.y;
    clone.scale.setScalar(scale);
    const scaledBox = new THREE.Box3().setFromObject(clone);
    const center = scaledBox.getCenter(new THREE.Vector3());
    clone.position.set(-center.x, -scaledBox.min.y, -center.z);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) child.castShadow = true;
    });
    return clone;
  }, [scene, radius]);
  return <primitive object={model} />;
}

function PropVisual({ kind, radius }: { kind: string; radius: number }) {
  const def = PROP_BY_KIND[kind];
  if (!def?.modelReady) return <PropPlaceholder kind={kind} radius={radius} />;
  return (
    <Suspense fallback={<PropPlaceholder kind={kind} radius={radius} />}>
      <PropModel kind={kind} radius={radius} />
    </Suspense>
  );
}

for (const kind of PROP_KINDS) {
  if (kind.modelReady) useGLTF.preload(kind.model);
}

function Chunk({ cx, cz, textures }: { cx: number; cz: number; textures: THREE.Texture[] }) {
  const texture = textures[Math.floor(hash2(cx, cz, 1) * textures.length)];
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cx * districtSize, -0.02, cz * districtSize]}
        receiveShadow
      >
        <planeGeometry args={[districtSize, districtSize]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={0.42}
          metalness={0.2}
          roughness={0.85}
        />
      </mesh>
      <ChunkProps cx={cx} cz={cz} />
    </group>
  );
}

export default function DistrictFloor() {
  const world = useArenaWorld();
  const [center, setCenter] = useState<[number, number]>([0, 0]);
  const centerRef = useRef(center);

  useFrame(() => {
    const cx = Math.round(world.playerPosition.x / districtSize);
    const cz = Math.round(world.playerPosition.z / districtSize);
    if (cx !== centerRef.current[0] || cz !== centerRef.current[1]) {
      centerRef.current = [cx, cz];
      setCenter([cx, cz]);
    }
  });

  const textures = useTexture(DISTRICT_IMAGES);
  const configured = useMemo(() => {
    for (const texture of textures) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
    }
    return textures;
  }, [textures]);

  const chunks: Array<[number, number]> = [];
  for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
    for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
      chunks.push([center[0] + dx, center[1] + dz]);
    }
  }

  return (
    <group>
      {chunks.map(([cx, cz]) => (
        <Chunk key={`${cx}:${cz}`} cx={cx} cz={cz} textures={configured} />
      ))}
    </group>
  );
}

for (const image of DISTRICT_IMAGES) useTexture.preload(image);
