export type ArenaPowerDropId =
  | "cycle_surge"
  | "aegis_charge"
  | "chrono_field"
  | "repair_nanites"
  | "artifact_residue";

export type ArenaPowerDropDefinition = {
  id: ArenaPowerDropId;
  label: string;
  shortLabel: string;
  description: string;
  why: string;
  color: string;
  durationMs: number;
  effect: Partial<{
    fireRateMult: number;
    shield: boolean;
    enemySlowFactor: number;
    heal: number;
    artifactPower: number;
  }>;
};

export const ARENA_POWER_DROPS: Record<ArenaPowerDropId, ArenaPowerDropDefinition> = {
  cycle_surge: {
    id: "cycle_surge",
    label: "CYCLE SURGE",
    shortLabel: "SURGE",
    description: "Weapon cycle runs 80% faster for 8 seconds.",
    why: "A short offensive window for deleting a dangerous pack or boss phase.",
    color: "#ff5c45",
    durationMs: 8000,
    effect: { fireRateMult: 1.8 },
  },
  aegis_charge: {
    id: "aegis_charge",
    label: "AEGIS CHARGE",
    shortLabel: "AEGIS",
    description: "Blocks all incoming damage for 6 seconds.",
    why: "Creates a readable survival window without permanently inflating health.",
    color: "#42d9ff",
    durationMs: 6000,
    effect: { shield: true },
  },
  chrono_field: {
    id: "chrono_field",
    label: "CHRONO FIELD",
    shortLabel: "CHRONO",
    description: "Enemies move at 55% speed for 7 seconds.",
    why: "Lets the player reset spacing and prepare class resources.",
    color: "#a66bff",
    durationMs: 7000,
    effect: { enemySlowFactor: 0.55 },
  },
  repair_nanites: {
    id: "repair_nanites",
    label: "REPAIR NANITES",
    shortLabel: "REPAIR",
    description: "Restores 35 integrity immediately.",
    why: "A distinct emergency drop; unlike health cores it is rarer and stronger.",
    color: "#4dff9c",
    durationMs: 0,
    effect: { heal: 35 },
  },
  artifact_residue: {
    id: "artifact_residue",
    label: "ARTIFACT RESIDUE",
    shortLabel: "ARTIFACT +30",
    description: "Adds 30 permanent Artifact Power to the active class weapon.",
    why: "Connects repeatable Arena and Underground runs to long-term weapon growth.",
    color: "#ffd15c",
    durationMs: 0,
    effect: { artifactPower: 30 },
  },
};

export const ARENA_POWER_DROP_IDS = Object.keys(ARENA_POWER_DROPS) as ArenaPowerDropId[];

export function rollArenaPowerDrop(randomValue = Math.random()): ArenaPowerDropId {
  const value = Math.max(0, Math.min(0.9999, randomValue));
  if (value < 0.28) return "cycle_surge";
  if (value < 0.5) return "aegis_charge";
  if (value < 0.68) return "chrono_field";
  if (value < 0.84) return "repair_nanites";
  return "artifact_residue";
}
