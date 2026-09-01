import RAW_ARENA_GEAR_CATALOG from "@/data/arena-gear-catalog.json";
import type { CraftingRecipeId } from "@/data/crafting";

export const ARENA_GEAR_SLOTS = ["head", "torso", "arms", "legs", "core", "weapon"] as const;

export type ArenaGearSlot = (typeof ARENA_GEAR_SLOTS)[number];
export type ArenaGearRarity = "common" | "rare" | "epic" | "legendary";

export type ArenaGearDefinition = {
  slot: ArenaGearSlot;
  rarity: ArenaGearRarity;
};

export const ARENA_GEAR_CATALOG = RAW_ARENA_GEAR_CATALOG as Record<
  CraftingRecipeId,
  ArenaGearDefinition
>;

export const ARENA_GEAR_RARITIES: Record<
  ArenaGearRarity,
  { label: string; color: string; power: number; rank: number }
> = {
  common: { label: "COMMON", color: "#aeb8c5", power: 1, rank: 1 },
  rare: { label: "RARE", color: "#38c7ff", power: 1.25, rank: 2 },
  epic: { label: "EPIC", color: "#b476ff", power: 1.55, rank: 3 },
  legendary: { label: "LEGENDARY", color: "#ffbd42", power: 1.9, rank: 4 },
};

export const isArenaGearSlot = (value: unknown): value is ArenaGearSlot =>
  typeof value === "string" && ARENA_GEAR_SLOTS.includes(value as ArenaGearSlot);

export const getArenaGearPower = (id: CraftingRecipeId): number =>
  ARENA_GEAR_RARITIES[ARENA_GEAR_CATALOG[id].rarity].power;
