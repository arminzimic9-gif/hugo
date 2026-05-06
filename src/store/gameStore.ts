import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PlayerStats {
  level: number;
  xp: number;
  credits: number;
  skills: string[];
  unlockedSectors: number[];
  maxLevelReached: number;
  completedLevels: number[]; // all individually completed level numbers
  ownedCursors: number[];
  activeCursorId: number;
  achievements: string[]; // List of unlocked achievement IDs
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
  stats: PlayerStats;
  
  // Persistent campaign progress
  currentCampaignLevel: number; // Global level 1-55+
  currentSector: number;
  
  // Non-persistent session
  score: number;
  combo: number;
  isFeverActive: boolean;
  
  // Actions
  login: (username: string) => void;
  logout: () => void;
  addXp: (amount: number) => void;
  addCredits: (amount: number) => void;
  unlockSkill: (skillId: string, cost: number) => boolean;
  completeLevel: (levelCompleted: number) => void;
  setReplayLevel: (level: number) => void;
  
  // Session Actions
  setSector: (sectorId: number) => void;
  addScore: (points: number) => void;
  updateCombo: (combo: number) => void;
  resetSession: () => void;
  
  // Customization
  buyCursor: (cursorId: number, cost: number) => boolean;
  setActiveCursor: (cursorId: number) => void;
  unlockAchievement: (achievementId: string) => void;
}

const XP_PER_LEVEL = 1000;

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      username: null,
      stats: {
        level: 1,
        xp: 0,
        credits: 0,
        skills: [],
        unlockedSectors: [1],
        maxLevelReached: 1,
        completedLevels: [],
        ownedCursors: [1], // Neon Pulse by default
        activeCursorId: 1,
        achievements: [],
      },
      currentCampaignLevel: 1,
      currentSector: 1,
      score: 0,
      combo: 0,
      isFeverActive: false,

      login: (username) => set({ username }),
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
        
        while (newXp >= XP_PER_LEVEL * newLevel) {
          newXp -= XP_PER_LEVEL * newLevel;
          newLevel++;
        }
        
        return { stats: { ...state.stats, xp: newXp, level: newLevel } };
      }),
      
      addCredits: (amount) => set((state) => ({
        stats: { ...state.stats, credits: state.stats.credits + amount }
      })),
      
      unlockSkill: (skillId, cost) => {
        const state = get();
        if (state.stats.credits >= cost && !state.stats.skills.includes(skillId)) {
          set((s) => ({
            stats: {
              ...s.stats,
              credits: s.stats.credits - cost,
              skills: [...s.stats.skills, skillId]
            }
          }));
          return true;
        }
        return false;
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
      unlockAchievement: (achievementId) => set((state) => {
        if (state.stats.achievements?.includes(achievementId)) return state;
        return {
          stats: {
            ...state.stats,
            achievements: [...(state.stats.achievements || []), achievementId]
          }
        };
      }),
    }),
    {
      name: 'hugo-neural-storage',
      partialize: (state) => ({ 
        username: state.username, 
        stats: state.stats,
        currentCampaignLevel: state.currentCampaignLevel,
        currentSector: state.currentSector,
      }),
    }
  )
);
