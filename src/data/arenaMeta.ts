import RAW_ARENA_META_UNLOCKS from "@/data/arena-meta-unlocks.json";

export type ArenaMetaUnlock = {
  run: number;
  id: string;
  kind: "upgrade" | "operator" | "ability" | "credits";
  target: string;
  label: string;
  description: string;
};

export const ARENA_META_UNLOCKS = RAW_ARENA_META_UNLOCKS as ArenaMetaUnlock[];
