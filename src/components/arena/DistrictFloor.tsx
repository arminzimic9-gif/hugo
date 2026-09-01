"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import ARENA_CONFIG from "@/data/arena-config.json";
import DESTRUCTION_ASSETS from "@/data/arena-destruction-assets.json";
import { useArenaSession, type CataclysmZone } from "@/store/arenaSession";
import { useArenaWorld } from "./world";

const { districtSize, chunkRadius, propColliderHeight, nodeChance, maxPropsPerChunk } =
  ARENA_CONFIG.world;
const DISTRICT_IMAGES = ARENA_CONFIG.districts.map((district) => district.image);
const SAFE_ROAD_HALF_WIDTH = 4.25;
const MIN_BUILDING_SECTION = 2.4;
const BUILDING_FOOTPRINT_SCALE = 0.86;
const COLLIDER_FOOTPRINT_SCALE = 0.82;

type PropDefinition = {
  kind: string;
  radius: number;
  accent: string;
  model: string;
  modelReady: boolean;
  solid?: boolean;
  colliderHalfExtents?: [number, number];
};

type DestructionAssetDefinition = {
  id: string;
  kind: string;
  model: string;
  modelReady: boolean;
  footprint: [number, number];
  height: number;
  weight: number;
  solid: boolean;
};

const PROP_KINDS = ARENA_CONFIG.propKinds as PropDefinition[];
const WRECK_MODELS = (DESTRUCTION_ASSETS as DestructionAssetDefinition[]).filter(
  (asset) => asset.kind === "vehicle-wreck" && asset.modelReady
);
const LIVING_TREE_MODELS = (DESTRUCTION_ASSETS as DestructionAssetDefinition[]).filter(
  (asset) => asset.kind === "living-street-tree" && asset.modelReady
);
const BURNED_TREE_MODELS = (DESTRUCTION_ASSETS as DestructionAssetDefinition[]).filter(
  (asset) => asset.kind === "burned-street-tree" && asset.modelReady
);
const VERDANT_BUSH_MODELS = (DESTRUCTION_ASSETS as DestructionAssetDefinition[]).filter(
  (asset) => asset.kind === "living-street-bush" && asset.modelReady
);
const SWAMP_BUSH_MODELS = (DESTRUCTION_ASSETS as DestructionAssetDefinition[]).filter(
  (asset) => asset.kind === "swamp-bush" && asset.modelReady
);
const RAIL_MODELS = (DESTRUCTION_ASSETS as DestructionAssetDefinition[]).filter(
  (asset) => asset.kind === "modular-rail" && asset.modelReady
);
const CRATER_MODELS = (DESTRUCTION_ASSETS as DestructionAssetDefinition[]).filter(
  (asset) => asset.kind === "cataclysm-terrain" && asset.modelReady
);
const RUIN_MODELS = (DESTRUCTION_ASSETS as DestructionAssetDefinition[]).filter(
  (asset) => asset.kind === "destroyed-building" && asset.modelReady
);

// Text-to-3D city kit je odbijen zbog art-direction mismatcha. Novi modeli se ovdje
// dodaju tek nakon 2D concept reviewa i Meshy image-to-3D prolaza.
const BUILDING_MODELS = [
  "/models/environment/cyber-tower-wide-v2.glb",
  "/models/environment/cyber-tower-tall-v2.glb",
  "/models/environment/industrial-warehouse-v2.glb",
] as const;

const PROP_BY_KIND = Object.fromEntries(PROP_KINDS.map((kind) => [kind.kind, kind]));
type ArenaBiome = (typeof ARENA_CONFIG.districts)[number]["biome"];

function createEdgeFadeTexture(size = 96): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y) / (size - 1);
      const alpha = Math.round(THREE.MathUtils.smoothstep(edge, 0.012, 0.072) * 255);
      const offset = (y * size + x) * 4;
      data[offset] = alpha;
      data[offset + 1] = alpha;
      data[offset + 2] = alpha;
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

function isRoadClear(localX: number, localZ: number, halfX: number, halfZ: number): boolean {
  return (
    Math.abs(localX) - halfX >= SAFE_ROAD_HALF_WIDTH &&
    Math.abs(localZ) - halfZ >= SAFE_ROAD_HALF_WIDTH
  );
}

function splitOutsideSafeRoad(min: number, max: number): Array<[number, number]> {
  const segments: Array<[number, number]> = [];
  const leftMax = Math.min(max, -SAFE_ROAD_HALF_WIDTH);
  if (leftMax - min >= MIN_BUILDING_SECTION) segments.push([min, leftMax]);
  const rightMin = Math.max(min, SAFE_ROAD_HALF_WIDTH);
  if (max - rightMin >= MIN_BUILDING_SECTION) segments.push([rightMin, max]);
  return segments;
}

function footprintIntersectsCataclysm(
  x: number,
  z: number,
  halfX: number,
  halfZ: number,
  zones: CataclysmZone[]
): boolean {
  return zones.some((zone) => {
    const dx = Math.max(0, Math.abs(zone.x - x) - halfX);
    const dz = Math.max(0, Math.abs(zone.z - z) - halfZ);
    return dx * dx + dz * dz <= zone.radius * zone.radius;
  });
}

// Deterministicki hash po chunk koordinatama — mapa je ista pri svakom povratku.
function hash2(cx: number, cz: number, salt: number): number {
  let h = Math.imul(cx, 374761393) ^ Math.imul(cz, 668265263) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type ChunkProp = {
  key: number;
  kind: string;
  radius: number;
  x: number;
  z: number;
  rotation: number;
};

function ChunkPropObject({ prop }: { prop: ChunkProp }) {
  const def = PROP_BY_KIND[prop.kind] as PropDefinition | undefined;
  if (def?.solid === false) {
    return (
      <group position={[prop.x, 0, prop.z]} rotation={[0, prop.rotation, 0]}>
        <PropVisual kind={prop.kind} radius={prop.radius} />
      </group>
    );
  }
  const halfX = (def?.colliderHalfExtents?.[0] ?? prop.radius) * COLLIDER_FOOTPRINT_SCALE;
  const halfZ = (def?.colliderHalfExtents?.[1] ?? prop.radius) * COLLIDER_FOOTPRINT_SCALE;
  return (
    <RigidBody type="fixed" position={[prop.x, 0, prop.z]} rotation={[0, prop.rotation, 0]}>
      <CuboidCollider
        args={[halfX, propColliderHeight / 2, halfZ]}
        position={[0, propColliderHeight / 2, 0]}
      />
      <PropVisual kind={prop.kind} radius={prop.radius} />
    </RigidBody>
  );
}

function ChunkProps({ cx, cz, cataclysmZones }: { cx: number; cz: number; cataclysmZones: CataclysmZone[] }) {
  const props = useMemo<ChunkProp[]>(() => {
    // Pocetni kadar dobija prepoznatljive landmarke, ali sredina ostaje sigurna za spawn.
    if (cx === 0 && cz === 0) {
      const startKinds = ["reactor", "relay", "cargo", "pylon"];
      const startPositions: Array<[number, number]> = [
        [-10.5, -10],
        [10.5, -10],
        [-10.5, 10],
        [10.5, 10],
      ];
      return startKinds
        .map((kind, key) => ({
          key,
          kind,
          radius: (PROP_BY_KIND[kind] as PropDefinition).radius,
          x: startPositions[key][0],
          z: startPositions[key][1],
          rotation: key % 2 === 0 ? 0 : Math.PI,
        }))
        .filter(
          (prop) =>
            !footprintIntersectsCataclysm(
              prop.x,
              prop.z,
              prop.radius,
              prop.radius,
              cataclysmZones
            )
        );
    }
    if (hash2(cx, cz, 11) > nodeChance) return [];
    const count = 1 + Math.floor(hash2(cx, cz, 12) * maxPropsPerChunk) % maxPropsPerChunk;
    const list: ChunkProp[] = [];
    for (let i = 0; i < count; i++) {
      const kind = PROP_KINDS[Math.floor(hash2(cx, cz, 20 + i) * PROP_KINDS.length)];
      const radius = kind.radius;
      const x = (hash2(cx, cz, 30 + i) - 0.5) * (districtSize - 12);
      const z = (hash2(cx, cz, 40 + i) - 0.5) * (districtSize - 12);
      if (!isRoadClear(x, z, radius, radius)) continue;
      list.push({
        key: i,
        kind: kind.kind,
        radius,
        x: cx * districtSize + x,
        z: cz * districtSize + z,
        rotation: Math.floor(hash2(cx, cz, 50 + i) * 4) * (Math.PI / 2),
      });
    }
    return list.filter(
      (prop) =>
        !footprintIntersectsCataclysm(
          prop.x,
          prop.z,
          prop.radius,
          prop.radius,
          cataclysmZones
        )
    );
  }, [cx, cz, cataclysmZones]);

  return (
    <>
      {props.map((prop) => (
        <ChunkPropObject key={prop.key} prop={prop} />
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

function WreckModel({ asset }: { asset: DestructionAssetDefinition }) {
  const { scene } = useGLTF(asset.model);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const sourceBox = new THREE.Box3().setFromObject(clone);
    const size = sourceBox.getSize(new THREE.Vector3());
    const scale = Math.min(
      asset.footprint[0] / Math.max(0.001, size.x),
      asset.footprint[1] / Math.max(0.001, size.z),
      asset.height / Math.max(0.001, size.y)
    );
    clone.scale.setScalar(scale);
    const scaledBox = new THREE.Box3().setFromObject(clone);
    const center = scaledBox.getCenter(new THREE.Vector3());
    clone.position.set(-center.x, -scaledBox.min.y, -center.z);
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return clone;
  }, [scene, asset]);
  return <primitive object={model} />;
}

function ChunkWrecks({
  cx,
  cz,
  cataclysmZones,
}: {
  cx: number;
  cz: number;
  cataclysmZones: CataclysmZone[];
}) {
  const wrecks = useMemo(() => {
    if (
      WRECK_MODELS.length === 0 ||
      (!(cx === 0 && cz === 0) && hash2(cx, cz, 201) > 0.5)
    ) {
      return [];
    }
    const count = hash2(cx, cz, 202) > 0.86 ? 2 : 1;
    const placed: Array<{
      asset: DestructionAssetDefinition;
      key: number;
      rotation: number;
      x: number;
      z: number;
    }> = [];
    for (let index = 0; index < count; index++) {
      const asset = WRECK_MODELS[
        Math.floor(hash2(cx, cz, 203 + index) * WRECK_MODELS.length)
      ];
      const horizontal = hash2(cx, cz, 205 + index) > 0.5;
      const crossHalf = asset.footprint[1] / 2;
      const laneOffset = Math.max(0.55, SAFE_ROAD_HALF_WIDTH - crossHalf - 0.28);
      const alongStart = SAFE_ROAD_HALF_WIDTH + asset.footprint[0] / 2 + 1.2;
      const alongEnd = districtSize / 2 - asset.footprint[0] / 2 - 1.2;
      const along = THREE.MathUtils.lerp(
        Math.min(alongStart, alongEnd),
        Math.max(alongStart, alongEnd),
        hash2(cx, cz, 211 + index)
      );
      const alongSign = hash2(cx, cz, 221 + index) > 0.5 ? 1 : -1;
      const laneSign = hash2(cx, cz, 223 + index) > 0.5 ? 1 : -1;
      const localX = horizontal ? along * alongSign : laneOffset * laneSign;
      const localZ = horizontal ? laneOffset * laneSign : along * alongSign;
      const x = cx * districtSize + localX;
      const z = cz * districtSize + localZ;
      const safeHalf = Math.max(asset.footprint[0], asset.footprint[1]) / 2;
      if (footprintIntersectsCataclysm(x, z, safeHalf, safeHalf, cataclysmZones)) continue;
      placed.push({
        asset,
        key: index,
        rotation: horizontal ? 0 : Math.PI / 2,
        x,
        z,
      });
    }
    return placed;
  }, [cx, cz, cataclysmZones]);

  return (
    <>
      {wrecks.map((wreck) => (
        <RigidBody
          key={wreck.key}
          type="fixed"
          position={[wreck.x, 0, wreck.z]}
          rotation={[0, wreck.rotation, 0]}
          colliders={false}
        >
          {wreck.asset.solid ? (
            <CuboidCollider
              args={[
                (wreck.asset.footprint[0] * COLLIDER_FOOTPRINT_SCALE) / 2,
                wreck.asset.height / 2,
                (wreck.asset.footprint[1] * COLLIDER_FOOTPRINT_SCALE) / 2,
              ]}
              position={[0, wreck.asset.height / 2, 0]}
            />
          ) : null}
          <Suspense fallback={null}>
            <WreckModel asset={wreck.asset} />
          </Suspense>
        </RigidBody>
      ))}
    </>
  );
}

function ChunkVegetation({
  cx,
  cz,
  biome,
  cataclysmZones,
}: {
  cx: number;
  cz: number;
  biome: ArenaBiome;
  cataclysmZones: CataclysmZone[];
}) {
  const vegetation = useMemo(() => {
    const biomeModels =
      biome === "verdant-rift"
        ? [...LIVING_TREE_MODELS, ...VERDANT_BUSH_MODELS, ...VERDANT_BUSH_MODELS]
        : biome === "rail-marsh" || biome === "reservoir"
          ? [...LIVING_TREE_MODELS, ...SWAMP_BUSH_MODELS, ...SWAMP_BUSH_MODELS]
          : LIVING_TREE_MODELS;
    if (biomeModels.length === 0) return [];
    const count = (biome === "urban" ? 1 : 3) + Math.floor(hash2(cx, cz, 302) * 4);
    const placed: Array<{ asset: DestructionAssetDefinition; key: number; x: number; z: number; rotation: number }> = [];
    for (let index = 0; index < count; index++) {
      const asset = biomeModels[
        Math.floor(hash2(cx, cz, 305 + index) * biomeModels.length)
      ];
      const halfX = asset.footprint[0] / 2;
      const halfZ = asset.footprint[1] / 2;
      const localX = (hash2(cx, cz, 311 + index) - 0.5) * (districtSize - 8);
      const localZ = (hash2(cx, cz, 321 + index) - 0.5) * (districtSize - 8);
      if (!isRoadClear(localX, localZ, halfX, halfZ)) continue;
      const x = cx * districtSize + localX;
      const z = cz * districtSize + localZ;
      if (footprintIntersectsCataclysm(x, z, halfX, halfZ, cataclysmZones)) continue;
      placed.push({
        asset,
        key: index,
        x,
        z,
        rotation: hash2(cx, cz, 331 + index) * Math.PI * 2,
      });
    }
    return placed;
  }, [biome, cx, cz, cataclysmZones]);

  return (
    <>
      {vegetation.map((plant) => (
        <group key={plant.key} position={[plant.x, 0, plant.z]} rotation={[0, plant.rotation, 0]}>
          <Suspense fallback={null}>
            <WreckModel asset={plant.asset} />
          </Suspense>
        </group>
      ))}
    </>
  );
}

function WaterPatch({
  x,
  z,
  size,
  biome,
  phase,
}: {
  x: number;
  z: number;
  size: number;
  biome: ArenaBiome;
  phase: number;
}) {
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const isVerdant = biome === "verdant-rift";
  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    const pulse = 0.5 + Math.sin(clock.elapsedTime * 0.85 + phase) * 0.5;
    materialRef.current.opacity = (isVerdant ? 0.14 : 0.2) + pulse * 0.08;
    materialRef.current.emissiveIntensity = (isVerdant ? 0.6 : 0.32) + pulse * 0.22;
  });
  return (
    <mesh position={[x, 0.018, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
      <planeGeometry args={[size, size]} />
      <meshPhysicalMaterial
        ref={materialRef}
        color={isVerdant ? "#0a7f48" : "#06384b"}
        emissive={isVerdant ? "#38ff84" : "#00b9db"}
        emissiveIntensity={0.5}
        metalness={0.15}
        roughness={0.18}
        transparent
        opacity={0.22}
        depthWrite={false}
      />
    </mesh>
  );
}

function ChunkBiomeWater({ cx, cz, biome }: { cx: number; cz: number; biome: ArenaBiome }) {
  if (biome === "urban") return null;
  const patchSize = districtSize / 2 - SAFE_ROAD_HALF_WIDTH - 1.2;
  const offset = (districtSize / 2 + SAFE_ROAD_HALF_WIDTH) / 2;
  return (
    <group position={[cx * districtSize, 0, cz * districtSize]}>
      {[
        [-offset, -offset],
        [offset, -offset],
        [-offset, offset],
        [offset, offset],
      ].map(([x, z], index) => (
        <WaterPatch
          key={`${x}:${z}`}
          x={x}
          z={z}
          size={patchSize}
          biome={biome}
          phase={index * 1.71 + hash2(cx, cz, 410) * Math.PI}
        />
      ))}
    </group>
  );
}

function ChunkRails({ cx, cz, biome }: { cx: number; cz: number; biome: ArenaBiome }) {
  const rail = RAIL_MODELS[0];
  if (!rail || (biome !== "rail-marsh" && biome !== "reservoir")) return null;
  const horizontal = hash2(cx, cz, 451) > 0.5;
  const spacing = rail.footprint[0];
  return (
    <group>
      {[-1.5, -0.5, 0.5, 1.5].map((step) => (
        <group
          key={step}
          position={[
            cx * districtSize + (horizontal ? step * spacing : 0),
            0.026,
            cz * districtSize + (horizontal ? 0 : step * spacing),
          ]}
          rotation={[0, horizontal ? 0 : Math.PI / 2, 0]}
        >
          <Suspense fallback={null}>
            <WreckModel asset={rail} />
          </Suspense>
        </group>
      ))}
    </group>
  );
}

function CataclysmAssetModels({ zones }: { zones: CataclysmZone[] }) {
  const crater = CRATER_MODELS[0];
  const ruin = RUIN_MODELS[0];
  const burnedTree = BURNED_TREE_MODELS[0];
  if (!crater && !ruin && !burnedTree) return null;

  return (
    <group>
      {zones.map((zone) => (
        <group key={zone.id}>
          {crater && zone.tier > 0 ? (
            <group position={[zone.x, 0.035, zone.z]} rotation={[0, zone.id * 1.37, 0]}>
              <Suspense fallback={null}>
                <WreckModel asset={crater} />
              </Suspense>
            </group>
          ) : null}
          {ruin && zone.tier > 0 ? (
            <RigidBody
              type="fixed"
              colliders={false}
              position={[zone.x + zone.radius * 0.56, 0, zone.z - zone.radius * 0.34]}
              rotation={[0, -0.72 + zone.id * 0.3, 0]}
            >
              <CuboidCollider
                args={[ruin.footprint[0] * 0.28, ruin.height * 0.3, ruin.footprint[1] * 0.22]}
                position={[0, ruin.height * 0.3, 0]}
              />
              <Suspense fallback={null}>
                <WreckModel asset={ruin} />
              </Suspense>
            </RigidBody>
          ) : null}
          {burnedTree && zone.tier > 0
            ? [0.18, 2.27, 4.36].map((angle, index) => (
                <group
                  key={angle}
                  position={[
                    zone.x + Math.cos(angle + zone.id) * zone.radius * 0.72,
                    0,
                    zone.z + Math.sin(angle + zone.id) * zone.radius * 0.72,
                  ]}
                  rotation={[0, angle + zone.id, 0]}
                  scale={0.8 + index * 0.08}
                >
                  <Suspense fallback={null}>
                    <WreckModel asset={burnedTree} />
                  </Suspense>
                </group>
              ))
            : null}
        </group>
      ))}
    </group>
  );
}

for (const kind of PROP_KINDS) {
  if (kind.modelReady) useGLTF.preload(kind.model);
}

function BuildingPlaceholder({ width, depth, height }: { width: number; depth: number; height: number }) {
  return (
    <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial
        color="#0a101d"
        emissive={ARENA_CONFIG.meta.accent}
        emissiveIntensity={0.2}
        metalness={0.55}
        roughness={0.5}
      />
    </mesh>
  );
}

function BuildingModel({
  modelPath,
  width,
  depth,
  height,
  rotation,
}: {
  modelPath: string;
  width: number;
  depth: number;
  height: number;
  rotation: number;
}) {
  const { scene } = useGLTF(modelPath);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const sourceBox = new THREE.Box3().setFromObject(clone);
    const sourceSize = sourceBox.getSize(new THREE.Vector3());
    const safeX = Math.max(sourceSize.x, 0.001);
    const safeY = Math.max(sourceSize.y, 0.001);
    const safeZ = Math.max(sourceSize.z, 0.001);

    // District maske odredjuju koliziju i footprint; model puni isti prostor umjesto stare kocke.
    clone.scale.set(
      (width * BUILDING_FOOTPRINT_SCALE) / safeX,
      height / safeY,
      (depth * BUILDING_FOOTPRINT_SCALE) / safeZ
    );
    const scaledBox = new THREE.Box3().setFromObject(clone);
    const center = scaledBox.getCenter(new THREE.Vector3());
    clone.position.set(-center.x, -scaledBox.min.y, -center.z);
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        material.envMapIntensity = Math.max(material.envMapIntensity, 1.15);
        if (material.emissiveMap) material.emissiveIntensity = Math.max(material.emissiveIntensity, 1.2);
      }
    });
    return clone;
  }, [scene, width, depth, height]);

  return (
    <group rotation={[0, rotation, 0]}>
      <primitive object={model} />
    </group>
  );
}

function BuildingVisual({
  modelPath,
  width,
  depth,
  height,
  rotation,
}: {
  modelPath: string | null;
  width: number;
  depth: number;
  height: number;
  rotation: number;
}) {
  if (!modelPath) return <BuildingPlaceholder width={width} depth={depth} height={height} />;
  return (
    <Suspense fallback={<BuildingPlaceholder width={width} depth={depth} height={height} />}>
      <BuildingModel
        modelPath={modelPath}
        width={width}
        depth={depth}
        height={height}
        rotation={rotation}
      />
    </Suspense>
  );
}

// Zgrade iz district arta dobijaju modularne Meshy fasade i zadrzavaju tacnu koliziju.
function ChunkBuildings({
  cx,
  cz,
  districtIndex,
  cataclysmZones,
}: {
  cx: number;
  cz: number;
  districtIndex: number;
  cataclysmZones: CataclysmZone[];
}) {
  const district = ARENA_CONFIG.districts[districtIndex];
  const height = ARENA_CONFIG.buildingHeight;
  const blocks = useMemo(
    () =>
      district.buildings.flatMap(([u, v, w, h], i) => {
        const xMin = (u - 0.5) * districtSize;
        const xMax = (u + w - 0.5) * districtSize;
        const zMin = (v - 0.5) * districtSize;
        const zMax = (v + h - 0.5) * districtSize;
        const xSections = splitOutsideSafeRoad(xMin, xMax);
        const zSections = splitOutsideSafeRoad(zMin, zMax);
        return xSections.flatMap(([sectionXMin, sectionXMax], xIndex) =>
          zSections.map(([sectionZMin, sectionZMax], zIndex) => {
            const part = xIndex * 2 + zIndex;
            const width = sectionXMax - sectionXMin;
            const depth = sectionZMax - sectionZMin;
            return {
              key: `${i}:${part}`,
              x: cx * districtSize + (sectionXMin + sectionXMax) / 2,
              z: cz * districtSize + (sectionZMin + sectionZMax) / 2,
              width,
              depth,
              // Veca vertikalna varijacija i modularne fasade sprecavaju efekat stampane mape.
              height: height * (1 + hash2(cx, cz, 60 + i + part) * 1.15),
              modelPath:
                BUILDING_MODELS.length > 0
                  ? BUILDING_MODELS[
                      Math.floor(hash2(cx, cz, 90 + i + part) * BUILDING_MODELS.length)
                    ]
                  : null,
              rotation: hash2(cx, cz, 120 + i + part) > 0.5 ? Math.PI : 0,
            };
          })
        ).filter(
          (block) =>
            !footprintIntersectsCataclysm(
              block.x,
              block.z,
              block.width / 2,
              block.depth / 2,
              cataclysmZones
            )
        );
      }),
    [cx, cz, district, height, cataclysmZones]
  );

  return (
    <>
      {blocks.map((block) => (
        <RigidBody key={block.key} type="fixed" position={[block.x, 0, block.z]}>
          <CuboidCollider
            args={[
              (block.width * COLLIDER_FOOTPRINT_SCALE) / 2,
              block.height / 2,
              (block.depth * COLLIDER_FOOTPRINT_SCALE) / 2,
            ]}
            position={[0, block.height / 2, 0]}
          />
          <BuildingVisual
            modelPath={block.modelPath}
            width={block.width}
            depth={block.depth}
            height={block.height}
            rotation={block.rotation}
          />
        </RigidBody>
      ))}
    </>
  );
}

function RoadNetwork({ cx, cz }: { cx: number; cz: number }) {
  const centerX = cx * districtSize;
  const centerZ = cz * districtSize;
  return (
    <group position={[centerX, 0.012, centerZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <planeGeometry args={[SAFE_ROAD_HALF_WIDTH * 2, districtSize + 0.2]} />
        <meshBasicMaterial color="#020811" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <planeGeometry args={[districtSize + 0.2, SAFE_ROAD_HALF_WIDTH * 2]} />
        <meshBasicMaterial color="#020811" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      {[-SAFE_ROAD_HALF_WIDTH, SAFE_ROAD_HALF_WIDTH].map((offset) => (
        <group key={`lanes:${offset}`}>
          <mesh position={[offset, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
            <planeGeometry args={[0.06, districtSize]} />
            <meshBasicMaterial color="#19d9e8" transparent opacity={0.2} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.006, offset]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
            <planeGeometry args={[districtSize, 0.06]} />
            <meshBasicMaterial color="#19d9e8" transparent opacity={0.2} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ChunkSeams({ cx, cz, biome }: { cx: number; cz: number; biome: ArenaBiome }) {
  const accent = biome === "verdant-rift" ? "#43ff86" : biome === "urban" ? "#19d9e8" : "#16cfe2";
  const centerX = cx * districtSize;
  const centerZ = cz * districtSize;
  return (
    <group>
      <mesh
        position={[centerX + districtSize / 2, 0.021, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={5}
      >
        <planeGeometry args={[1.4, districtSize + 1.4]} />
        <meshStandardMaterial color="#050b12" metalness={0.72} roughness={0.42} />
      </mesh>
      <mesh
        position={[centerX, 0.022, centerZ + districtSize / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={5}
      >
        <planeGeometry args={[districtSize + 1.4, 1.4]} />
        <meshStandardMaterial color="#050b12" metalness={0.72} roughness={0.42} />
      </mesh>
      <mesh
        position={[centerX + districtSize / 2, 0.025, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={6}
      >
        <planeGeometry args={[0.07, districtSize + 1.4]} />
        <meshBasicMaterial color={accent} transparent opacity={0.36} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh
        position={[centerX, 0.026, centerZ + districtSize / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={6}
      >
        <planeGeometry args={[districtSize + 1.4, 0.07]} />
        <meshBasicMaterial color={accent} transparent opacity={0.36} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Chunk({
  cx,
  cz,
  textures,
  edgeFade,
  cataclysmZones,
}: {
  cx: number;
  cz: number;
  textures: THREE.Texture[];
  edgeFade: THREE.Texture;
  cataclysmZones: CataclysmZone[];
}) {
  const districtIndex = Math.floor(hash2(cx, cz, 1) * textures.length);
  const texture = textures[districtIndex];
  const biome = ARENA_CONFIG.districts[districtIndex].biome;
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cx * districtSize, -0.035, cz * districtSize]}
        receiveShadow
      >
        <planeGeometry args={[districtSize + 0.12, districtSize + 0.12]} />
        <meshStandardMaterial
          color="#07101b"
          emissive="#071522"
          emissiveIntensity={0.32}
          metalness={0.45}
          roughness={0.78}
        />
      </mesh>
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
          alphaMap={edgeFade}
          transparent
        />
      </mesh>
      <ChunkBiomeWater cx={cx} cz={cz} biome={biome} />
      <ChunkSeams cx={cx} cz={cz} biome={biome} />
      <RoadNetwork cx={cx} cz={cz} />
      <ChunkRails cx={cx} cz={cz} biome={biome} />
      <ChunkBuildings
        cx={cx}
        cz={cz}
        districtIndex={districtIndex}
        cataclysmZones={cataclysmZones}
      />
      <ChunkProps cx={cx} cz={cz} cataclysmZones={cataclysmZones} />
      <ChunkWrecks cx={cx} cz={cz} cataclysmZones={cataclysmZones} />
      <ChunkVegetation
        cx={cx}
        cz={cz}
        biome={biome}
        cataclysmZones={cataclysmZones}
      />
    </group>
  );
}

export default function DistrictFloor() {
  const world = useArenaWorld();
  const cataclysmZones = useArenaSession((state) => state.cataclysmZones);
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
    return textures.map((source) => {
      const texture = source.clone();
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
      return texture;
    });
  }, [textures]);
  const edgeFade = useMemo(() => createEdgeFadeTexture(), []);
  useEffect(() => () => configured.forEach((texture) => texture.dispose()), [configured]);
  useEffect(() => () => edgeFade.dispose(), [edgeFade]);

  const chunks: Array<[number, number]> = [];
  for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
    for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
      chunks.push([center[0] + dx, center[1] + dz]);
    }
  }

  return (
    <group>
      {chunks.map(([cx, cz]) => (
        <Chunk
          key={`${cx}:${cz}`}
          cx={cx}
          cz={cz}
          textures={configured}
          edgeFade={edgeFade}
          cataclysmZones={cataclysmZones}
        />
      ))}
      <CataclysmAssetModels zones={cataclysmZones} />
    </group>
  );
}

for (const image of DISTRICT_IMAGES) useTexture.preload(image);
for (const model of BUILDING_MODELS) useGLTF.preload(model);
for (const asset of DESTRUCTION_ASSETS as DestructionAssetDefinition[]) {
  if (asset.modelReady) useGLTF.preload(asset.model);
}
