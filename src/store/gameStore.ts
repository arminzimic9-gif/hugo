import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CRAFTING_RECIPES_BY_ID,
  createEmptyMaterialInventory,
  type CraftingRecipeId,
  type MaterialId,
  type MaterialInventory,
} from '@/data/crafting';
import {
  ARENA_GEAR_CATALOG,
  ARENA_GEAR_RARITIES,
  ARENA_GEAR_SLOTS,
  type ArenaGearSlot,
} from '@/data/arenaGear';
import { ARENA_META_UNLOCKS } from '@/data/arenaMeta';
import { isArenaPilotBody, type ArenaPilotBody } from '@/data/arenaPilots';
import {
  ARTIFACT_WEAPONS,
  createArtifactWeaponStates,
  getArtifactPowerThreshold,
  type ArtifactWeaponState,
  type ArtifactWeaponStates,
} from '@/data/arenaProgression';

export interface HeroProfile {
  codename: string;
  archetype: "vanguard" | "spectre" | "vector";
  accent: string;
}

export type ArenaGearLoadout = Record<ArenaGearSlot, CraftingRecipeId | null>;
export type ArenaGearLoadouts = Record<HeroProfile["archetype"], ArenaGearLoadout>;

export interface PlayerStats {
  level: number;
  xp: number;
  credits: number;
  skillPoints: number;
  skills: string[];
  unlockedSectors: number[];
  maxLevelReached: number;
  completedLevels: number[]; // all individually completed level numbers
  ownedCursors: number[];
  activeCursorId: number;
  achievements: string[];
  materials: MaterialInventory;
  craftedGear: CraftingRecipeId[];
  arenaLoadouts: ArenaGearLoadouts;
  arenaRunsCompleted: number;
  arenaUnlocks: string[];
  unlockedOperators: Array<"vanguard" | "spectre" | "vector">;
  unlockedArenaUpgrades: string[];
  bossArtifacts: string[];
  artifactWeapons: ArtifactWeaponStates;
  storyBossesCleared: number[];
  endgameUnlocked: boolean;
  operativeCycles: number;
}

// Sector structure: each sector has 11 levels (10 regular + 1 boss at level 11)
// Sector 1 = levels 1-11, Sector 2 = levels 12-22, etc.
export const LEVELS_PER_SECTOR = 11; // 10 regular + 1 boss

export function getSectorForLevel(level: number): number {
  return Math.ceil(level / LEVELS_PER_SECTOR);
}

export function getLevelInSector(level: number): number {
  return ((level - 1) % LEVELS_PER_SECTOR) + 1;
}

export function getLevelType(level: number): 'ninja' | 'static' | 'bonus' | 'boss' | 'gd' | 'chess' | 'snail' | 'chaos_bonus' {
  const sector = getSectorForLevel(level);
  if (sector === 99) return getLevelInSector(level) % 2 === 0 ? 'snail' : 'gd';
  if (sector === 100) return 'boss';
  const inSector = getLevelInSector(level);
  if (inSector === 11) return 'boss';
  if (inSector === 1 && sector > 1) return 'chaos_bonus';
  if (inSector % 3 === 0) return 'gd';
  if (inSector === 5) return 'chess';
  if (inSector === 7 || inSector === 10) return 'snail';
  if (inSector % 2 === 0) return 'static';
  return 'ninja';
}

export interface GameState {
  // Player Data
  username: string | null;
  pilotBody: ArenaPilotBody;
  stats: PlayerStats;
  hero: HeroProfile;
  
  // Persistent campaign progress
  currentCampaignLevel: number; // Global level 1-55+
  currentSector: number;
  
  // Non-persistent session
  score: number;
  combo: number;
  isFeverActive: boolean;
  
  // Actions
  login: (username: string) => void;
  setPilotBody: (body: ArenaPilotBody) => void;
  logout: () => void;
  addXp: (amount: number) => void;
  addCredits: (amount: number) => void;
  addMaterials: (drops: Partial<Record<MaterialId, number>>) => void;
  craftRecipe: (recipeId: CraftingRecipeId) => boolean;
  equipArenaGear: (
    operator: HeroProfile["archetype"],
    slot: ArenaGearSlot,
    gearId: CraftingRecipeId | null
  ) => boolean;
  unlockSkill: (skillId: string, cost: number) => boolean;
  purchaseQuickSkill: (skillId: string, creditCost: number) => boolean;
  unlockAchievement: (achievementId: string) => boolean;
  completeLevel: (levelCompleted: number) => void;
  setReplayLevel: (level: number) => void;
  setHeroProfile: (hero: HeroProfile) => void;
  completeArenaRun: () => string[];
  addBossArtifact: (artifactId: string) => boolean;
  claimArtifactMilestone: (tier: 1 | 2 | 3) => boolean;
  addArtifactPower: (amount: number, operator?: HeroProfile["archetype"]) => number;
  upgradeArtifactTrait: (traitId: string) => boolean;
  startOperativeCycle: (operator: HeroProfile["archetype"]) => boolean;
  
  // Session Actions
  setSector: (sectorId: number) => void;
  addScore: (points: number) => void;
  updateCombo: (combo: number) => void;
  resetSession: () => void;
  
  // Customization
  buyCursor: (cursorId: number, cost: number) => boolean;
  setActiveCursor: (cursorId: number) => void;
}

const XP_PER_LEVEL = 1000;
const ARENA_OPERATORS: HeroProfile["archetype"][] = ["vanguard", "spectre", "vector"];

const createEmptyArenaGearLoadout = (): ArenaGearLoadout => ({
  head: null,
  torso: null,
  arms: null,
  legs: null,
  core: null,
  weapon: null,
});

const createEmptyArenaGearLoadouts = (): ArenaGearLoadouts => ({
  vanguard: createEmptyArenaGearLoadout(),
  spectre: createEmptyArenaGearLoadout(),
  vector: createEmptyArenaGearLoadout(),
});

const BASE_PLAYER_STATS: PlayerStats = {
  level: 1,
  xp: 0,
  credits: 0,
  skillPoints: 3,
  skills: [],
  unlockedSectors: [1],
  maxLevelReached: 1,
  completedLevels: [],
  ownedCursors: [1],
  activeCursorId: 1,
  achievements: [],
  materials: createEmptyMaterialInventory(),
  craftedGear: [],
  arenaLoadouts: createEmptyArenaGearLoadouts(),
  arenaRunsCompleted: 0,
  arenaUnlocks: [],
  unlockedOperators: ["vanguard"],
  unlockedArenaUpgrades: ["precision", "rapidfire", "barrier", "magnet2"],
  bossArtifacts: [],
  artifactWeapons: createArtifactWeaponStates(),
  storyBossesCleared: [],
  endgameUnlocked: false,
  operativeCycles: 0,
};

const isCraftingRecipeId = (value: unknown): value is CraftingRecipeId =>
  typeof value === "string" && value in CRAFTING_RECIPES_BY_ID;

const getBestCraftedGear = (
  craftedGear: CraftingRecipeId[],
  slot: ArenaGearSlot
): CraftingRecipeId | null => {
  let best: CraftingRecipeId | null = null;
  for (const id of craftedGear) {
    const definition = ARENA_GEAR_CATALOG[id];
    if (!definition || definition.slot !== slot) continue;
    if (
      best === null ||
      ARENA_GEAR_RARITIES[definition.rarity].rank >
        ARENA_GEAR_RARITIES[ARENA_GEAR_CATALOG[best].rarity].rank
    ) {
      best = id;
    }
  }
  return best;
};

const normalizeArenaLoadouts = (
  loadouts: Partial<Record<HeroProfile["archetype"], Partial<ArenaGearLoadout>>> | undefined,
  craftedGear: CraftingRecipeId[]
): ArenaGearLoadouts => {
  const out = createEmptyArenaGearLoadouts();
  const isLegacySave = loadouts === undefined;
  for (const operator of ARENA_OPERATORS) {
    const rawLoadout = loadouts?.[operator] as Record<string, unknown> | undefined;
    for (const slot of ARENA_GEAR_SLOTS) {
      const savedId = loadouts?.[operator]?.[slot];
      if (
        isCraftingRecipeId(savedId) &&
        craftedGear.includes(savedId) &&
        ARENA_GEAR_CATALOG[savedId].slot === slot
      ) {
        out[operator][slot] = savedId;
      } else if (isLegacySave) {
        // Stari saveovi su ranije aktivirali sav crafted gear; migracija im
        // zadrzava najbolji legalni item u svakom od nova tri slota.
        out[operator][slot] = getBestCraftedGear(craftedGear, slot);
      }
    }
    // 3-slot arena save migration: retain every valid crafted item from the old
    // weapon/frame/module layout and place it in its new physical suit slot.
    for (const legacySlot of ["weapon", "frame", "module"]) {
      const legacyId = rawLoadout?.[legacySlot];
      if (!isCraftingRecipeId(legacyId) || !craftedGear.includes(legacyId)) continue;
      const physicalSlot = ARENA_GEAR_CATALOG[legacyId].slot;
      if (!out[operator][physicalSlot]) out[operator][physicalSlot] = legacyId;
    }
  }
  return out;
};

const normalizeMaterials = (materials?: Partial<MaterialInventory>): MaterialInventory => {
  const out = createEmptyMaterialInventory();
  if (!materials) return out;
  (Object.keys(out) as MaterialId[]).forEach((id) => {
    out[id] = Math.max(0, Math.floor(materials[id] ?? 0));
  });
  return out;
};

const normalizeArtifactWeapon = (value: Partial<ArtifactWeaponState> | undefined): ArtifactWeaponState => ({
  tier: [0, 1, 2, 3].includes(value?.tier ?? -1)
    ? (value?.tier as ArtifactWeaponState["tier"])
    : 0,
  power: Math.max(0, Math.floor(value?.power ?? 0)),
  points: Math.max(0, Math.floor(value?.points ?? 0)),
  traits:
    value?.traits && typeof value.traits === "object"
      ? Object.fromEntries(
          Object.entries(value.traits).map(([id, rank]) => [id, Math.max(0, Math.floor(rank ?? 0))])
        )
      : {},
});

const normalizeArtifactWeapons = (
  value: Partial<ArtifactWeaponStates> | undefined
): ArtifactWeaponStates => {
  const empty = createArtifactWeaponStates();
  return {
    vanguard: normalizeArtifactWeapon(value?.vanguard ?? empty.vanguard),
    spectre: normalizeArtifactWeapon(value?.spectre ?? empty.spectre),
    vector: normalizeArtifactWeapon(value?.vector ?? empty.vector),
  };
};

const normalizeStats = (stats?: Partial<PlayerStats>): PlayerStats => {
  const craftedGear = Array.isArray(stats?.craftedGear)
    ? stats.craftedGear.filter(isCraftingRecipeId)
    : [];
  return {
  level: Math.max(1, Math.floor(stats?.level ?? BASE_PLAYER_STATS.level)),
  xp: Math.max(0, Math.floor(stats?.xp ?? BASE_PLAYER_STATS.xp)),
  credits: Math.max(0, Math.floor(stats?.credits ?? BASE_PLAYER_STATS.credits)),
  skillPoints: Math.max(
    0,
    Math.floor(stats?.skillPoints ?? Math.max(3, 3 + Math.floor(((stats?.level ?? 1) - 1) / 2)))
  ),
  skills: Array.isArray(stats?.skills) ? stats.skills : [],
  unlockedSectors:
    Array.isArray(stats?.unlockedSectors) && stats.unlockedSectors.length > 0
      ? stats.unlockedSectors
      : [1],
  maxLevelReached: Math.max(1, Math.floor(stats?.maxLevelReached ?? BASE_PLAYER_STATS.maxLevelReached)),
  completedLevels: Array.isArray(stats?.completedLevels) ? stats.completedLevels : [],
  ownedCursors: Array.isArray(stats?.ownedCursors) && stats.ownedCursors.length > 0 ? stats.ownedCursors : [1],
  activeCursorId: Math.max(1, Math.floor(stats?.activeCursorId ?? 1)),
  achievements: Array.isArray(stats?.achievements) ? stats.achievements : [],
  materials: normalizeMaterials(stats?.materials),
  craftedGear,
  arenaLoadouts: normalizeArenaLoadouts(stats?.arenaLoadouts, craftedGear),
  arenaRunsCompleted: Math.max(0, Math.floor(stats?.arenaRunsCompleted ?? 0)),
  arenaUnlocks: Array.isArray(stats?.arenaUnlocks) ? stats.arenaUnlocks : [],
  // Stari saveovi su već imali pristup svemu; migracija im ništa ne zaključava.
  unlockedOperators: Array.isArray(stats?.unlockedOperators)
    ? stats.unlockedOperators
    : ["vanguard", "spectre", "vector"],
  unlockedArenaUpgrades: Array.isArray(stats?.unlockedArenaUpgrades)
    ? stats.unlockedArenaUpgrades
    : ["precision", "rapidfire", "ricochet", "cluster", "barrier", "magnet2", "phaserush"],
  bossArtifacts: Array.isArray(stats?.bossArtifacts) ? stats.bossArtifacts : [],
  artifactWeapons: normalizeArtifactWeapons(stats?.artifactWeapons),
  storyBossesCleared: Array.isArray(stats?.storyBossesCleared)
    ? stats.storyBossesCleared.filter((tier) => tier === 1 || tier === 2 || tier === 3)
    : [],
  endgameUnlocked: Boolean(stats?.endgameUnlocked),
  operativeCycles: Math.max(0, Math.floor(stats?.operativeCycles ?? 0)),
  };
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      username: null,
      pilotBody: "male",
      stats: normalizeStats(BASE_PLAYER_STATS),
      hero: {
        codename: "NEON",
        archetype: "vanguard",
        accent: "#00f2ff",
      },
      currentCampaignLevel: 1,
      currentSector: 1,
      score: 0,
      combo: 0,
      isFeverActive: false,

      login: (username) => set({ username }),
      setPilotBody: (pilotBody) => {
        if (isArenaPilotBody(pilotBody)) set({ pilotBody });
      },
      logout: () => set({ username: null, currentCampaignLevel: 1, currentSector: 1 }),
      
      completeLevel: (levelCompleted: number) => set((state) => {
        const completed = [...new Set([...(state.stats.completedLevels ?? []), levelCompleted])];

        // Sector 99 is arcade/bonus content. It should save clears, but it must
        // not inflate campaign maxLevelReached and accidentally unlock campaign.
        if (getSectorForLevel(levelCompleted) === 99) {
          const firstBonusLevel = (99 - 1) * LEVELS_PER_SECTOR + 1;
          const lastBonusLevel = firstBonusLevel + LEVELS_PER_SECTOR - 1;
          const nextBonusLevel = levelCompleted >= lastBonusLevel ? firstBonusLevel : levelCompleted + 1;
          return {
            currentCampaignLevel: nextBonusLevel,
            currentSector: 99,
            stats: { ...state.stats, completedLevels: completed }
          };
        }

        const nextLevel = levelCompleted + 1;
        const nextSector = getSectorForLevel(nextLevel);
        const maxLevel = Math.max(state.stats.maxLevelReached ?? 1, nextLevel);
        
        const unlockedSectors = [...(state.stats.unlockedSectors ?? [1])];
        // Unlock the next sector when the boss of this sector is beaten
        if (getLevelInSector(levelCompleted) === 11 && !unlockedSectors.includes(nextSector)) {
          unlockedSectors.push(nextSector);
        }
        
        return {
          currentCampaignLevel: nextLevel,
          currentSector: nextSector,
          stats: { ...state.stats, maxLevelReached: maxLevel, unlockedSectors, completedLevels: completed }
        };
      }),

      setReplayLevel: (level: number) => set({ currentCampaignLevel: level }),
      
      addXp: (amount) => set((state) => {
        let newXp = state.stats.xp + amount;
        let newLevel = state.stats.level;
        let levelsGained = 0;
        
        while (newXp >= XP_PER_LEVEL * newLevel) {
          newXp -= XP_PER_LEVEL * newLevel;
          newLevel++;
          levelsGained++;
        }
        
        return {
          stats: {
            ...state.stats,
            xp: newXp,
            level: newLevel,
            skillPoints: state.stats.skillPoints + levelsGained,
          },
        };
      }),
      
      addCredits: (amount) => set((state) => ({
        stats: { ...state.stats, credits: state.stats.credits + amount }
      })),

      addMaterials: (drops) =>
        set((state) => {
          const nextMaterials = { ...normalizeMaterials(state.stats.materials) };
          (Object.entries(drops) as [MaterialId, number | undefined][]).forEach(([id, amount]) => {
            const gain = Math.max(0, Math.floor(amount ?? 0));
            if (!gain) return;
            nextMaterials[id] = (nextMaterials[id] ?? 0) + gain;
          });
          return {
            stats: { ...state.stats, materials: nextMaterials },
          };
        }),

      craftRecipe: (recipeId) => {
        const state = get();
        const recipe = CRAFTING_RECIPES_BY_ID[recipeId];
        if (!recipe) return false;
        if ((state.stats.craftedGear ?? []).includes(recipeId)) return false;
        if (state.stats.level < recipe.unlockLevel) return false;
        if (recipe.prerequisite && !state.stats.craftedGear.includes(recipe.prerequisite)) return false;
        const materials = normalizeMaterials(state.stats.materials);
        const hasAll = recipe.required.every(
          (id) => (materials[id] ?? 0) >= (recipe.amounts[id] ?? 1)
        );
        if (!hasAll) return false;
        set((s) => {
          const nextMaterials = normalizeMaterials(s.stats.materials);
          recipe.required.forEach((id) => {
            nextMaterials[id] = Math.max(0, nextMaterials[id] - (recipe.amounts[id] ?? 1));
          });
          const slot = ARENA_GEAR_CATALOG[recipeId].slot;
          const arenaLoadouts = normalizeArenaLoadouts(
            s.stats.arenaLoadouts,
            [...(s.stats.craftedGear ?? []), recipeId]
          );
          if (!arenaLoadouts[s.hero.archetype][slot]) {
            arenaLoadouts[s.hero.archetype][slot] = recipeId;
          }
          return {
            stats: {
              ...s.stats,
              materials: nextMaterials,
              craftedGear: [...new Set([...(s.stats.craftedGear ?? []), recipeId])],
              arenaLoadouts,
            },
          };
        });
        return true;
      },

      equipArenaGear: (operator, slot, gearId) => {
        const state = get();
        if (!ARENA_OPERATORS.includes(operator) || !ARENA_GEAR_SLOTS.includes(slot)) return false;
        if (
          gearId !== null &&
          (!state.stats.craftedGear.includes(gearId) || ARENA_GEAR_CATALOG[gearId]?.slot !== slot)
        ) {
          return false;
        }
        set((current) => ({
          stats: {
            ...current.stats,
            arenaLoadouts: {
              ...current.stats.arenaLoadouts,
              [operator]: {
                ...current.stats.arenaLoadouts[operator],
                [slot]: gearId,
              },
            },
          },
        }));
        return true;
      },
      
      unlockSkill: (skillId, cost) => {
        const state = get();
        if (state.stats.skillPoints >= cost && !state.stats.skills.includes(skillId)) {
          set((s) => ({
            stats: {
              ...s.stats,
              skillPoints: s.stats.skillPoints - cost,
              skills: [...s.stats.skills, skillId]
            }
          }));
          return true;
        }
        return false;
      },

      // Quick skills na death/victory ekranu se placaju KREDITIMA iz runa
      // (skill pointi ostaju rezervisani za permanent Skill Matrix na /skills).
      purchaseQuickSkill: (skillId, creditCost) => {
        const state = get();
        if (state.stats.credits >= creditCost && !state.stats.skills.includes(skillId)) {
          set((s) => ({
            stats: {
              ...s.stats,
              credits: s.stats.credits - creditCost,
              skills: [...s.stats.skills, skillId]
            }
          }));
          return true;
        }
        return false;
      },

      unlockAchievement: (achievementId) => {
        const state = get();
        const owned = state.stats.achievements ?? [];
        if (owned.includes(achievementId)) return false;
        set((s) => ({
          stats: {
            ...s.stats,
            achievements: [...(s.stats.achievements ?? []), achievementId]
          }
        }));
        return true;
      },

      setHeroProfile: (hero) => set({ hero }),

      addBossArtifact: (artifactId) => {
        const state = get();
        if (!artifactId || state.stats.bossArtifacts.includes(artifactId)) return false;
        set((current) => ({
          stats: {
            ...current.stats,
            bossArtifacts: [...current.stats.bossArtifacts, artifactId],
          },
        }));
        return true;
      },

      claimArtifactMilestone: (tier) => {
        const state = get();
        const operator = state.hero.archetype;
        const current = state.stats.artifactWeapons[operator];
        if (tier <= current.tier) return false;
        const pointsByTier = { 1: 2, 2: 2, 3: 3 } as const;
        const artifactKey = `boss_${tier}_${operator}_artifact`;
        const storyBossesCleared = [...new Set([...state.stats.storyBossesCleared, tier])];
        const actOneComplete = storyBossesCleared.length >= 3;
        set((value) => ({
          stats: {
            ...value.stats,
            bossArtifacts: value.stats.bossArtifacts.includes(artifactKey)
              ? value.stats.bossArtifacts
              : [...value.stats.bossArtifacts, artifactKey],
            artifactWeapons: {
              ...value.stats.artifactWeapons,
              [operator]: {
                ...value.stats.artifactWeapons[operator],
                tier,
                points: value.stats.artifactWeapons[operator].points + pointsByTier[tier],
              },
            },
            storyBossesCleared,
            endgameUnlocked: value.stats.endgameUnlocked || actOneComplete,
            unlockedOperators: actOneComplete
              ? [...new Set([...value.stats.unlockedOperators, ...ARENA_OPERATORS])]
              : value.stats.unlockedOperators,
          },
        }));
        return true;
      },

      addArtifactPower: (amount, operator) => {
        const state = get();
        const classId = operator ?? state.hero.archetype;
        const current = state.stats.artifactWeapons[classId];
        if (current.tier === 0 || amount <= 0) return 0;
        let power = current.power + Math.max(0, Math.floor(amount));
        let points = current.points;
        let pointsGained = 0;
        let simulated = { ...current, power, points };
        let threshold = getArtifactPowerThreshold(simulated);
        while (power >= threshold) {
          power -= threshold;
          points += 1;
          pointsGained += 1;
          simulated = { ...simulated, power, points };
          threshold = getArtifactPowerThreshold(simulated);
        }
        set((value) => ({
          stats: {
            ...value.stats,
            artifactWeapons: {
              ...value.stats.artifactWeapons,
              [classId]: { ...value.stats.artifactWeapons[classId], power, points },
            },
          },
        }));
        return pointsGained;
      },

      upgradeArtifactTrait: (traitId) => {
        const state = get();
        const operator = state.hero.archetype;
        const artifact = state.stats.artifactWeapons[operator];
        const definition = ARTIFACT_WEAPONS[operator];
        const trait = definition.traits.find((candidate) => candidate.id === traitId);
        if (!trait || artifact.tier < trait.requiredTier) return false;
        const rank = artifact.traits[trait.id] ?? 0;
        if (rank >= trait.maxRank || artifact.points < trait.cost) return false;
        if (trait.requires.some((id) => (artifact.traits[id] ?? 0) <= 0)) return false;
        set((value) => ({
          stats: {
            ...value.stats,
            artifactWeapons: {
              ...value.stats.artifactWeapons,
              [operator]: {
                ...value.stats.artifactWeapons[operator],
                points: value.stats.artifactWeapons[operator].points - trait.cost,
                traits: {
                  ...value.stats.artifactWeapons[operator].traits,
                  [trait.id]: rank + 1,
                },
              },
            },
          },
        }));
        return true;
      },

      startOperativeCycle: (operator) => {
        const state = get();
        if (!state.stats.endgameUnlocked || !ARENA_OPERATORS.includes(operator)) return false;
        const accentByClass: Record<HeroProfile["archetype"], string> = {
          vanguard: "#00f2ff",
          spectre: "#ff4b55",
          vector: "#a66bff",
        };
        set((current) => ({
          hero: {
            ...current.hero,
            archetype: operator,
            accent: accentByClass[operator],
          },
          stats: {
            ...current.stats,
            operativeCycles: current.stats.operativeCycles + 1,
            unlockedOperators: [
              ...new Set([...current.stats.unlockedOperators, ...ARENA_OPERATORS]),
            ],
          },
        }));
        return true;
      },

      completeArenaRun: () => {
        const state = get();
        const nextRun = state.stats.arenaRunsCompleted + 1;
        const rewards = ARENA_META_UNLOCKS.filter(
          (reward) => reward.run === nextRun && !state.stats.arenaUnlocks.includes(reward.id)
        );
        const unlockIds = rewards.map((reward) => reward.id);
        const operators = [...state.stats.unlockedOperators];
        const upgrades = [...state.stats.unlockedArenaUpgrades];
        const skills = [...state.stats.skills];
        let credits = state.stats.credits;
        for (const reward of rewards) {
          if (reward.kind === "operator") {
            const operator = reward.target as HeroProfile["archetype"];
            if (!operators.includes(operator)) operators.push(operator);
          } else if (reward.kind === "upgrade") {
            if (!upgrades.includes(reward.target)) upgrades.push(reward.target);
          } else if (reward.kind === "ability") {
            if (!skills.includes(reward.target)) skills.push(reward.target);
          } else if (reward.kind === "credits") {
            credits += Math.max(0, Number.parseInt(reward.target, 10) || 0);
          }
        }
        set((current) => ({
          stats: {
            ...current.stats,
            credits,
            skills,
            arenaRunsCompleted: nextRun,
            arenaUnlocks: [...current.stats.arenaUnlocks, ...unlockIds],
            unlockedOperators: operators,
            unlockedArenaUpgrades: upgrades,
          },
        }));
        return unlockIds;
      },
      
      setSector: (sectorId) => set((state) => {
        // When selecting a sector from hub, jump to its first level
        const firstLevelOfSector = (sectorId - 1) * LEVELS_PER_SECTOR + 1;
        // But if we already have progress in this sector, resume from where we left off
        const currentSectorOfSave = getSectorForLevel(state.currentCampaignLevel);
        const levelToUse = currentSectorOfSave === sectorId ? state.currentCampaignLevel : firstLevelOfSector;
        return { currentSector: sectorId, currentCampaignLevel: levelToUse };
      }),
      
      addScore: (points) => set((state) => ({ score: state.score + points })),
      updateCombo: (combo) => set({ combo }),
      resetSession: () => set({ score: 0, combo: 0, isFeverActive: false }),

      buyCursor: (cursorId, cost) => {
        const state = get();
        const owned = state.stats.ownedCursors || [1];
        if (state.stats.credits >= cost && !owned.includes(cursorId)) {
          set((s) => ({
            stats: {
              ...s.stats,
              credits: s.stats.credits - cost,
              ownedCursors: [...owned, cursorId]
            }
          }));
          return true;
        }
        return false;
      },
      setActiveCursor: (cursorId) => set((state) => ({
        stats: { ...state.stats, activeCursorId: cursorId }
      })),
    }),
    {
      name: 'hugo-neural-storage',
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<GameState>) ?? {};
        return {
          ...currentState,
          ...persisted,
          stats: normalizeStats(persisted.stats),
          pilotBody: isArenaPilotBody(persisted.pilotBody) ? persisted.pilotBody : "male",
          hero: {
            ...currentState.hero,
            ...(persisted.hero ?? {}),
          },
        };
      },
      partialize: (state) => ({ 
        username: state.username, 
        pilotBody: state.pilotBody,
        stats: state.stats,
        hero: state.hero,
        currentCampaignLevel: state.currentCampaignLevel,
        currentSector: state.currentSector,
      }),
    }
  )
);
