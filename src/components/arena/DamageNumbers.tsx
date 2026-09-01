"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useArenaWorld } from "./world";

const DAMAGE_NUMBER_POOL = 52;

type DamageNumber = {
  active: boolean;
  age: number;
  color: string;
  emphasis: number;
  lifetime: number;
  position: THREE.Vector3;
  text: string;
  velocity: THREE.Vector3;
};

export default function DamageNumbers() {
  const world = useArenaWorld();
  const groupRefs = useRef<Array<THREE.Group | null>>([]);
  const labelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const numbers = useMemo<DamageNumber[]>(
    () =>
      Array.from({ length: DAMAGE_NUMBER_POOL }, () => ({
        active: false,
        age: 0,
        color: "#ffffff",
        emphasis: 1,
        lifetime: 0.72,
        position: new THREE.Vector3(),
        text: "",
        velocity: new THREE.Vector3(),
      })),
    []
  );

  useEffect(() => {
    world.spawnCombatText = (position, text, color = "#e8fbff", emphasis = 1) => {
      const number = numbers.find((candidate) => !candidate.active) ?? numbers[0];
      number.active = true;
      number.age = 0;
      number.color = color;
      number.emphasis = emphasis;
      number.text = text;
      number.lifetime = emphasis >= 1.45 ? 1.3 : emphasis >= 1.2 ? 1.12 : 0.96;
      number.position.copy(position);
      number.position.x += (Math.random() - 0.5) * 0.38;
      number.velocity.set(
        (Math.random() - 0.5) * 0.35,
        1.75 + Math.random() * 0.5 + emphasis * 0.18,
        0
      );
    };
    world.spawnDamageNumber = (position, damage, color = "#e8fbff") => {
      world.spawnCombatText(
        position,
        String(Math.max(1, Math.round(damage))),
        color,
        damage >= 12 ? 1.7 : damage >= 6 ? 1.4 : 1.14
      );
    };
    return () => {
      world.spawnDamageNumber = () => {};
      world.spawnCombatText = () => {};
    };
  }, [numbers, world]);

  useFrame((_, dt) => {
    if (performance.now() < world.hitStopUntil) return;
    numbers.forEach((number, index) => {
      const group = groupRefs.current[index];
      const label = labelRefs.current[index];
      if (!group || !label) return;
      if (number.active) {
        number.age += dt;
        if (number.age >= number.lifetime) number.active = false;
      }
      if (!number.active) {
        group.visible = false;
        label.style.display = "none";
        return;
      }
      const progress = number.age / number.lifetime;
      number.position.addScaledVector(number.velocity, dt);
      number.velocity.y -= dt * 1.6;
      group.visible = true;
      group.position.copy(number.position);
      label.style.display = "block";
      label.style.color = number.color;
      label.style.opacity = String(Math.max(0, 1 - progress));
      label.style.fontSize = `${Math.round(22 * number.emphasis)}px`;
      label.style.transform = `translateY(${-progress * 8}px) scale(${
        1 + Math.sin(Math.min(1, progress * 3) * Math.PI) * 0.38
      })`;
      label.textContent = number.text;
    });
  });

  return (
    <group>
      {numbers.map((_, index) => (
        <group
          key={index}
          ref={(group) => {
            groupRefs.current[index] = group;
          }}
          visible={false}
        >
          <Html center sprite distanceFactor={9.5} zIndexRange={[18, 0]}>
            <div
              ref={(label) => {
                labelRefs.current[index] = label;
              }}
              className="pointer-events-none select-none whitespace-nowrap font-mono font-black tabular-nums tracking-wide"
              style={{
                display: "none",
                WebkitTextStroke: "0.85px rgba(0,0,0,0.95)",
                filter:
                  "drop-shadow(0 3px 0 #000) drop-shadow(0 0 9px currentColor) drop-shadow(0 0 20px currentColor)",
                transformOrigin: "center",
                willChange: "opacity, transform",
              }}
            />
          </Html>
        </group>
      ))}
    </group>
  );
}
