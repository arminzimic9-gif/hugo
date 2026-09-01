"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useArenaWorld } from "./world";

const CHUNK_SIZE = 30;
const CHUNK_RADIUS = 1;
const SAFE_CORRIDOR_HALF_WIDTH = 4.4;

function hash2(cx: number, cz: number, salt: number): number {
  let value = Math.imul(cx, 374761393) ^ Math.imul(cz, 668265263) ^ Math.imul(salt, 2246822519);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function UndergroundMachine({
  x,
  z,
  rotation,
  color,
}: {
  x: number;
  z: number;
  rotation: number;
  color: string;
}) {
  return (
    <RigidBody type="fixed" position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <CuboidCollider args={[1.25, 1.05, 0.9]} position={[0, 1.05, 0]} />
      <group>
        <mesh position={[0, 1.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.5, 2.1, 1.8]} />
          <meshStandardMaterial color="#080d15" metalness={0.82} roughness={0.38} />
        </mesh>
        {[-0.68, 0, 0.68].map((offset) => (
          <mesh key={offset} position={[offset, 1.15, 0.92]}>
            <boxGeometry args={[0.34, 0.92, 0.045]} />
            <meshBasicMaterial color={color} transparent opacity={0.72} toneMapped={false} />
          </mesh>
        ))}
        <pointLight color={color} intensity={7} distance={5} position={[0, 1.3, 1.2]} />
      </group>
    </RigidBody>
  );
}

function UndergroundChunk({ cx, cz }: { cx: number; cz: number }) {
  const centerX = cx * CHUNK_SIZE;
  const centerZ = cz * CHUNK_SIZE;
  const accent = hash2(cx, cz, 1) > 0.5 ? "#62ffd1" : "#9d62ff";
  const machines = useMemo(() => {
    const candidates = [
      [-10.4, -10.2],
      [10.4, -10.2],
      [-10.4, 10.2],
      [10.4, 10.2],
    ] as const;
    return candidates
      .filter((_, index) => hash2(cx, cz, 20 + index) > 0.3)
      .map(([x, z], index) => ({
        x: centerX + x + (hash2(cx, cz, 40 + index) - 0.5) * 1.8,
        z: centerZ + z + (hash2(cx, cz, 50 + index) - 0.5) * 1.8,
        rotation: Math.floor(hash2(cx, cz, 60 + index) * 4) * (Math.PI / 2),
      }));
  }, [centerX, centerZ, cx, cz]);

  return (
    <group>
      <mesh position={[centerX, -0.075, centerZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[CHUNK_SIZE + 0.18, CHUNK_SIZE + 0.18]} />
        <meshStandardMaterial
          color="#03060b"
          emissive="#07131a"
          emissiveIntensity={0.46}
          metalness={0.72}
          roughness={0.66}
        />
      </mesh>
      <gridHelper
        args={[CHUNK_SIZE, 15, accent, "#13202a"]}
        position={[centerX, -0.035, centerZ]}
      />

      <group position={[centerX, -0.018, centerZ]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
          <planeGeometry args={[SAFE_CORRIDOR_HALF_WIDTH * 2, CHUNK_SIZE]} />
          <meshBasicMaterial color="#0a1922" transparent opacity={0.72} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
          <planeGeometry args={[CHUNK_SIZE, SAFE_CORRIDOR_HALF_WIDTH * 2]} />
          <meshBasicMaterial color="#0a1922" transparent opacity={0.72} />
        </mesh>
        {[-SAFE_CORRIDOR_HALF_WIDTH, SAFE_CORRIDOR_HALF_WIDTH].map((offset) => (
          <group key={offset}>
            <mesh position={[offset, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
              <planeGeometry args={[0.08, CHUNK_SIZE]} />
              <meshBasicMaterial color={accent} transparent opacity={0.72} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.012, offset]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
              <planeGeometry args={[CHUNK_SIZE, 0.08]} />
              <meshBasicMaterial color={accent} transparent opacity={0.72} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>

      {[-8.3, 8.3].map((x, index) => (
        <mesh
          key={`trench:${index}`}
          position={[centerX + x, -0.025, centerZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={5}
        >
          <planeGeometry args={[1.7, CHUNK_SIZE - 0.5]} />
          <meshBasicMaterial
            color={index === 0 ? "#1f78ff" : "#8f3dff"}
            transparent
            opacity={0.18}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {machines.map((machine, index) => (
        <UndergroundMachine key={index} {...machine} color={accent} />
      ))}

      {[-1, 1].flatMap((xSign) =>
        [-1, 1].map((zSign) => (
          <group
            key={`${xSign}:${zSign}`}
            position={[centerX + xSign * 6.2, 1.8, centerZ + zSign * 6.2]}
          >
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.16, 0.16, 7.2, 12]} />
              <meshStandardMaterial
                color="#111b26"
                emissive={accent}
                emissiveIntensity={0.22}
                metalness={0.84}
                roughness={0.3}
              />
            </mesh>
            <pointLight color={accent} intensity={3.8} distance={7} />
          </group>
        ))
      )}
    </group>
  );
}

export default function UndergroundLevel() {
  const world = useArenaWorld();
  const [center, setCenter] = useState<[number, number]>([0, 0]);
  const centerRef = useRef(center);

  useFrame(() => {
    const cx = Math.round(world.playerPosition.x / CHUNK_SIZE);
    const cz = Math.round(world.playerPosition.z / CHUNK_SIZE);
    if (cx === centerRef.current[0] && cz === centerRef.current[1]) return;
    centerRef.current = [cx, cz];
    setCenter([cx, cz]);
  });

  const chunks: Array<[number, number]> = [];
  for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx += 1) {
    for (let dz = -CHUNK_RADIUS; dz <= CHUNK_RADIUS; dz += 1) {
      chunks.push([center[0] + dx, center[1] + dz]);
    }
  }
  return (
    <group>
      {chunks.map(([cx, cz]) => (
        <UndergroundChunk key={`${cx}:${cz}`} cx={cx} cz={cz} />
      ))}
    </group>
  );
}
