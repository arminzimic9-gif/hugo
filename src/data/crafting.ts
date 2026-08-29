export type MaterialId =
  | "iron_shard"
  | "crystal_dust"
  | "shadow_fiber"
  | "plasma_core"
  | "titanium_plate"
  | "gravity_stone"
  | "neon_circuit"
  | "void_thread"
  | "solar_fragment"
  | "ancient_gear_core";

export type MaterialDef = {
  id: MaterialId;
  name: string;
  description: string;
  value: number;
  color: string;
};

export const MATERIALS: MaterialDef[] = [
  { id: "iron_shard", name: "Iron Shard", description: "Osnovni metalni fragment.", value: 1, color: "#b7bec8" },
  { id: "crystal_dust", name: "Crystal Dust", description: "Energetski kristalni prah.", value: 2, color: "#9ff4ff" },
  { id: "shadow_fiber", name: "Shadow Fiber", description: "Tamni fleksibilni materijal.", value: 3, color: "#8a84d8" },
  { id: "plasma_core", name: "Plasma Core", description: "Nestabilno energetsko jezgro.", value: 4, color: "#ff5e4f" },
  { id: "titanium_plate", name: "Titanium Plate", description: "Teska stabilna ploca.", value: 5, color: "#d9dee6" },
  { id: "gravity_stone", name: "Gravity Stone", description: "Materijal koji utice na fiziku.", value: 6, color: "#6cc6ff" },
  { id: "neon_circuit", name: "Neon Circuit", description: "Reaktivni tehnoloski sklop.", value: 7, color: "#00ffc8" },
  { id: "void_thread", name: "Void Thread", description: "Rijedak vlaknasti void materijal.", value: 8, color: "#b27cff" },
  { id: "solar_fragment", name: "Solar Fragment", description: "Visokonaponski solarni fragment.", value: 9, color: "#ffd36b" },
  { id: "ancient_gear_core", name: "Ancient Gear Core", description: "Najrjedje endgame jezgro.", value: 10, color: "#ff9a8f" },
];

export const MATERIALS_BY_ID = Object.fromEntries(
  MATERIALS.map((item) => [item.id, item])
) as Record<MaterialId, MaterialDef>;

export type CraftingRecipeId =
  | "runner_boots"
  | "shadow_gloves"
  | "plasma_belt"
  | "titanium_chestplate"
  | "gravity_boots"
  | "neon_visor"
  | "void_cloak"
  | "solar_ring"
  | "ancient_stabilizer"
  | "dragon_engine";

export type CraftingRecipe = {
  id: CraftingRecipeId;
  name: string;
  unlockLevel: number;
  required: [MaterialId, MaterialId];
  statBoost: string;
  effectSummary: string;
};

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: "runner_boots",
    name: "Runner Boots",
    unlockLevel: 2,
    required: ["iron_shard", "crystal_dust"],
    statBoost: "+8% movement speed",
    effectSummary: "Brze putanje i ubrzanje.",
  },
  {
    id: "shadow_gloves",
    name: "Shadow Gloves",
    unlockLevel: 3,
    required: ["shadow_fiber", "crystal_dust"],
    statBoost: "+6% air control",
    effectSummary: "Fina kontrola u zraku.",
  },
  {
    id: "plasma_belt",
    name: "Plasma Belt",
    unlockLevel: 4,
    required: ["plasma_core", "iron_shard"],
    statBoost: "-12% dash cooldown",
    effectSummary: "Kratki boost impulse.",
  },
  {
    id: "titanium_chestplate",
    name: "Titanium Chestplate",
    unlockLevel: 5,
    required: ["titanium_plate", "iron_shard"],
    statBoost: "+1 hit protection",
    effectSummary: "Jedna greska vise uz cooldown.",
  },
  {
    id: "gravity_boots",
    name: "Gravity Boots",
    unlockLevel: 6,
    required: ["gravity_stone", "titanium_plate"],
    statBoost: "-10% fall speed",
    effectSummary: "+5% jump stability.",
  },
  {
    id: "neon_visor",
    name: "Neon Visor",
    unlockLevel: 7,
    required: ["neon_circuit", "crystal_dust"],
    statBoost: "0.4s warning",
    effectSummary: "Raniji warning za opasnosti.",
  },
  {
    id: "void_cloak",
    name: "Void Cloak",
    unlockLevel: 8,
    required: ["void_thread", "shadow_fiber"],
    statBoost: "0.25s phase dodge",
    effectSummary: "Cooldown 8s.",
  },
  {
    id: "solar_ring",
    name: "Solar Ring",
    unlockLevel: 9,
    required: ["solar_fragment", "plasma_core"],
    statBoost: "+12% speed burst",
    effectSummary: "Boost 1.5s svakih 5 core pickup-a.",
  },
  {
    id: "ancient_stabilizer",
    name: "Ancient Stabilizer",
    unlockLevel: 10,
    required: ["ancient_gear_core", "gravity_stone"],
    statBoost: "-20% knockback",
    effectSummary: "Stabilnija fizika i rebound.",
  },
  {
    id: "dragon_engine",
    name: "Dragon Engine",
    unlockLevel: 10,
    required: ["ancient_gear_core", "solar_fragment"],
    statBoost: "+6% speed/+6% air",
    effectSummary: "Emergency shield jednom po levelu.",
  },
];

export const CRAFTING_RECIPES_BY_ID = Object.fromEntries(
  CRAFTING_RECIPES.map((recipe) => [recipe.id, recipe])
) as Record<CraftingRecipeId, CraftingRecipe>;

export type MaterialInventory = Record<MaterialId, number>;

export const createEmptyMaterialInventory = (): MaterialInventory =>
  MATERIALS.reduce((acc, item) => {
    acc[item.id] = 0;
    return acc;
  }, {} as MaterialInventory);

export const getMaterialPoolForLevel = (level: number): MaterialId[] => {
  if (level <= 2) return ["iron_shard", "crystal_dust"];
  if (level <= 4) return ["shadow_fiber", "plasma_core"];
  if (level <= 6) return ["titanium_plate", "gravity_stone"];
  if (level <= 8) return ["neon_circuit", "void_thread"];
  if (level <= 10) return ["solar_fragment", "ancient_gear_core"];
  return MATERIALS.map((item) => item.id);
};

export const rollMaterialForLevel = (level: number, randomValue = Math.random()): MaterialId => {
  const pool = getMaterialPoolForLevel(level);
  const idx = Math.floor(Math.max(0, Math.min(0.9999, randomValue)) * pool.length);
  return pool[idx];
};

export const countMissingMaterials = (
  recipe: CraftingRecipe,
  inventory: Partial<MaterialInventory> | undefined
): number =>
  recipe.required.reduce((missing, id) => missing + ((inventory?.[id] ?? 0) > 0 ? 0 : 1), 0);

export const getMissingMaterialIds = (
  recipe: CraftingRecipe,
  inventory: Partial<MaterialInventory> | undefined
): MaterialId[] => recipe.required.filter((id) => (inventory?.[id] ?? 0) <= 0);

