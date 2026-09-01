import { create } from "zustand";
import ARENA_CONFIG from "@/data/arena-config.json";
import ARENA_UPGRADES from "@/data/arena-upgrades.json";
import ARENA_ABILITIES from "@/data/arena-abilities.json";
import ARENA_EVOLUTIONS from "@/data/arena-evolutions.json";
import { ARENA_CONTRACTS_BY_ID, type ArenaContractKind } from "@/data/arenaContracts";
import { arenaAudio } from "@/lib/arenaAudio";
import { ARENA_POWER_DROPS, type ArenaPowerDropId } from "@/data/arenaPowerDrops";
import type { ArenaStoryTransmissionId } from "@/data/arenaStory";

export type ArenaPhase =
  | "briefing"
  | "running"
  | "upgrade"
  | "evolution"
  | "relic"
  | "victory"
  | "defeat";

export type ArenaEnvironment = "surface" | "underground";

export type ArenaRelicClass = "warrior" | "rogue" | "warlock";
export type ArenaBossRewardId = "artifact_spark" | "class_augment" | "mythic_core";

export type ArenaMods = {
  damageMult: number;
  fireIntervalMult: number;
  bounces: number;
  bounceRange: number;
  clusterEveryKills: number;
  clusterProjectiles: number;
  healPerKill: number;
  maxHealthAdd: number;
  multishot: number;
  pickupRadiusAdd: number;
  pierces: number;
  spreadRadians: number;
  speedMult: number;
};

const BASE_MODS: ArenaMods = {
  damageMult: 1,
  fireIntervalMult: 1,
  bounces: 0,
  bounceRange: 0,
  clusterEveryKills: 0,
  clusterProjectiles: 0,
  healPerKill: 0,
  maxHealthAdd: 0,
  multishot: 0,
  pickupRadiusAdd: 0,
  pierces: 0,
  spreadRadians: 0,
  speedMult: 1,
};

export type GearMods = Partial<
  Pick<ArenaMods, "speedMult" | "damageMult" | "fireIntervalMult" | "maxHealthAdd" | "pickupRadiusAdd">
>;

export type OperatorMods = Partial<ArenaMods>;

export type ArenaBuffs = {
  shieldUntil: number;
  slowUntil: number;
  slowFactor: number;
  overdriveUntil: number;
  overdriveMult: number;
};

export type CataclysmZone = {
  id: number;
  x: number;
  z: number;
  radius: number;
  tier: number;
  createdAt: number;
};

export type ArenaContractState = {
  id: string;
  label: string;
  description: string;
  kind: ArenaContractKind;
  target: number;
  rewardLabel: string;
  timeLeft: number;
  durationSeconds: number;
  progress: number;
  baselineKills: number;
  baselineCorePickups: number;
  baselineEliteKills: number;
  baselineDamageTaken: number;
};

export type ArenaContractResult = {
  status: "complete" | "failed";
  label: string;
  rewardLabel: string;
  until: number;
};

const BASE_BUFFS: ArenaBuffs = {
  shieldUntil: 0,
  slowUntil: 0,
  slowFactor: 1,
  overdriveUntil: 0,
  overdriveMult: 1,
};

export type ComboMilestone = {
  combo: number;
  color: string;
  label: string;
  radius: number;
  shieldMs: number;
  overdriveMs: number;
  overdriveMult: number;
  fullRepair: boolean;
};

// Svaki prag se moze aktivirati samo jednom u istom runu. Pragovi se namjerno
// udvostrucuju kako bi sljedeca nagrada stalno ostala vidljiv, ali tezak cilj.
export const COMBO_MILESTONES: ComboMilestone[] = [
  {
    combo: 50,
    color: "#37f6ff",
    label: "NEURAL PURGE",
    radius: 22,
    shieldMs: 0,
    overdriveMs: 0,
    overdriveMult: 1,
    fullRepair: false,
  },
  {
    combo: 100,
    color: "#54ffb0",
    label: "AEGIS SURGE",
    radius: 27,
    shieldMs: 6000,
    overdriveMs: 0,
    overdriveMult: 1,
    fullRepair: false,
  },
  {
    combo: 200,
    color: "#ffd24a",
    label: "OVERDRIVE STORM",
    radius: 32,
    shieldMs: 0,
    overdriveMs: 7500,
    overdriveMult: 1.7,
    fullRepair: false,
  },
  {
    combo: 400,
    color: "#ff5ad9",
    label: "CORE RESTORE",
    radius: 40,
    shieldMs: 8000,
    overdriveMs: 0,
    overdriveMult: 1,
    fullRepair: true,
  },
  {
    combo: 800,
    color: "#b87cff",
    label: "NEURAL CATACLYSM",
    radius: 52,
    shieldMs: 10000,
    overdriveMs: 10000,
    overdriveMult: 2,
    fullRepair: true,
  },
  {
    combo: 1600,
    color: "#ffffff",
    label: "SINGULARITY CROWN",
    radius: 68,
    shieldMs: 15000,
    overdriveMs: 15000,
    overdriveMult: 2.4,
    fullRepair: true,
  },
];

export function computeMods(
  ranks: Record<string, number>,
  gear: GearMods = {},
  evolutionIds: string[] = [],
  operator: OperatorMods = {},
  runDamageMult = 1
): ArenaMods {
  const mods = { ...BASE_MODS };
  mods.speedMult *= operator.speedMult ?? 1;
  mods.damageMult *= operator.damageMult ?? 1;
  mods.fireIntervalMult *= operator.fireIntervalMult ?? 1;
  mods.maxHealthAdd += operator.maxHealthAdd ?? 0;
  mods.pickupRadiusAdd += operator.pickupRadiusAdd ?? 0;
  mods.multishot += operator.multishot ?? 0;
  mods.pierces += operator.pierces ?? 0;
  mods.spreadRadians = Math.max(mods.spreadRadians, operator.spreadRadians ?? 0);
  if (gear.speedMult) mods.speedMult *= gear.speedMult;
  if (gear.damageMult) mods.damageMult *= gear.damageMult;
  if (gear.fireIntervalMult) mods.fireIntervalMult *= gear.fireIntervalMult;
  if (gear.maxHealthAdd) mods.maxHealthAdd += gear.maxHealthAdd;
  if (gear.pickupRadiusAdd) mods.pickupRadiusAdd += gear.pickupRadiusAdd;
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
  for (const evolution of ARENA_EVOLUTIONS) {
    if (!evolutionIds.includes(evolution.id)) continue;
    const fx = evolution.effects as Partial<Record<string, number>>;
    if (fx.damageMult) mods.damageMult *= fx.damageMult;
    if (fx.fireIntervalMult) mods.fireIntervalMult *= fx.fireIntervalMult;
    if (fx.bouncesAdd) mods.bounces += fx.bouncesAdd;
    if (fx.bounceRange) mods.bounceRange = Math.max(mods.bounceRange, fx.bounceRange);
    if (fx.clusterEveryKills) mods.clusterEveryKills = fx.clusterEveryKills;
    if (fx.clusterProjectilesAdd) mods.clusterProjectiles += fx.clusterProjectilesAdd;
    if (fx.healPerKill) mods.healPerKill += fx.healPerKill;
    if (fx.multishotAdd) mods.multishot += fx.multishotAdd;
    if (fx.pickupRadiusAdd) mods.pickupRadiusAdd += fx.pickupRadiusAdd;
    if (fx.piercesAdd) mods.pierces += fx.piercesAdd;
    if (fx.spreadRadians) mods.spreadRadians = Math.max(mods.spreadRadians, fx.spreadRadians);
  }
  mods.damageMult *= runDamageMult;
  return mods;
}

function xpThreshold(level: number): number {
  return (
    ARENA_CONFIG.progression.xpThresholdBase +
    ARENA_CONFIG.progression.xpThresholdPerLevel * (level - 1)
  );
}

function rollUpgradeOptions(ranks: Record<string, number>, upgradePool: string[]): string[] {
  const eligible = ARENA_UPGRADES.filter(
    (u) => upgradePool.includes(u.id) && (ranks[u.id] ?? 0) < ARENA_CONFIG.progression.maxUpgradeRank
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
  environment: ArenaEnvironment;
  bossTimerHold: boolean;
  bossGroupsEngaged: number[];
  undergroundDepth: number;
  portalProximity: boolean;
  portalCharge: number;
  timeLeft: number;
  score: number;
  kills: number;
  combo: number;
  comboBest: number;
  comboTimeLeft: number;
  comboMilestonesClaimed: number[];
  lastComboMilestone: number | null;
  comboMilestoneUntil: number;
  cataclysmZones: CataclysmZone[];
  damageDealt: number;
  damageTaken: number;
  lastDamageSource: string;
  health: number;
  maxHealth: number;
  sprintEnergy: number;
  sprintRequested: boolean;
  sprintRegenDelay: number;
  xp: number;
  xpLevel: number;
  xpNeeded: number;
  upgradeRanks: Record<string, number>;
  upgradeOptions: string[];
  upgradePool: string[];
  evolutions: string[];
  pendingEvolution: string | null;
  mods: ArenaMods;
  gearMods: GearMods;
  operatorMods: OperatorMods;
  buffs: ArenaBuffs;
  abilityReadyAt: Record<string, number>;
  lastDamageAt: number;
  rewardsGranted: boolean;
  fixerOfferId: string | null;
  activeContract: ArenaContractState | null;
  contractResult: ArenaContractResult | null;
  contractsCompleted: number;
  contractsFailed: number;
  contractDamageMult: number;
  corePickups: number;
  eliteKills: number;
  relicClass: ArenaRelicClass | null;
  relicChoiceClaimed: boolean;
  bossUnitKills: Record<number, number>;
  bossRewardsClaimed: number[];
  relicAugmentLevel: number;
  chassisCoreActive: boolean;
  storyTransmission: ArenaStoryTransmissionId | null;
  storyTransmissionQueue: ArenaStoryTransmissionId[];
  testTimeScale: number;
  testInvulnerable: boolean;
  testTargetElapsed: number | null;
  testJumpRevision: number;

  reset: () => void;
  start: () => void;
  setPortalContact: (near: boolean, charge: number) => void;
  enterUnderground: (depth: number) => void;
  tick: (dt: number) => void;
  addScore: (points: number) => void;
  addKill: () => ComboMilestone | null;
  triggerCataclysm: (x: number, z: number, radius: number, tier: number) => void;
  damagePlayer: (amount: number, source?: string) => number;
  healPlayer: (amount: number) => number;
  setSprintRequested: (active: boolean) => void;
  recordDamageDealt: (amount: number) => void;
  addArenaXp: (amount: number) => void;
  chooseUpgrade: (id: string) => void;
  acknowledgeEvolution: () => void;
  setGearMods: (gear: GearMods) => void;
  setOperatorMods: (operator: OperatorMods) => void;
  setUpgradePool: (upgradeIds: string[]) => void;
  bindClassWeapon: (relicClass: ArenaRelicClass, artifactTier: 0 | 1 | 2 | 3) => void;
  activateAbility: (id: string) => boolean;
  setFixerOffer: (id: string | null) => void;
  startContract: (id: string) => boolean;
  recordCorePickup: () => void;
  recordEliteKill: () => void;
  offerRelicChoice: () => boolean;
  chooseRelicClass: (relicClass: ArenaRelicClass) => void;
  recordBossUnitKill: (tier: number, groupSize: number) => boolean;
  markBossGroupEngaged: (tier: number) => void;
  collectBossReward: (rewardId: ArenaBossRewardId) => void;
  activatePowerDrop: (powerId: ArenaPowerDropId) => void;
  queueStoryTransmission: (transmissionId: ArenaStoryTransmissionId) => void;
  dismissStoryTransmission: () => void;
  setTestTimeScale: (multiplier: number) => void;
  setTestInvulnerable: (active: boolean) => void;
  testJumpToElapsed: (elapsedSeconds: number) => void;
  testGrantRelic: (relicClass: ArenaRelicClass) => void;
  advanceDefenseContract: (dt: number, inRange: boolean) => void;
  markRewardsGranted: () => void;
}

const initialSession = () => ({
  phase: "briefing" as ArenaPhase,
  environment: "surface" as ArenaEnvironment,
  bossTimerHold: false,
  undergroundDepth: 0,
  portalProximity: false,
  portalCharge: 0,
  timeLeft: ARENA_CONFIG.meta.durationSeconds,
  score: 0,
  kills: 0,
  combo: 0,
  comboBest: 0,
  comboTimeLeft: 0,
  comboMilestonesClaimed: [] as number[],
  lastComboMilestone: null as number | null,
  comboMilestoneUntil: 0,
  cataclysmZones: [] as CataclysmZone[],
  damageDealt: 0,
  damageTaken: 0,
  lastDamageSource: "UNKNOWN SIGNAL",
  health: ARENA_CONFIG.player.maxHealth,
  maxHealth: ARENA_CONFIG.player.maxHealth,
  sprintEnergy: ARENA_CONFIG.player.sprint.maxEnergy,
  sprintRequested: false,
  sprintRegenDelay: 0,
  xp: 0,
  xpLevel: 1,
  xpNeeded: xpThreshold(1),
  upgradeRanks: {} as Record<string, number>,
  upgradeOptions: [] as string[],
  upgradePool: ARENA_UPGRADES.map((upgrade) => upgrade.id),
  evolutions: [] as string[],
  pendingEvolution: null as string | null,
  mods: { ...BASE_MODS },
  gearMods: {} as GearMods,
  operatorMods: {} as OperatorMods,
  buffs: { ...BASE_BUFFS },
  abilityReadyAt: {} as Record<string, number>,
  lastDamageAt: 0,
  rewardsGranted: false,
  fixerOfferId: null as string | null,
  activeContract: null as ArenaContractState | null,
  contractResult: null as ArenaContractResult | null,
  contractsCompleted: 0,
  contractsFailed: 0,
  contractDamageMult: 1,
  corePickups: 0,
  eliteKills: 0,
  relicClass: null as ArenaRelicClass | null,
  relicChoiceClaimed: false,
  bossUnitKills: {} as Record<number, number>,
  bossRewardsClaimed: [] as number[],
  bossGroupsEngaged: [] as number[],
  relicAugmentLevel: 0,
  chassisCoreActive: false,
  storyTransmission: null as ArenaStoryTransmissionId | null,
  storyTransmissionQueue: [] as ArenaStoryTransmissionId[],
  testTimeScale: 1,
  testInvulnerable: false,
  testTargetElapsed: null as number | null,
  testJumpRevision: 0,
});

const resolveContract = (
  state: ArenaSessionState,
  status: ArenaContractResult["status"]
): Partial<ArenaSessionState> => {
  const contract = state.activeContract;
  if (!contract) return {};
  if (status === "failed") {
    return {
      activeContract: null,
      fixerOfferId: null,
      contractsFailed: state.contractsFailed + 1,
      contractResult: {
        status,
        label: contract.label,
        rewardLabel: "NO PENALTY",
        until: performance.now() + 2600,
      },
    };
  }
  const contractDamageMult = state.contractDamageMult * 1.5;
  const mods = computeMods(
    state.upgradeRanks,
    state.gearMods,
    state.evolutions,
    state.operatorMods,
    contractDamageMult
  );
  const now = performance.now();
  return {
    activeContract: null,
    fixerOfferId: null,
    contractsCompleted: state.contractsCompleted + 1,
    contractDamageMult,
    mods,
    score: state.score + 2500 * (state.contractsCompleted + 1),
    buffs: {
      ...state.buffs,
      shieldUntil: Math.max(state.buffs.shieldUntil, now + 4000),
    },
    contractResult: {
      status,
      label: contract.label,
      rewardLabel: contract.rewardLabel,
      until: now + 3200,
    },
  };
};

export const useArenaSession = create<ArenaSessionState>()((set, get) => ({
  ...initialSession(),

  reset: () => set(initialSession()),

  start: () => set({ phase: "running" }),

  setPortalContact: (near, charge) =>
    set({
      portalProximity: near,
      portalCharge: Math.max(0, Math.min(1, charge)),
    }),

  enterUnderground: (depth) =>
    set({
      environment: "underground",
      undergroundDepth: Math.max(1, Math.floor(depth)),
      portalProximity: false,
      portalCharge: 0,
      timeLeft: ARENA_CONFIG.meta.durationSeconds,
      phase: "running",
      sprintRequested: false,
      fixerOfferId: null,
      activeContract: null,
      contractResult: null,
      cataclysmZones: [],
    }),

  tick: (dt) => {
    const state = get();
    if (state.phase !== "running") return;
    const scaledDt = dt * Math.max(1, state.testTimeScale);
    // Dok je stvarno spawnovana ("engaged") boss grupa neporazena, tajmer se drzi:
    // run ne smije isteci preko zivog bossa (Boss 3 bi inace bio nedostizan u 60s prozoru).
    // Vazan detalj: gleda se engaged lista, ne raspored — QA jump smije preskociti bosseve.
    const bossTimerHold =
      state.environment === "surface" &&
      state.bossGroupsEngaged.some((tier) => !state.bossRewardsClaimed.includes(tier));
    const timeLeft = bossTimerHold ? state.timeLeft : Math.max(0, state.timeLeft - scaledDt);
    const comboTimeLeft = Math.max(0, state.comboTimeLeft - scaledDt);
    const combo = comboTimeLeft > 0 ? state.combo : 0;
    let sprintEnergy = state.sprintEnergy;
    let sprintRegenDelay = state.sprintRegenDelay;
    if (state.sprintRequested && sprintEnergy > 0) {
      sprintEnergy = Math.max(
        0,
        sprintEnergy - ARENA_CONFIG.player.sprint.drainPerSecond * scaledDt
      );
      sprintRegenDelay = ARENA_CONFIG.player.sprint.regenDelaySeconds;
    } else {
      sprintRegenDelay = Math.max(0, sprintRegenDelay - scaledDt);
      if (sprintRegenDelay <= 0) {
        sprintEnergy = Math.min(
          ARENA_CONFIG.player.sprint.maxEnergy,
          sprintEnergy + ARENA_CONFIG.player.sprint.regenPerSecond * scaledDt
        );
      }
    }
    let contractPatch: Partial<ArenaSessionState> =
      state.contractResult && performance.now() >= state.contractResult.until
        ? { contractResult: null }
        : {};
    if (state.activeContract) {
      const activeContract = {
        ...state.activeContract,
        timeLeft: Math.max(0, state.activeContract.timeLeft - scaledDt),
      };
      if (activeContract.kind === "kills") {
        activeContract.progress = state.kills - activeContract.baselineKills;
      } else if (activeContract.kind === "cores") {
        activeContract.progress = state.corePickups - activeContract.baselineCorePickups;
      } else if (activeContract.kind === "elite") {
        activeContract.progress = state.eliteKills - activeContract.baselineEliteKills;
      } else if (activeContract.kind === "no-damage") {
        activeContract.progress = activeContract.durationSeconds - activeContract.timeLeft;
      }

      const ghostFailed =
        activeContract.kind === "no-damage" && state.damageTaken > activeContract.baselineDamageTaken;
      const targetReached = activeContract.progress >= activeContract.target;
      const ghostSurvived = activeContract.kind === "no-damage" && activeContract.timeLeft <= 0;
      if (ghostFailed) {
        contractPatch = resolveContract({ ...state, activeContract }, "failed");
        arenaAudio.sfx("hurt");
      } else if (targetReached || ghostSurvived) {
        contractPatch = resolveContract({ ...state, activeContract }, "complete");
        arenaAudio.sfx("levelUp");
      } else if (activeContract.timeLeft <= 0) {
        contractPatch = resolveContract({ ...state, activeContract }, "failed");
      } else {
        contractPatch = { activeContract };
      }
    }

    if (timeLeft <= 0) {
      set({
        ...contractPatch,
        timeLeft: 0,
        combo,
        comboTimeLeft,
        sprintEnergy,
        sprintRegenDelay,
        sprintRequested: false,
        phase: "victory",
      });
    } else {
      set({
        ...contractPatch,
        timeLeft,
        combo,
        comboTimeLeft,
        sprintEnergy,
        sprintRegenDelay,
        bossTimerHold,
      });
    }
  },

  addScore: (points) => set((s) => ({ score: s.score + points })),

  addKill: () => {
    const state = get();
    const combo = state.comboTimeLeft > 0 ? state.combo + 1 : 1;
    const milestone =
      COMBO_MILESTONES.find(
        (candidate) =>
          candidate.combo === combo && !state.comboMilestonesClaimed.includes(candidate.combo)
      ) ?? null;
    const now = performance.now();
    const buffs = { ...state.buffs };
    if (milestone?.shieldMs) {
      buffs.shieldUntil = Math.max(buffs.shieldUntil, now + milestone.shieldMs);
    }
    if (milestone?.overdriveMs) {
      buffs.overdriveUntil = Math.max(buffs.overdriveUntil, now + milestone.overdriveMs);
      buffs.overdriveMult = Math.max(buffs.overdriveMult, milestone.overdriveMult);
    }
    set({
      kills: state.kills + 1,
      combo,
      comboBest: Math.max(state.comboBest, combo),
      comboTimeLeft: 2.8,
      comboMilestonesClaimed: milestone
        ? [...state.comboMilestonesClaimed, milestone.combo]
        : state.comboMilestonesClaimed,
      lastComboMilestone: milestone?.combo ?? state.lastComboMilestone,
      comboMilestoneUntil: milestone ? now + 2300 : state.comboMilestoneUntil,
      buffs,
      health: milestone?.fullRepair
        ? state.maxHealth
        : Math.min(state.maxHealth, state.health + state.mods.healPerKill),
    });
    arenaAudio.combo(combo);
    if (milestone) arenaAudio.milestone(milestone.combo);
    return milestone;
  },

  triggerCataclysm: (x, z, radius, tier) =>
    set((state) => ({
      cataclysmZones: [
        ...state.cataclysmZones,
        {
          id: state.cataclysmZones.length + 1,
          x,
          z,
          radius,
          tier,
          createdAt: performance.now(),
        },
      ],
    })),

  damagePlayer: (amount, source = "HOSTILE SIGNAL") => {
    const state = get();
    if (state.phase !== "running") return 0;
    if (state.testInvulnerable) return 0;
    const now = performance.now();
    if (now < state.buffs.shieldUntil) return 0; // barrier upija svu stetu
    if (now - state.lastDamageAt < ARENA_CONFIG.player.contactInvulnerabilityMs) return 0;
    const appliedDamage = Math.min(state.health, Math.max(0, amount));
    const health = Math.max(0, state.health - appliedDamage);
    const contractPatch = health <= 0 && state.activeContract
      ? resolveContract(state, "failed")
      : {};
    set({
      ...contractPatch,
      health,
      damageTaken: state.damageTaken + appliedDamage,
      lastDamageAt: now,
      lastDamageSource: source,
      phase: health <= 0 ? "defeat" : state.phase,
    });
    arenaAudio.sfx("hurt");
    return appliedDamage;
  },

  healPlayer: (amount) => {
    const state = get();
    if (state.phase !== "running") return 0;
    const restored = Math.min(Math.max(0, amount), state.maxHealth - state.health);
    if (restored <= 0) return 0;
    set({ health: state.health + restored });
    return restored;
  },

  setSprintRequested: (active) => {
    const state = get();
    if (state.sprintRequested === active) return;
    set({ sprintRequested: active });
  },

  recordDamageDealt: (amount) =>
    set((state) => ({ damageDealt: state.damageDealt + Math.max(0, amount) })),

  addArenaXp: (amount) => {
    const state = get();
    if (state.phase !== "running") return;
    let xp = state.xp + amount;
    if (xp >= state.xpNeeded) {
      xp -= state.xpNeeded;
      const xpLevel = state.xpLevel + 1;
      const options = rollUpgradeOptions(state.upgradeRanks, state.upgradePool);
      set({
        xp,
        xpLevel,
        xpNeeded: xpThreshold(xpLevel),
        upgradeOptions: options,
        phase: options.length > 0 ? "upgrade" : "running",
      });
      arenaAudio.sfx("levelUp");
    } else {
      set({ xp });
    }
  },

  chooseUpgrade: (id) => {
    const state = get();
    const ranks = { ...state.upgradeRanks, [id]: (state.upgradeRanks[id] ?? 0) + 1 };
    const unlocked = ARENA_EVOLUTIONS.filter(
      (evolution) =>
        !state.evolutions.includes(evolution.id) &&
        evolution.requirements.every(
          (requirement) => (ranks[requirement.id] ?? 0) >= requirement.rank
        )
    ).map((evolution) => evolution.id);
    const evolutions = [...state.evolutions, ...unlocked];
    const pendingEvolution = unlocked[0] ?? null;
    const mods = computeMods(
      ranks,
      state.gearMods,
      evolutions,
      state.operatorMods,
      state.contractDamageMult
    );
    const maxHealth = ARENA_CONFIG.player.maxHealth + mods.maxHealthAdd;
    const gainedMaxHealth = maxHealth - state.maxHealth;
    const healAdd =
      id === "barrier"
        ? ((ARENA_UPGRADES.find((u) => u.id === "barrier")?.effects as Partial<Record<string, number>>)
            ?.healAdd ?? 0)
        : 0;
    set({
      upgradeRanks: ranks,
      evolutions,
      pendingEvolution,
      mods,
      maxHealth,
      health: Math.min(maxHealth, state.health + gainedMaxHealth + healAdd),
      upgradeOptions: [],
      phase: pendingEvolution ? "evolution" : "running",
    });
  },

  acknowledgeEvolution: () => set({ pendingEvolution: null, phase: "running" }),

  setGearMods: (gear) => {
    const state = get();
    const mods = computeMods(
      state.upgradeRanks,
      gear,
      state.evolutions,
      state.operatorMods,
      state.contractDamageMult
    );
    const maxHealth = ARENA_CONFIG.player.maxHealth + mods.maxHealthAdd;
    set({
      gearMods: gear,
      mods,
      maxHealth,
      health: Math.min(maxHealth, state.health + Math.max(0, maxHealth - state.maxHealth)),
    });
  },

  setOperatorMods: (operator) => {
    const state = get();
    const mods = computeMods(
      state.upgradeRanks,
      state.gearMods,
      state.evolutions,
      operator,
      state.contractDamageMult
    );
    const maxHealth = Math.max(1, ARENA_CONFIG.player.maxHealth + mods.maxHealthAdd);
    set({
      operatorMods: { ...operator },
      mods,
      maxHealth,
      health: Math.min(maxHealth, state.health + Math.max(0, maxHealth - state.maxHealth)),
    });
  },

  setUpgradePool: (upgradeIds) => {
    const valid = ARENA_UPGRADES.map((upgrade) => upgrade.id).filter((id) => upgradeIds.includes(id));
    set({ upgradePool: valid.length > 0 ? valid : ["precision", "rapidfire", "barrier"] });
  },

  bindClassWeapon: (relicClass, artifactTier) =>
    set({
      relicClass,
      relicChoiceClaimed: true,
      relicAugmentLevel: artifactTier,
      chassisCoreActive: artifactTier >= 3,
    }),

  activateAbility: (id) => {
    const ability = ARENA_ABILITIES.find((a) => a.id === id);
    const state = get();
    if (!ability || state.phase !== "running") return false;
    const now = performance.now();
    if ((state.abilityReadyAt[id] ?? 0) > now) return false;
    const params = ability.params as Partial<Record<string, number>>;
    const buffs = { ...state.buffs };
    if (ability.kind === "shield") buffs.shieldUntil = now + (params.durationMs ?? 0);
    if (ability.kind === "slow") {
      buffs.slowUntil = now + (params.durationMs ?? 0);
      buffs.slowFactor = params.slowFactor ?? 1;
    }
    if (ability.kind === "overdrive") {
      buffs.overdriveUntil = now + (params.durationMs ?? 0);
      buffs.overdriveMult = params.fireRateMult ?? 1;
    }
    set({
      buffs,
      abilityReadyAt: { ...state.abilityReadyAt, [id]: now + ability.cooldownMs },
    });
    return true;
  },

  setFixerOffer: (id) => set({ fixerOfferId: id, contractResult: id ? null : get().contractResult }),

  startContract: (id) => {
    const state = get();
    const definition = ARENA_CONTRACTS_BY_ID[id];
    if (!definition || state.phase !== "running" || state.activeContract) return false;
    set({
      fixerOfferId: null,
      contractResult: null,
      activeContract: {
        ...definition,
        timeLeft: definition.durationSeconds,
        progress: 0,
        baselineKills: state.kills,
        baselineCorePickups: state.corePickups,
        baselineEliteKills: state.eliteKills,
        baselineDamageTaken: state.damageTaken,
      },
    });
    arenaAudio.sfx("ability");
    return true;
  },

  recordCorePickup: () => set((state) => ({ corePickups: state.corePickups + 1 })),

  recordEliteKill: () => set((state) => ({ eliteKills: state.eliteKills + 1 })),

  offerRelicChoice: () => {
    const state = get();
    if (state.relicChoiceClaimed || state.phase !== "running") return false;
    set({ phase: "relic", sprintRequested: false });
    return true;
  },

  chooseRelicClass: (relicClass) => {
    const state = get();
    if (state.phase !== "relic" || state.relicChoiceClaimed) return;
    set({ relicClass, relicChoiceClaimed: true, phase: "running" });
  },

  markBossGroupEngaged: (tier) =>
    set((state) =>
      state.bossGroupsEngaged.includes(tier)
        ? {}
        : { bossGroupsEngaged: [...state.bossGroupsEngaged, tier] }
    ),

  recordBossUnitKill: (tier, groupSize) => {
    const state = get();
    if (state.bossRewardsClaimed.includes(tier)) return false;
    const nextCount = (state.bossUnitKills[tier] ?? 0) + 1;
    const complete = nextCount >= Math.max(1, groupSize);
    set({
      bossUnitKills: { ...state.bossUnitKills, [tier]: nextCount },
      bossRewardsClaimed: complete
        ? [...state.bossRewardsClaimed, tier]
        : state.bossRewardsClaimed,
    });
    return complete;
  },

  collectBossReward: (rewardId) => {
    const state = get();
    const now = performance.now();
    if (rewardId === "artifact_spark") {
      set({
        relicAugmentLevel: Math.max(1, state.relicAugmentLevel),
        buffs: {
          ...state.buffs,
          shieldUntil: Math.max(state.buffs.shieldUntil, now + 4500),
        },
      });
      return;
    }
    if (rewardId === "class_augment") {
      set({
        relicAugmentLevel: Math.max(2, state.relicAugmentLevel),
        buffs: {
          ...state.buffs,
          overdriveUntil: Math.max(state.buffs.overdriveUntil, now + 7000),
          overdriveMult: Math.max(state.buffs.overdriveMult, 1.45),
        },
      });
      return;
    }
    set({
      chassisCoreActive: true,
      relicAugmentLevel: Math.max(3, state.relicAugmentLevel),
      health: state.maxHealth,
      buffs: {
        ...state.buffs,
        shieldUntil: Math.max(state.buffs.shieldUntil, now + 12000),
      },
    });
  },

  activatePowerDrop: (powerId) => {
    const definition = ARENA_POWER_DROPS[powerId];
    if (!definition) return;
    const state = get();
    const now = performance.now();
    if (definition.effect.heal) {
      set({ health: Math.min(state.maxHealth, state.health + definition.effect.heal) });
      return;
    }
    set({
      buffs: {
        ...state.buffs,
        shieldUntil: definition.effect.shield
          ? Math.max(state.buffs.shieldUntil, now + definition.durationMs)
          : state.buffs.shieldUntil,
        slowUntil: definition.effect.enemySlowFactor
          ? Math.max(state.buffs.slowUntil, now + definition.durationMs)
          : state.buffs.slowUntil,
        slowFactor: definition.effect.enemySlowFactor ?? state.buffs.slowFactor,
        overdriveUntil: definition.effect.fireRateMult
          ? Math.max(state.buffs.overdriveUntil, now + definition.durationMs)
          : state.buffs.overdriveUntil,
        overdriveMult: definition.effect.fireRateMult
          ? Math.max(state.buffs.overdriveMult, definition.effect.fireRateMult)
          : state.buffs.overdriveMult,
      },
    });
  },

  queueStoryTransmission: (transmissionId) =>
    set((state) => {
      if (state.storyTransmission === transmissionId) return state;
      if (state.storyTransmissionQueue.includes(transmissionId)) return state;
      if (!state.storyTransmission) return { storyTransmission: transmissionId };
      return { storyTransmissionQueue: [...state.storyTransmissionQueue, transmissionId] };
    }),

  dismissStoryTransmission: () =>
    set((state) => ({
      storyTransmission: state.storyTransmissionQueue[0] ?? null,
      storyTransmissionQueue: state.storyTransmissionQueue.slice(1),
    })),

  setTestTimeScale: (multiplier) =>
    set({ testTimeScale: [1, 2, 4, 8].includes(multiplier) ? multiplier : 1 }),

  setTestInvulnerable: (active) => set({ testInvulnerable: active }),

  testJumpToElapsed: (elapsedSeconds) =>
    set((state) => {
      const target = Math.max(
        0,
        Math.min(ARENA_CONFIG.meta.durationSeconds - 0.5, elapsedSeconds)
      );
      return {
        timeLeft: ARENA_CONFIG.meta.durationSeconds - target,
        phase: "running",
        upgradeOptions: [],
        pendingEvolution: null,
        fixerOfferId: null,
        activeContract: null,
        testTargetElapsed: target,
        testJumpRevision: state.testJumpRevision + 1,
      };
    }),

  testGrantRelic: (relicClass) =>
    set({ relicClass, relicChoiceClaimed: true, phase: "running" }),

  advanceDefenseContract: (dt, inRange) =>
    set((state) => {
      const contract = state.activeContract;
      if (!contract || contract.kind !== "defense" || !inRange) return state;
      return {
        activeContract: {
          ...contract,
          progress: Math.min(contract.target, contract.progress + Math.max(0, dt)),
        },
      };
    }),

  markRewardsGranted: () => set({ rewardsGranted: true }),
}));

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as unknown as Record<string, unknown>).__arenaSession = useArenaSession;
}
