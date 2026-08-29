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
    model: "/models/operators/vanguard.glb",
    chassis: "Aegis 01",
    role: "Defense / Control",
    lore: "Teški front-runner sa stabilnom kontrolom i ojačanim defensive frameom.",
  },
  spectre: {
    label: "SPECTRE",
    accent: "#ff4b55",
    image: "/images/operatives/spectre.webp",
    model: "/models/operators/spectre.glb",
    chassis: "Shade 07",
    role: "Speed / Assault",
    lore: "Laki assault frame za agresivan tempo, brze promjene putanje i visok rizik.",
  },
  vector: {
    label: "VECTOR",
    accent: "#42f5c8",
    image: "/images/operatives/vector.webp",
    model: "/models/operators/vector.glb",
    chassis: "Prism 03",
    role: "Precision / Mobility",
    lore: "Precizni mobility frame sa naprednim senzorima i mirnijom kontrolom u zraku.",
  },
};

export const HERO_ARCHETYPES = Object.keys(HEROES) as HeroArchetype[];

export const getHeroDefinition = (archetype: HeroArchetype) => HEROES[archetype] ?? HEROES.vanguard;
