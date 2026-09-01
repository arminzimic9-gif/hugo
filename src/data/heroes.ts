import type { HeroProfile } from "@/store/gameStore";

export type HeroArchetype = HeroProfile["archetype"];

export type HeroDefinition = {
  label: string;
  accent: string;
  image: string;
  model?: string;
  chassis: string;
  role: string;
  lore: string;
};

export const HEROES: Record<HeroArchetype, HeroDefinition> = {
  vanguard: {
    label: "VANGUARD",
    accent: "#00f2ff",
    image: "/images/operatives/vanguard.webp",
    model: "/models/operators/vanguard-animated.glb",
    chassis: "Bastion Harness",
    role: "Warrior · Frontline / Guard / Cleave",
    lore: "A human frontline pilot who builds Guard in close combat, blocks the counter-hit and spends that pressure on wide seismic cleaves.",
  },
  spectre: {
    label: "SPECTRE",
    accent: "#ff4b55",
    image: "/images/operatives/spectre.webp",
    model: "/models/operators/spectre.glb",
    chassis: "Wraith Harness",
    role: "Rogue · Assassin / Dash / Critical",
    lore: "A human momentum assassin who builds Edge while moving, dashes through priority targets and cashes out with fast twin-blade chains.",
  },
  vector: {
    label: "RIFTWEAVER",
    accent: "#a66bff",
    image: "/images/operatives/vector.webp",
    model: "/models/operators/vector.glb",
    chassis: "Rift Harness",
    role: "Warlock · Caster / Curse / Sustain",
    lore: "A human rift caster who builds Flux through pierced targets, groups enemies inside curse fields and siphons marked packs for sustain.",
  },
};

export const HERO_ARCHETYPES = Object.keys(HEROES) as HeroArchetype[];

export const getHeroDefinition = (archetype: HeroArchetype) => HEROES[archetype] ?? HEROES.vanguard;
