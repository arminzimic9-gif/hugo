"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import ARENA_CONFIG from "@/data/arena-config.json";

const { tileSize, gridWidth, gridHeight, wallHeight, wallThickness, propColliderHeight } =
  ARENA_CONFIG.world;

const FLOOR_WIDTH = tileSize * gridWidth;
const FLOOR_DEPTH = tileSize * gridHeight;
const HALF_W = FLOOR_WIDTH / 2;
const HALF_D = FLOOR_DEPTH / 2;

const TILE_BASE = new THREE.Color("#0b1220");
const TILE_ALT = new THREE.Color("#101b30");
const TILE_ACCENT = new THREE.Color(ARENA_CONFIG.meta.accent);

function Tiles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = gridWidth * gridHeight;

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    let index = 0;
    for (let gx = 0; gx < gridWidth; gx++) {
      for (let gz = 0; gz < gridHeight; gz++) {
        const x = gx * tileSize - HALF_W + tileSize / 2;
        const z = gz * tileSize - HALF_D + tileSize / 2;
        matrix.setPosition(x, -0.06, z);
        mesh.setMatrixAt(index, matrix);
        const checker = (gx + gz) % 2 === 0;
        color.copy(checker ? TILE_BASE : TILE_ALT);
        // Rijetki akcentni tile-ovi daju neon ritam podu.
        if ((gx * 7 + gz * 13) % 29 === 0) color.lerp(TILE_ACCENT, 0.18);
        mesh.setColorAt(index, color);
        index++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} receiveShadow>
      <boxGeometry args={[tileSize * 0.97, 0.12, tileSize * 0.97]} />
      <meshStandardMaterial metalness={0.35} roughness={0.7} />
    </instancedMesh>
  );
}

function Walls() {
  const wallMaterial = (
    <meshStandardMaterial
      color="#111a2c"
      emissive={ARENA_CONFIG.meta.accent}
      emissiveIntensity={0.12}
      metalness={0.5}
      roughness={0.4}
    />
  );
  const y = wallHeight / 2;
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh position={[0, y, -HALF_D - wallThickness / 2]}>
        <boxGeometry args={[FLOOR_WIDTH + wallThickness * 2, wallHeight, wallThickness]} />
        {wallMaterial}
      </mesh>
      <mesh position={[0, y, HALF_D + wallThickness / 2]}>
        <boxGeometry args={[FLOOR_WIDTH + wallThickness * 2, wallHeight, wallThickness]} />
        {wallMaterial}
      </mesh>
      <mesh position={[-HALF_W - wallThickness / 2, y, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, FLOOR_DEPTH]} />
        {wallMaterial}
      </mesh>
      <mesh position={[HALF_W + wallThickness / 2, y, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, FLOOR_DEPTH]} />
        {wallMaterial}
      </mesh>
      {[
        [-HALF_W, -HALF_D],
        [HALF_W, -HALF_D],
        [-HALF_W, HALF_D],
        [HALF_W, HALF_D],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, wallHeight * 0.75, z]}>
          <boxGeometry args={[wallThickness * 2.4, wallHeight * 1.5, wallThickness * 2.4]} />
          <meshStandardMaterial
            color="#182238"
            emissive={ARENA_CONFIG.meta.danger}
            emissiveIntensity={0.25}
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>
      ))}
    </RigidBody>
  );
}

const PROP_COLORS: Record<string, string> = {
  reactor: ARENA_CONFIG.meta.support,
  relay: ARENA_CONFIG.meta.accent,
  pylon: "#b13bff",
};

function Props() {
  const props = ARENA_CONFIG.props;
  return (
    <>
      {props.map((prop) => (
        <RigidBody key={prop.id} type="fixed" position={[prop.x, 0, prop.z]}>
          <CuboidCollider
            args={[prop.radius, propColliderHeight / 2, prop.radius]}
            position={[0, propColliderHeight / 2, 0]}
          />
          <mesh position={[0, propColliderHeight / 2, 0]} castShadow>
            <cylinderGeometry args={[prop.radius * 0.8, prop.radius, propColliderHeight, 8]} />
            <meshStandardMaterial
              color="#131d31"
              emissive={PROP_COLORS[prop.kind] ?? "#ffffff"}
              emissiveIntensity={0.4}
              metalness={0.6}
              roughness={0.35}
            />
          </mesh>
          <pointLight
            color={PROP_COLORS[prop.kind] ?? "#ffffff"}
            intensity={6}
            distance={10}
            position={[0, propColliderHeight + 0.6, 0]}
          />
        </RigidBody>
      ))}
    </>
  );
}

export const ARENA_BOUNDS = { halfWidth: HALF_W, halfDepth: HALF_D };

export default function TileFloor() {
  const groundArgs = useMemo(
    () => [HALF_W + wallThickness, 0.5, HALF_D + wallThickness] as [number, number, number],
    []
  );
  return (
    <group>
      <RigidBody type="fixed">
        <CuboidCollider args={groundArgs} position={[0, -0.5, 0]} />
      </RigidBody>
      <Tiles />
      <Walls />
      <Props />
    </group>
  );
}
