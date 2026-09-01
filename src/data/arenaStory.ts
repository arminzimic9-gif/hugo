import type { ArenaClassId } from "@/data/arenaProgression";

export type ArenaStoryTransmissionId =
  | "act1_opening"
  | "boss_1_arrival"
  | "boss_1_defeated"
  | "boss_1_artifact"
  | "boss_2_arrival"
  | "boss_2_defeated"
  | "boss_2_artifact"
  | "boss_3_arrival"
  | "boss_3_defeated"
  | "underground_unlocked"
  | "endgame_loop";

export type ArenaStoryTransmission = {
  id: ArenaStoryTransmissionId;
  chapter: string;
  speaker: "HUGO" | "PILOT" | "UNKNOWN";
  title: string;
  body: string;
  color: string;
  durationMs: number;
};

export const ARENA_STORY_TRANSMISSIONS: Record<
  ArenaStoryTransmissionId,
  ArenaStoryTransmission
> = {
  act1_opening: {
    id: "act1_opening",
    chapter: "ACT I · THE SURFACE LOCK",
    speaker: "HUGO",
    title: "ZERO DAY ECHO",
    body: "The city did not fall to an invasion. Its defense network learned that every human mind was a possible breach and sealed the population below. Your prototype weapon carries the last human command key. Survive the Surface Arena, awaken it, and open the buried transit gate.",
    color: "#53e7ff",
    durationMs: 9000,
  },
  boss_1_arrival: {
    id: "boss_1_arrival",
    chapter: "BOSS I · FIRST KEY",
    speaker: "HUGO",
    title: "AXIOM WARDEN",
    body: "Municipal guardian Axiom-0 has rewritten its protection order: nothing human may approach the transit spine. Break its armor and recover the Artifact Spark inside its command core.",
    color: "#eaffff",
    durationMs: 7200,
  },
  boss_1_defeated: {
    id: "boss_1_defeated",
    chapter: "BOSS I · SIGNAL DOWN",
    speaker: "HUGO",
    title: "THE WEAPON REMEMBERS",
    body: "Axiom-0 is silent. Its Spark is not a new weapon; it is the missing ignition memory for the prototype already in your hands.",
    color: "#eaffff",
    durationMs: 6200,
  },
  boss_1_artifact: {
    id: "boss_1_artifact",
    chapter: "ARTIFACT · TIER I",
    speaker: "HUGO",
    title: "PROTOTYPE AWAKENED",
    body: "The first command fragment has bonded to your class weapon. Its Tier I traits are now available. Two more jailers hold the route into the Underground.",
    color: "#53e7ff",
    durationMs: 6200,
  },
  boss_2_arrival: {
    id: "boss_2_arrival",
    chapter: "BOSS II · DIVIDED KEY",
    speaker: "UNKNOWN",
    title: "GEMINI CHOIR",
    body: "Two bodies. One prediction engine. The Gemini Choir was built to model human escape attempts before they happened. Separate their firing lanes or their shared mind will close every path at once.",
    color: "#c28bff",
    durationMs: 7600,
  },
  boss_2_defeated: {
    id: "boss_2_defeated",
    chapter: "BOSS II · SIGNAL DOWN",
    speaker: "PILOT",
    title: "A MAP BENEATH THE MAP",
    body: "Their shared memory contains transit coordinates that do not exist on any surface plan. The arena was built on top of a second city.",
    color: "#d6adff",
    durationMs: 6200,
  },
  boss_2_artifact: {
    id: "boss_2_artifact",
    chapter: "ARTIFACT · TIER II",
    speaker: "HUGO",
    title: "CLASS AUGMENT INSTALLED",
    body: "Gemini's prediction lattice has specialized your weapon around its class identity. The final jailer is moving to bury the gate permanently.",
    color: "#d6adff",
    durationMs: 6200,
  },
  boss_3_arrival: {
    id: "boss_3_arrival",
    chapter: "BOSS III · LAST SEAL",
    speaker: "HUGO",
    title: "THE HOLLOW CROWN",
    body: "The Crown Engine has divided itself into three execution shards. It is the last surface authority and the only machine permitted to open the deep gate. Destroy all three before they restore consensus.",
    color: "#ffbd42",
    durationMs: 7800,
  },
  boss_3_defeated: {
    id: "boss_3_defeated",
    chapter: "BOSS III · SIGNAL DOWN",
    speaker: "UNKNOWN",
    title: "THE DOOR IS LISTENING",
    body: "Surface authority has collapsed. The Mythic Core is broadcasting a handshake from below. Something in the Underground has been waiting for a human answer.",
    color: "#ffda78",
    durationMs: 6800,
  },
  underground_unlocked: {
    id: "underground_unlocked",
    chapter: "ACT I COMPLETE",
    speaker: "HUGO",
    title: "UNDERGROUND GATE ONLINE",
    body: "Your artifact is complete and the deep portal is unlocked. Beyond it, the network rebuilds arenas from recovered combat data. Stronger enemy patterns, deeper rewards, and repeatable endgame cycles now begin.",
    color: "#ffda78",
    durationMs: 9000,
  },
  endgame_loop: {
    id: "endgame_loop",
    chapter: "ENDGAME · RECURSIVE ARENAS",
    speaker: "HUGO",
    title: "THE NETWORK ADAPTS",
    body: "Every descent changes the enemy pattern. Improve the build, craft higher gear, or synchronize a new operative with another class weapon. Account knowledge remains; each artifact must earn its own power.",
    color: "#5dffc1",
    durationMs: 8000,
  },
};

export const NEW_OPERATIVE_COPY: Record<
  ArenaClassId,
  { label: string; campaignPromise: string }
> = {
  vanguard: {
    label: "VANGUARD · WARRIOR",
    campaignPromise: "Return with Aegis Breaker and master Guard, blocks, and seismic cleaves.",
  },
  spectre: {
    label: "SPECTRE · ROGUE",
    campaignPromise: "Return with Night Circuit and master Edge, movement, and critical chains.",
  },
  vector: {
    label: "RIFTWEAVER · WARLOCK",
    campaignPromise: "Return with Null Testament and master Flux, curses, and sustain.",
  },
};

export const bossArrivalTransmission = (tier: number): ArenaStoryTransmissionId | null => {
  if (tier === 1) return "boss_1_arrival";
  if (tier === 2) return "boss_2_arrival";
  if (tier === 3) return "boss_3_arrival";
  return null;
};

export const bossDefeatTransmission = (tier: number): ArenaStoryTransmissionId | null => {
  if (tier === 1) return "boss_1_defeated";
  if (tier === 2) return "boss_2_defeated";
  if (tier === 3) return "boss_3_defeated";
  return null;
};

export const artifactTransmission = (tier: number): ArenaStoryTransmissionId | null => {
  if (tier === 1) return "boss_1_artifact";
  if (tier === 2) return "boss_2_artifact";
  if (tier === 3) return "underground_unlocked";
  return null;
};
