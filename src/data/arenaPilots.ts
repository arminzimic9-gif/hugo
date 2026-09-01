export const ARENA_PILOT_BODIES = ["male", "female"] as const;

export type ArenaPilotBody = (typeof ARENA_PILOT_BODIES)[number];

export type ArenaPilotAnimationSet = {
  walk: string;
  run: string;
  combatStance: string;
  combatWalk: string;
  meleeAttack: string;
  warriorAttack: string;
  rogueAttack: string;
  warlockAttack: string;
};

type ArenaPilotDefinition = {
  label: string;
  descriptor: string;
  image: string;
  model: string;
  animations: ArenaPilotAnimationSet;
};

export const ARENA_PILOTS: Record<ArenaPilotBody, ArenaPilotDefinition> = {
  male: {
    label: "MALE PILOT",
    descriptor: "SYSTEMS ENGINEER / FIELD OPERATIVE",
    image: "/images/pilots/pilot-male.png",
    model: "/models/pilots/pilot-male-meshy-combat.glb",
    animations: {
      walk: "/models/pilots/animations/pilot-male-walk.glb",
      run: "/models/pilots/animations/pilot-male-run.glb",
      combatStance: "/models/pilots/animations/pilot-male-combat-stance.glb",
      combatWalk: "/models/pilots/animations/pilot-male-combat-walk.glb",
      meleeAttack: "/models/pilots/animations/pilot-male-melee-attack.glb",
      warriorAttack: "/models/pilots/animations/pilot-male-warrior-attack.glb",
      rogueAttack: "/models/pilots/animations/pilot-male-rogue-attack.glb",
      warlockAttack: "/models/pilots/animations/pilot-male-warlock-attack.glb",
    },
  },
  female: {
    label: "FEMALE PILOT",
    descriptor: "SYSTEMS ENGINEER / FIELD OPERATIVE",
    image: "/images/pilots/pilot-female.png",
    model: "/models/pilots/pilot-female-meshy-combat.glb",
    animations: {
      walk: "/models/pilots/animations/pilot-female-walk.glb",
      run: "/models/pilots/animations/pilot-female-run.glb",
      combatStance: "/models/pilots/animations/pilot-female-combat-stance.glb",
      combatWalk: "/models/pilots/animations/pilot-female-combat-walk.glb",
      meleeAttack: "/models/pilots/animations/pilot-female-melee-attack.glb",
      warriorAttack: "/models/pilots/animations/pilot-female-warrior-attack.glb",
      rogueAttack: "/models/pilots/animations/pilot-female-rogue-attack.glb",
      warlockAttack: "/models/pilots/animations/pilot-female-warlock-attack.glb",
    },
  },
};

export const isArenaPilotBody = (value: unknown): value is ArenaPilotBody =>
  typeof value === "string" && ARENA_PILOT_BODIES.includes(value as ArenaPilotBody);
