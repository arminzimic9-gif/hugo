export type ArenaBossTier = 1 | 2 | 3;

export type ArenaBossDefinition = {
  tier: ArenaBossTier;
  id: "axiom_warden" | "gemini_choir" | "hollow_crown";
  enemyKind: "boss_axiom" | "boss_gemini" | "boss_crown";
  label: string;
  subtitle: string;
  accent: string;
  ability: string;
  abilityDescription: string;
  counterplay: string;
  reward: string;
  specialCooldownMs: number;
  telegraphMs: number;
};

export const ARENA_BOSSES: Record<ArenaBossTier, ArenaBossDefinition> = {
  1: {
    tier: 1,
    id: "axiom_warden",
    enemyKind: "boss_axiom",
    label: "AXIOM WARDEN",
    subtitle: "Municipal Siege Guardian",
    accent: "#42efff",
    ability: "SIEGE FAN",
    abilityDescription: "Telegraphs a five-shell cone aimed at the pilot every 6.4 seconds.",
    counterplay: "Cross the Warden's firing axis during the cyan charge; do not retreat in a straight line.",
    reward: "Artifact Spark · awakens Tier I traits",
    specialCooldownMs: 6400,
    telegraphMs: 760,
  },
  2: {
    tier: 2,
    id: "gemini_choir",
    enemyKind: "boss_gemini",
    label: "GEMINI CHOIR",
    subtitle: "Synchronized Prediction Pair",
    accent: "#c06bff",
    ability: "PREDICTION CROSS",
    abilityDescription: "Both bodies fire converging ion lanes every 5.2 seconds.",
    counterplay: "Separate the twins, then cut across one fan before the second prediction closes.",
    reward: "Class Augment · opens Tier II specialization",
    specialCooldownMs: 5200,
    telegraphMs: 620,
  },
  3: {
    tier: 3,
    id: "hollow_crown",
    enemyKind: "boss_crown",
    label: "THE HOLLOW CROWN",
    subtitle: "Three Execution Shards",
    accent: "#ffbd42",
    ability: "CROWN EXECUTION",
    abilityDescription: "Each shard releases offset singularity wheels every 4.8 seconds.",
    counterplay: "Move toward the gap between rotating volleys and eliminate one shard to open the pattern.",
    reward: "Mythic Core · capstone and Underground gate",
    specialCooldownMs: 4800,
    telegraphMs: 700,
  },
};

export const isArenaBossTier = (tier: number | undefined): tier is ArenaBossTier =>
  tier === 1 || tier === 2 || tier === 3;
