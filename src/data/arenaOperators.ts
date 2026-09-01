import RAW_ARENA_OPERATORS from "@/data/arena-operators.json";
import type { HeroArchetype } from "@/data/heroes";

export type ArenaOperatorStats = Partial<{
  damageMult: number;
  fireIntervalMult: number;
  maxHealthAdd: number;
  multishot: number;
  pickupRadiusAdd: number;
  pierces: number;
  speedMult: number;
  spreadRadians: number;
}>;

export type ArenaOperatorDefinition = {
  className: string;
  weaponName: string;
  description: string;
  unlockRun: number;
  stats: ArenaOperatorStats;
  weapon: {
    projectileSpeedMult: number;
    projectileScale: number;
  };
};

export const ARENA_OPERATORS = RAW_ARENA_OPERATORS as Record<
  HeroArchetype,
  ArenaOperatorDefinition
>;
