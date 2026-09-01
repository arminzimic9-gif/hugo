export type ArenaClassId = "vanguard" | "spectre" | "vector";
export type ArtifactWeaponClass = "warrior" | "rogue" | "warlock";

export type ProgressionEffects = Partial<{
  damageMult: number;
  fireIntervalMult: number;
  bouncesAdd: number;
  bounceRange: number;
  clusterEveryKills: number;
  clusterProjectilesAdd: number;
  healPerKill: number;
  maxHealthAdd: number;
  multishotAdd: number;
  pickupRadiusAdd: number;
  piercesAdd: number;
  spreadRadians: number;
  speedMult: number;
}>;

export type ArenaClassDefinition = {
  id: ArenaClassId;
  label: string;
  fantasy: string;
  role: string;
  resource: string;
  resourceRule: string;
  prototypeWeapon: string;
  artifactWeapon: string;
  signature: string;
  passive: string;
  combatLoop: string[];
  weakness: string;
  relicClass: ArtifactWeaponClass;
  accent: string;
};

export const ARENA_CLASSES: Record<ArenaClassId, ArenaClassDefinition> = {
  vanguard: {
    id: "vanguard",
    label: "VANGUARD",
    fantasy: "WARRIOR",
    role: "Frontline / Guard / Cleave",
    resource: "GUARD",
    resourceRule: "Build Guard by staying close and hitting groups; spend it on blocks and shockwaves.",
    prototypeWeapon: "Bastion Prototype Greatsword",
    artifactWeapon: "Aegis Breaker",
    signature: "Seismic Cleave — a wide, slow strike that staggers the front line.",
    passive: "Last Line — bonus integrity and stronger close-range control.",
    combatLoop: ["Enter the pack", "Build Guard", "Block the counter-hit", "Spend Guard on Seismic Cleave"],
    weakness: "Slowest repositioning and the longest recovery after a missed heavy strike.",
    relicClass: "warrior",
    accent: "#00f2ff",
  },
  spectre: {
    id: "spectre",
    label: "SPECTRE",
    fantasy: "ROGUE",
    role: "Assassin / Dash / Critical",
    resource: "EDGE",
    resourceRule: "Build Edge while moving and avoiding damage; spend it on rapid critical chains.",
    prototypeWeapon: "Wraith Prototype Monoblades",
    artifactWeapon: "Night Circuit",
    signature: "Blink Flurry — a short dash through a target followed by a twin-blade burst.",
    passive: "Predator Rhythm — movement and clean kills accelerate the next attack chain.",
    combatLoop: ["Circle the pack", "Build Edge", "Dash through priority targets", "Cash out with Blink Flurry"],
    weakness: "Lowest integrity; losing momentum removes most of the class advantage.",
    relicClass: "rogue",
    accent: "#ff4b55",
  },
  vector: {
    id: "vector",
    label: "RIFTWEAVER",
    fantasy: "WARLOCK",
    role: "Caster / Curse / Sustain",
    resource: "FLUX",
    resourceRule: "Build Flux from pierced and cursed enemies; spend it on zones and life-siphon attacks.",
    prototypeWeapon: "Rift Prototype Glaive",
    artifactWeapon: "Null Testament",
    signature: "Fel Convergence — a ranged glaive wave that pulls and curses enemies.",
    passive: "Soul Circuit — cursed kills restore a small amount of integrity.",
    combatLoop: ["Mark a lane", "Pierce to build Flux", "Group enemies in a curse field", "Siphon the marked pack"],
    weakness: "Needs setup time and space; weakest class when surrounded without Flux.",
    relicClass: "warlock",
    accent: "#a66bff",
  },
};

export type SkillBranch = "assault" | "fortitude" | "mobility" | "control" | "convergence";

export type ArenaSkillNode = {
  id: string;
  label: string;
  branch: SkillBranch | "core";
  description: string;
  why: string;
  cost: number;
  requires: string[];
  x: number;
  y: number;
  effects: ProgressionEffects;
};

export const SKILL_BRANCHES: Record<SkillBranch | "core", { label: string; color: string }> = {
  core: { label: "NEURAL CORE", color: "#ffffff" },
  assault: { label: "ASSAULT", color: "#ff4b55" },
  fortitude: { label: "FORTITUDE", color: "#4dff9c" },
  mobility: { label: "MOBILITY", color: "#35d9ff" },
  control: { label: "CONTROL", color: "#a66bff" },
  convergence: { label: "CONVERGENCE", color: "#ffd15c" },
};

export const ARENA_SKILL_NODES: ArenaSkillNode[] = [
  { id: "core", label: "HUGO CORE", branch: "core", description: "Root of the permanent Arena matrix.", why: "Every build starts here.", cost: 0, requires: [], x: 50, y: 50, effects: {} },

  { id: "calibrated_strikes", label: "CALIBRATED STRIKES", branch: "assault", description: "+8% all damage.", why: "A reliable first damage investment for every class.", cost: 1, requires: ["core"], x: 34, y: 50, effects: { damageMult: 1.08 } },
  { id: "rapid_cycle", label: "RAPID CYCLE", branch: "assault", description: "Weapon cycle is 6% faster.", why: "More attacks also build class resources faster.", cost: 1, requires: ["calibrated_strikes"], x: 23, y: 42, effects: { fireIntervalMult: 0.94 } },
  { id: "kinetic_breach", label: "KINETIC BREACH", branch: "assault", description: "Projectiles pierce one extra target.", why: "Turns narrow lanes into efficient damage lines.", cost: 2, requires: ["calibrated_strikes"], x: 23, y: 58, effects: { piercesAdd: 1 } },
  { id: "chain_voltage", label: "CHAIN VOLTAGE", branch: "assault", description: "Hits can jump once within 8m.", why: "Covers scattered enemies that piercing cannot line up.", cost: 2, requires: ["rapid_cycle"], x: 12, y: 35, effects: { bouncesAdd: 1, bounceRange: 8 } },
  { id: "breach_payload", label: "BREACH PAYLOAD", branch: "assault", description: "+14% damage after committing to the breach line.", why: "A stronger reward for players who finish the assault branch.", cost: 3, requires: ["kinetic_breach"], x: 12, y: 65, effects: { damageMult: 1.14 } },
  { id: "execution_engine", label: "EXECUTION ENGINE", branch: "assault", description: "Every 6 kills launches an 8-shot radial burst.", why: "Converts sustained offense into crowd clear.", cost: 3, requires: ["chain_voltage", "breach_payload"], x: 7, y: 50, effects: { clusterEveryKills: 6, clusterProjectilesAdd: 8 } },

  { id: "reinforced_mesh", label: "REINFORCED MESH", branch: "fortitude", description: "+12 maximum integrity.", why: "Gives every class room to learn boss patterns.", cost: 1, requires: ["core"], x: 66, y: 50, effects: { maxHealthAdd: 12 } },
  { id: "recovery_loop", label: "RECOVERY LOOP", branch: "fortitude", description: "Kills restore 0.25 integrity.", why: "Rewards aggressive survival instead of passive waiting.", cost: 1, requires: ["reinforced_mesh"], x: 77, y: 42, effects: { healPerKill: 0.25 } },
  { id: "aegis_lattice", label: "AEGIS LATTICE", branch: "fortitude", description: "+18 maximum integrity.", why: "Prepares durable builds for Underground pressure.", cost: 2, requires: ["reinforced_mesh"], x: 77, y: 58, effects: { maxHealthAdd: 18 } },
  { id: "combat_salvage", label: "COMBAT SALVAGE", branch: "fortitude", description: "+1.25m pickup radius and 0.2 heal per kill.", why: "Makes recovery drops safer to collect under pressure.", cost: 2, requires: ["recovery_loop"], x: 88, y: 35, effects: { pickupRadiusAdd: 1.25, healPerKill: 0.2 } },
  { id: "last_stand", label: "LAST STAND", branch: "fortitude", description: "+24 maximum integrity.", why: "The branch capstone is pure, readable durability.", cost: 3, requires: ["aegis_lattice", "combat_salvage"], x: 93, y: 50, effects: { maxHealthAdd: 24 } },

  { id: "vector_thrusters", label: "VECTOR THRUSTERS", branch: "mobility", description: "+5% movement speed.", why: "Improves map traversal and enemy spacing.", cost: 1, requires: ["core"], x: 50, y: 34, effects: { speedMult: 1.05 } },
  { id: "phase_stride", label: "PHASE STRIDE", branch: "mobility", description: "+4% movement speed and +0.5m pickup radius.", why: "Connects evasive movement with safer resource collection.", cost: 1, requires: ["vector_thrusters"], x: 42, y: 23, effects: { speedMult: 1.04, pickupRadiusAdd: 0.5 } },
  { id: "hunter_geometry", label: "HUNTER GEOMETRY", branch: "mobility", description: "Weapon cycle is 4% faster while running the mobility route.", why: "Keeps offense active while repositioning.", cost: 2, requires: ["vector_thrusters"], x: 58, y: 23, effects: { fireIntervalMult: 0.96 } },
  { id: "slipstream", label: "SLIPSTREAM", branch: "mobility", description: "+7% movement speed.", why: "A meaningful late-game traversal upgrade.", cost: 2, requires: ["phase_stride"], x: 36, y: 12, effects: { speedMult: 1.07 } },
  { id: "pursuit_matrix", label: "PURSUIT MATRIX", branch: "mobility", description: "+5% speed and +5% damage.", why: "The capstone turns good positioning into tempo.", cost: 3, requires: ["slipstream", "hunter_geometry"], x: 50, y: 7, effects: { speedMult: 1.05, damageMult: 1.05 } },

  { id: "resonance_field", label: "RESONANCE FIELD", branch: "control", description: "+1.5m pickup radius.", why: "The control branch starts by widening your influence over the arena.", cost: 1, requires: ["core"], x: 50, y: 66, effects: { pickupRadiusAdd: 1.5 } },
  { id: "arc_conductor", label: "ARC CONDUCTOR", branch: "control", description: "Add one bounce with 10m range.", why: "Lets control builds pressure enemies outside the main firing lane.", cost: 1, requires: ["resonance_field"], x: 42, y: 77, effects: { bouncesAdd: 1, bounceRange: 10 } },
  { id: "compression_wave", label: "COMPRESSION WAVE", branch: "control", description: "Add one pierce and +0.5m pickup radius.", why: "Tight formations become a resource instead of a threat.", cost: 2, requires: ["resonance_field"], x: 58, y: 77, effects: { piercesAdd: 1, pickupRadiusAdd: 0.5 } },
  { id: "storm_link", label: "STORM LINK", branch: "control", description: "Two additional bounces within 14m.", why: "A clear chain-lightning identity for the full branch.", cost: 2, requires: ["arc_conductor"], x: 36, y: 88, effects: { bouncesAdd: 2, bounceRange: 14 } },
  { id: "gravity_well", label: "GRAVITY WELL", branch: "control", description: "+8% damage and +2m pickup radius.", why: "The capstone rewards fighting from a controlled zone.", cost: 3, requires: ["storm_link", "compression_wave"], x: 50, y: 93, effects: { damageMult: 1.08, pickupRadiusAdd: 2 } },

  { id: "combat_flow", label: "COMBAT FLOW", branch: "convergence", description: "+5% damage and +3% speed.", why: "Links Assault and Mobility into one aggressive loop.", cost: 2, requires: ["rapid_cycle", "phase_stride"], x: 27, y: 27, effects: { damageMult: 1.05, speedMult: 1.03 } },
  { id: "living_armor", label: "LIVING ARMOR", branch: "convergence", description: "+10 integrity and 0.15 heal per kill.", why: "Links Fortitude and Control into sustain.", cost: 2, requires: ["recovery_loop", "arc_conductor"], x: 73, y: 73, effects: { maxHealthAdd: 10, healPerKill: 0.15 } },
  { id: "hunter_aegis", label: "HUNTER AEGIS", branch: "convergence", description: "+4% speed and +10 integrity.", why: "A balanced bridge for evasive frontline builds.", cost: 2, requires: ["aegis_lattice", "hunter_geometry"], x: 73, y: 27, effects: { speedMult: 1.04, maxHealthAdd: 10 } },
  { id: "singularity_rounds", label: "SINGULARITY ROUNDS", branch: "convergence", description: "+10% damage and one extra pierce.", why: "A late hybrid payoff for Assault and Control investment.", cost: 3, requires: ["kinetic_breach", "compression_wave"], x: 27, y: 73, effects: { damageMult: 1.1, piercesAdd: 1 } },
  { id: "neural_apex", label: "NEURAL APEX", branch: "convergence", description: "+8% damage, +5% speed and +15 integrity.", why: "Final proof that the whole permanent matrix is connected.", cost: 4, requires: ["combat_flow", "living_armor", "hunter_aegis", "singularity_rounds"], x: 50, y: 16, effects: { damageMult: 1.08, speedMult: 1.05, maxHealthAdd: 15 } },
];

export type ArtifactTrait = {
  id: string;
  label: string;
  description: string;
  why: string;
  maxRank: number;
  cost: number;
  requires: string[];
  requiredTier: 1 | 2 | 3;
  effectsPerRank: ProgressionEffects;
};

export type ArtifactWeaponDefinition = {
  classId: ArenaClassId;
  relicClass: ArtifactWeaponClass;
  name: string;
  prototype: string;
  color: string;
  traits: ArtifactTrait[];
};

export const ARTIFACT_WEAPONS: Record<ArenaClassId, ArtifactWeaponDefinition> = {
  vanguard: {
    classId: "vanguard",
    relicClass: "warrior",
    name: "AEGIS BREAKER",
    prototype: "BASTION PROTOTYPE GREATSWORD",
    color: "#35d9ff",
    traits: [
      { id: "v_tempered", label: "TEMPERED EDGE", description: "+7% damage per rank.", why: "Improves every greatsword and projectile hit.", maxRank: 3, cost: 1, requires: [], requiredTier: 1, effectsPerRank: { damageMult: 1.07 } },
      { id: "v_bulwark", label: "BULWARK CORE", description: "+10 integrity per rank.", why: "Supports the class promise of staying in the front line.", maxRank: 3, cost: 1, requires: ["v_tempered"], requiredTier: 1, effectsPerRank: { maxHealthAdd: 10 } },
      { id: "v_quake", label: "QUAKE CHANNEL", description: "+1 pierce per rank.", why: "Makes the heavy cleave readable against packed lanes.", maxRank: 2, cost: 1, requires: ["v_tempered"], requiredTier: 1, effectsPerRank: { piercesAdd: 1 } },
      { id: "v_guardian", label: "GUARDIAN RETURN", description: "Kills restore 0.3 integrity per rank.", why: "Rewards holding ground instead of retreating forever.", maxRank: 2, cost: 1, requires: ["v_bulwark"], requiredTier: 2, effectsPerRank: { healPerKill: 0.3 } },
      { id: "v_siege", label: "SIEGE TEMPO", description: "Weapon cycle is 5% faster per rank.", why: "Boss II specialization removes some heavy-weapon downtime.", maxRank: 2, cost: 1, requires: ["v_quake"], requiredTier: 2, effectsPerRank: { fireIntervalMult: 0.95 } },
      { id: "v_worldsplitter", label: "WORLDSPLITTER", description: "+22% damage and a 10-shot kill burst.", why: "Mythic capstone turns the greatsword into a crowd-breaking artifact.", maxRank: 1, cost: 3, requires: ["v_guardian", "v_siege"], requiredTier: 3, effectsPerRank: { damageMult: 1.22, clusterEveryKills: 5, clusterProjectilesAdd: 10 } },
    ],
  },
  spectre: {
    classId: "spectre",
    relicClass: "rogue",
    name: "NIGHT CIRCUIT",
    prototype: "WRAITH PROTOTYPE MONOBLADES",
    color: "#ff4b55",
    traits: [
      { id: "s_quicksilver", label: "QUICKSILVER", description: "Weapon cycle is 5% faster per rank.", why: "Directly strengthens Spectre's rapid-chain identity.", maxRank: 3, cost: 1, requires: [], requiredTier: 1, effectsPerRank: { fireIntervalMult: 0.95 } },
      { id: "s_predator", label: "PREDATOR STEP", description: "+4% speed per rank.", why: "Maintains Edge generation through movement.", maxRank: 3, cost: 1, requires: ["s_quicksilver"], requiredTier: 1, effectsPerRank: { speedMult: 1.04 } },
      { id: "s_serrated", label: "SERRATED SIGNAL", description: "+6% damage per rank.", why: "Raises finisher value without turning Spectre into a tank.", maxRank: 2, cost: 1, requires: ["s_quicksilver"], requiredTier: 1, effectsPerRank: { damageMult: 1.06 } },
      { id: "s_afterimage", label: "AFTERIMAGE", description: "+1 multishot per rank.", why: "Boss II specialization creates the twin-strike visual rhythm.", maxRank: 2, cost: 1, requires: ["s_predator"], requiredTier: 2, effectsPerRank: { multishotAdd: 1, spreadRadians: 0.08 } },
      { id: "s_bloodwire", label: "BLOODWIRE", description: "Kills restore 0.25 integrity per rank.", why: "Perfect chains provide limited sustain for the lowest-health class.", maxRank: 2, cost: 1, requires: ["s_serrated"], requiredTier: 2, effectsPerRank: { healPerKill: 0.25 } },
      { id: "s_zero", label: "ZERO TRACE", description: "+18% damage, +8% speed and faster cycle.", why: "Mythic capstone completes the high-risk momentum loop.", maxRank: 1, cost: 3, requires: ["s_afterimage", "s_bloodwire"], requiredTier: 3, effectsPerRank: { damageMult: 1.18, speedMult: 1.08, fireIntervalMult: 0.9 } },
    ],
  },
  vector: {
    classId: "vector",
    relicClass: "warlock",
    name: "NULL TESTAMENT",
    prototype: "RIFT PROTOTYPE GLAIVE",
    color: "#a66bff",
    traits: [
      { id: "r_voidreach", label: "VOID REACH", description: "+1.25m pickup radius per rank.", why: "Expands Riftweaver's zone of influence.", maxRank: 3, cost: 1, requires: [], requiredTier: 1, effectsPerRank: { pickupRadiusAdd: 1.25 } },
      { id: "r_soul", label: "SOUL CIRCUIT", description: "Kills restore 0.3 integrity per rank.", why: "Implements the class life-siphon promise.", maxRank: 3, cost: 1, requires: ["r_voidreach"], requiredTier: 1, effectsPerRank: { healPerKill: 0.3 } },
      { id: "r_hex", label: "HEXED EDGE", description: "+7% damage per rank.", why: "Cursed lanes become increasingly dangerous.", maxRank: 2, cost: 1, requires: ["r_voidreach"], requiredTier: 1, effectsPerRank: { damageMult: 1.07 } },
      { id: "r_conduit", label: "FEL CONDUIT", description: "+1 bounce per rank within 12m.", why: "Boss II specialization spreads curses across groups.", maxRank: 2, cost: 1, requires: ["r_soul"], requiredTier: 2, effectsPerRank: { bouncesAdd: 1, bounceRange: 12 } },
      { id: "r_rupture", label: "RIFT RUPTURE", description: "+1 pierce per rank.", why: "Rewards setting up clean ranged lanes.", maxRank: 2, cost: 1, requires: ["r_hex"], requiredTier: 2, effectsPerRank: { piercesAdd: 1 } },
      { id: "r_testament", label: "DARK TESTAMENT", description: "+20% damage, three bounces and stronger siphon.", why: "Mythic capstone turns setup into a full curse cascade.", maxRank: 1, cost: 3, requires: ["r_conduit", "r_rupture"], requiredTier: 3, effectsPerRank: { damageMult: 1.2, bouncesAdd: 3, bounceRange: 16, healPerKill: 0.5 } },
    ],
  },
};

export type ArtifactWeaponState = {
  tier: 0 | 1 | 2 | 3;
  power: number;
  points: number;
  traits: Record<string, number>;
};

export type ArtifactWeaponStates = Record<ArenaClassId, ArtifactWeaponState>;

export const createArtifactWeaponState = (): ArtifactWeaponState => ({
  tier: 0,
  power: 0,
  points: 0,
  traits: {},
});

export const createArtifactWeaponStates = (): ArtifactWeaponStates => ({
  vanguard: createArtifactWeaponState(),
  spectre: createArtifactWeaponState(),
  vector: createArtifactWeaponState(),
});

const applyEffects = (target: Required<ProgressionEffects>, effects: ProgressionEffects, ranks = 1) => {
  for (let rank = 0; rank < ranks; rank += 1) {
    if (effects.damageMult) target.damageMult *= effects.damageMult;
    if (effects.fireIntervalMult) target.fireIntervalMult *= effects.fireIntervalMult;
    if (effects.speedMult) target.speedMult *= effects.speedMult;
    target.bouncesAdd += effects.bouncesAdd ?? 0;
    target.bounceRange = Math.max(target.bounceRange, effects.bounceRange ?? 0);
    if (effects.clusterEveryKills) {
      target.clusterEveryKills = target.clusterEveryKills
        ? Math.min(target.clusterEveryKills, effects.clusterEveryKills)
        : effects.clusterEveryKills;
    }
    target.clusterProjectilesAdd += effects.clusterProjectilesAdd ?? 0;
    target.healPerKill += effects.healPerKill ?? 0;
    target.maxHealthAdd += effects.maxHealthAdd ?? 0;
    target.multishotAdd += effects.multishotAdd ?? 0;
    target.pickupRadiusAdd += effects.pickupRadiusAdd ?? 0;
    target.piercesAdd += effects.piercesAdd ?? 0;
    target.spreadRadians = Math.max(target.spreadRadians, effects.spreadRadians ?? 0);
  }
};

export const computePermanentProgressionEffects = (
  skillIds: string[],
  classId: ArenaClassId,
  artifact: ArtifactWeaponState
): ProgressionEffects => {
  const result: Required<ProgressionEffects> = {
    damageMult: 1,
    fireIntervalMult: 1,
    bouncesAdd: 0,
    bounceRange: 0,
    clusterEveryKills: 0,
    clusterProjectilesAdd: 0,
    healPerKill: 0,
    maxHealthAdd: 0,
    multishotAdd: 0,
    pickupRadiusAdd: 0,
    piercesAdd: 0,
    spreadRadians: 0,
    speedMult: 1,
  };
  for (const node of ARENA_SKILL_NODES) {
    if (node.id !== "core" && skillIds.includes(node.id)) applyEffects(result, node.effects);
  }
  for (const trait of ARTIFACT_WEAPONS[classId].traits) {
    const rank = Math.max(0, Math.min(trait.maxRank, artifact.traits[trait.id] ?? 0));
    if (rank > 0) applyEffects(result, trait.effectsPerRank, rank);
  }
  return result;
};

export const getArtifactPowerThreshold = (artifact: ArtifactWeaponState): number => {
  const spentRanks = Object.values(artifact.traits).reduce((sum, rank) => sum + rank, 0);
  return 100 + (spentRanks + artifact.points) * 35;
};
