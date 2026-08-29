import { create } from "zustand";
import ARENA_CONFIG from "@/data/arena-config.json";
import ARENA_UPGRADES from "@/data/arena-upgrades.json";

export type ArenaPhase = "briefing" | "running" | "upgrade" | "victory" | "defeat";

export type ArenaMods = {
  damageMult: number;
  fireIntervalMult: number;
  bounces: number;
  bounceRange: number;
  clusterEveryKills: number;
  clusterProjectiles: number;
  maxHealthAdd: number;
  pickupRadiusAdd: number;
  speedMult: number;
};

const BASE_MODS: ArenaMods = {
  damageMult: 1,
  fireIntervalMult: 1,
  bounces: 0,
  bounceRange: 0,
  clusterEveryKills: 0,
  clusterProjectiles: 0,
  maxHealthAdd: 0,
  pickupRadiusAdd: 0,
  speedMult: 1,
};

export function computeMods(ranks: Record<string, number>): ArenaMods {
  const mods = { ...BASE_MODS };
  for (const upgrade of ARENA_UPGRADES) {
    const rank = ranks[upgrade.id] ?? 0;
    if (rank <= 0) continue;
    const fx = upgrade.effects as Partial<Record<string, number>>;
    if (fx.damageMult) mods.damageMult *= Math.pow(fx.damageMult, rank);
    if (fx.fireIntervalMult) mods.fireIntervalMult *= Math.pow(fx.fireIntervalMult, rank);
    if (fx.bouncesAdd) mods.bounces += fx.bouncesAdd * rank;
    if (fx.bounceRange) mods.bounceRange = Math.max(mods.bounceRange, fx.bounceRange);
    if (fx.clusterEveryKills) mods.clusterEveryKills = fx.clusterEveryKills;
    if (fx.clusterProjectiles) mods.clusterProjectiles = fx.clusterProjectiles * rank;
    if (fx.maxHealthAdd) mods.maxHealthAdd += fx.maxHealthAdd * rank;
    if (fx.pickupRadiusAdd) mods.pickupRadiusAdd += fx.pickupRadiusAdd * rank;
    if (fx.speedMult) mods.speedMult *= Math.pow(fx.speedMult, rank);
  }
  return mods;
}

function xpThreshold(level: number): number {
  return (
    ARENA_CONFIG.progression.xpThresholdBase +
    ARENA_CONFIG.progression.xpThresholdPerLevel * (level - 1)
  );
}

function rollUpgradeOptions(ranks: Record<string, number>): string[] {
  const eligible = ARENA_UPGRADES.filter(
    (u) => (ranks[u.id] ?? 0) < ARENA_CONFIG.progression.maxUpgradeRank
  ).map((u) => u.id);
  const picked: string[] = [];
  while (picked.length < ARENA_CONFIG.progression.upgradeChoices && eligible.length > 0) {
    const index = Math.floor(Math.random() * eligible.length);
    picked.push(eligible.splice(index, 1)[0]);
  }
  return picked;
}

export interface ArenaSessionState {
  phase: ArenaPhase;
  timeLeft: number;
  score: number;
  kills: number;
  health: number;
  maxHealth: number;
  xp: number;
  xpLevel: number;
  xpNeeded: number;
  upgradeRanks: Record<string, number>;
  upgradeOptions: string[];
  mods: ArenaMods;
  lastDamageAt: number;
  rewardsGranted: boolean;

  reset: () => void;
  start: () => void;
  tick: (dt: number) => void;
  addScore: (points: number) => void;
  addKill: () => void;
  damagePlayer: (amount: number) => void;
  addArenaXp: (amount: number) => void;
  chooseUpgrade: (id: string) => void;
  markRewardsGranted: () => void;
}

const initialSession = () => ({
  phase: "briefing" as ArenaPhase,
  timeLeft: ARENA_CONFIG.meta.durationSeconds,
  score: 0,
  kills: 0,
  health: ARENA_CONFIG.player.maxHealth,
  maxHealth: ARENA_CONFIG.player.maxHealth,
  xp: 0,
  xpLevel: 1,
  xpNeeded: xpThreshold(1),
  upgradeRanks: {} as Record<string, number>,
  upgradeOptions: [] as string[],
  mods: { ...BASE_MODS },
  lastDamageAt: 0,
  rewardsGranted: false,
});

export const useArenaSession = create<ArenaSessionState>()((set, get) => ({
  ...initialSession(),

  reset: () => set(initialSession()),

  start: () => set({ phase: "running" }),

  tick: (dt) => {
    const state = get();
    if (state.phase !== "running") return;
    const timeLeft = Math.max(0, state.timeLeft - dt);
    if (timeLeft <= 0) {
      set({ timeLeft: 0, phase: "victory" });
    } else {
      set({ timeLeft });
    }
  },

  addScore: (points) => set((s) => ({ score: s.score + points })),

  addKill: () => set((s) => ({ kills: s.kills + 1 })),

  damagePlayer: (amount) => {
    const state = get();
    if (state.phase !== "running") return;
    const now = performance.now();
    if (now - state.lastDamageAt < ARENA_CONFIG.player.contactInvulnerabilityMs) return;
    const health = Math.max(0, state.health - amount);
    set({ health, lastDamageAt: now, phase: health <= 0 ? "defeat" : state.phase });
  },

  addArenaXp: (amount) => {
    const state = get();
    if (state.phase !== "running") return;
    let xp = state.xp + amount;
    if (xp >= state.xpNeeded) {
      xp -= state.xpNeeded;
      const xpLevel = state.xpLevel + 1;
      const options = rollUpgradeOptions(state.upgradeRanks);
      set({
        xp,
        xpLevel,
        xpNeeded: xpThreshold(xpLevel),
        upgradeOptions: options,
        phase: options.length > 0 ? "upgrade" : "running",
      });
    } else {
      set({ xp });
    }
  },

  chooseUpgrade: (id) => {
    const state = get();
    const ranks = { ...state.upgradeRanks, [id]: (state.upgradeRanks[id] ?? 0) + 1 };
    const mods = computeMods(ranks);
    const maxHealth = ARENA_CONFIG.player.maxHealth + mods.maxHealthAdd;
    const gainedMaxHealth = maxHealth - state.maxHealth;
    const healAdd =
      id === "barrier"
        ? ((ARENA_UPGRADES.find((u) => u.id === "barrier")?.effects as Partial<Record<string, number>>)
            ?.healAdd ?? 0)
        : 0;
    set({
      upgradeRanks: ranks,
      mods,
      maxHealth,
      health: Math.min(maxHealth, state.health + gainedMaxHealth + healAdd),
      upgradeOptions: [],
      phase: "running",
    });
  },

  markRewardsGranted: () => set({ rewardsGranted: true }),
}));

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as unknown as Record<string, unknown>).__arenaSession = useArenaSession;
}
