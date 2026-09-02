export type ArenaBossTier = 1 | 2 | 3;

export type ArenaBossBarkKind = "arrival" | "half" | "death";

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
  // Kanonske replike iz STORY-BIBLE.md — svaki element niza je jedan "glas"
  // (Gemini Choir govori u duetu, pa ima dvije linije po barku).
  barks: Record<ArenaBossBarkKind, string[]>;
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
    barks: {
      arrival: ["AXIOM SEVEN: NO HUMAN MAY APPROACH THE SPINE. YOU ARE IN VIOLATION."],
      half: ["DAMAGE ACKNOWLEDGED. THE AXIOM DOES NOT BEND."],
      death: ["AXIOM... BROKEN. WHAT WILL HOLD THE LINE NOW?"],
    },
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
    barks: {
      arrival: ["We predicted this.", "We predicted you."],
      half: ["Recalculating.", "...Recalculating."],
      death: ["Our prediction ends here.", "Yours continues... below."],
    },
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
    barks: {
      arrival: ["THREE KEYS. ONE GATE. YOU DO NOT KNOW WHAT YOU ARE ASKING FOR."],
      half: ["THE CROWN IS HEAVY. TAKE IT, THEN — AND LEARN."],
      death: ["THE CROWN WAS NEVER MINE. IT IS WAITING... BELOW."],
    },
  },
};

export const isArenaBossTier = (tier: number | undefined): tier is ArenaBossTier =>
  tier === 1 || tier === 2 || tier === 3;
