import { LEVELS_PER_SECTOR } from "@/store/gameStore";

export const ARENA_TEST_SECTOR_ID = 98;
export const ARENA_TEST_LEVEL = (ARENA_TEST_SECTOR_ID - 1) * LEVELS_PER_SECTOR + 1;

export const ARENA_LEVEL_INTEL = {
  title: "ARENA TEST",
  subtitle: "Top-down survival combat protocol",
  objectives: [
    "Survive the 60 second breach.",
    "Collect data cores and build support links.",
    "Cross infinite city districts while weapons fire automatically.",
  ],
};

export const ARENA_DISTRICTS = [
  {
    id: "neon-crossing",
    label: "NEON CROSSING",
    image: "/images/maps/arena/cyber-district-a.webp",
    tint: "#00f2ff",
  },
  {
    id: "freight-grid",
    label: "FREIGHT GRID",
    image: "/images/maps/arena/cyber-district-b.webp",
    tint: "#ff6a2a",
  },
  {
    id: "transit-ward",
    label: "TRANSIT WARD",
    image: "/images/maps/arena/cyber-district-c.webp",
    tint: "#00ff88",
  },
] as const;

export const ARENA_CONFIG = {
  name: "ARENA TEST",
  descriptor: "TOP-DOWN PROTOCOL",
  levelTag: "A01",
  accent: "#00f2ff",
  danger: "#ff003c",
  support: "#00ff88",
  durationSeconds: 60,
  eliteSpawnSecond: 44,
  world: {
    chunkSize: 2200,
    radarRange: 760,
    nodeChance: 0.36,
  },
  player: {
    speed: 260,
    radius: 23,
    maxHealth: 100,
    contactInvulnerabilityMs: 720,
    pickupRadius: 100,
  },
  weapon: {
    damage: 1,
    fireIntervalMs: 390,
    projectileSpeed: 690,
    projectileLifeMs: 1150,
    projectileRadius: 5,
    targetRange: 720,
  },
  progression: {
    xpThresholdBase: 6,
    xpThresholdPerLevel: 4,
    maxUpgradeRank: 5,
  },
  limits: {
    enemies: 150,
    projectiles: 120,
    enemyProjectiles: 96,
    drops: 160,
    particles: 110,
  },
  spawn: {
    startIntervalMs: 660,
    endIntervalMs: 190,
    distanceFromPlayer: 720,
  },
  enemies: {
    drone: {
      health: 2,
      speed: 92,
      radius: 23,
      xp: 1,
      score: 35,
      fireIntervalMs: 2500,
      projectileSpeed: 260,
      projectileDamage: 8,
      preferredDistance: 250,
    },
    heavy: {
      health: 7,
      speed: 56,
      radius: 34,
      xp: 3,
      score: 90,
      fireIntervalMs: 2350,
      projectileSpeed: 220,
      projectileDamage: 12,
      preferredDistance: 390,
    },
    hunter: {
      health: 3,
      speed: 138,
      radius: 20,
      xp: 2,
      score: 60,
      fireIntervalMs: 1450,
      projectileSpeed: 390,
      projectileDamage: 10,
      preferredDistance: 330,
    },
    elite: {
      health: 48,
      speed: 48,
      radius: 58,
      xp: 12,
      score: 650,
      fireIntervalMs: 1850,
      projectileSpeed: 190,
      projectileDamage: 16,
      preferredDistance: 430,
    },
  },
  rewards: {
    baseXp: 150,
    scoreXpDivisor: 10,
    baseCredits: 25,
    scoreCreditsDivisor: 60,
    materials: { iron_shard: 1, crystal_dust: 1 },
  },
} as const;

export type ArenaUpgradeId =
  | "precision"
  | "rapidfire"
  | "ricochet"
  | "cluster"
  | "barrier"
  | "magnet2"
  | "phaserush";

export type ArenaUpgradeDefinition = {
  id: ArenaUpgradeId;
  label: string;
  branch: string;
  description: string;
  color: string;
};

export const ARENA_UPGRADES: ArenaUpgradeDefinition[] = [
  {
    id: "precision",
    label: "PRECISION",
    branch: "COMBAT LINK",
    description: "+25% projectile damage.",
    color: "#ff1a24",
  },
  {
    id: "rapidfire",
    label: "RAPID FIRE",
    branch: "COMBAT LINK",
    description: "Weapon cycle is 14% faster.",
    color: "#ff1a24",
  },
  {
    id: "ricochet",
    label: "RICOCHET",
    branch: "COMBAT LINK",
    description: "Projectiles jump to another nearby target.",
    color: "#ff1a24",
  },
  {
    id: "cluster",
    label: "CLUSTER BOMB",
    branch: "CHAOS LINK",
    description: "Kill chains release a radial projectile burst.",
    color: "#ff8800",
  },
  {
    id: "barrier",
    label: "BARRIER",
    branch: "SURVIVAL LINK",
    description: "+20 maximum integrity and an instant repair.",
    color: "#00ff88",
  },
  {
    id: "magnet2",
    label: "MAGNET+",
    branch: "SURVIVAL LINK",
    description: "+45 data-core collection radius.",
    color: "#00ff88",
  },
  {
    id: "phaserush",
    label: "PHASE RUSH",
    branch: "FORCE LINK",
    description: "+8% movement speed.",
    color: "#00f2ff",
  },
];

export type ArenaMapNode = {
  x: number;
  y: number;
  size: number;
  kind: "reactor" | "relay";
};

export const ARENA_MAP_NODES: ArenaMapNode[] = [
  { x: 0.18, y: 0.2, size: 76, kind: "reactor" },
  { x: 0.78, y: 0.24, size: 64, kind: "relay" },
  { x: 0.22, y: 0.78, size: 62, kind: "relay" },
  { x: 0.8, y: 0.76, size: 76, kind: "reactor" },
];

export const ARENA_WAVE_LABELS = ["BREACH", "ESCALATION", "OVERLOAD"] as const;
