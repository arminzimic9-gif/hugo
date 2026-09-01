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
  amounts: Partial<Record<MaterialId, number>>;
  prerequisite?: CraftingRecipeId;
  statBoost: string;
  effectSummary: string;
  purpose: string;
  classSynergy: string;
};

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: "runner_boots",
    name: "Runner Boots",
    unlockLevel: 2,
    required: ["iron_shard", "crystal_dust"],
    amounts: { iron_shard: 2, crystal_dust: 1 },
    statBoost: "+8% movement speed",
    effectSummary: "Brze putanje i ubrzanje.",
    purpose: "Entry mobility gear for learning spacing and crossing the larger map.",
    classSynergy: "Best early fit: Spectre and Riftweaver.",
  },
  {
    id: "shadow_gloves",
    name: "Shadow Gloves",
    unlockLevel: 3,
    required: ["shadow_fiber", "crystal_dust"],
    amounts: { shadow_fiber: 2, crystal_dust: 1 },
    statBoost: "+6% air control",
    effectSummary: "Fina kontrola u zraku.",
    purpose: "Stabilizes attack recovery and evasive direction changes.",
    classSynergy: "Best early fit: Spectre.",
  },
  {
    id: "plasma_belt",
    name: "Plasma Belt",
    unlockLevel: 4,
    required: ["plasma_core", "iron_shard"],
    amounts: { plasma_core: 2, iron_shard: 2 },
    statBoost: "-12% dash cooldown",
    effectSummary: "Kratki boost impulse.",
    purpose: "First core module; trades raw defense for repeatable tempo.",
    classSynergy: "Best fit: Spectre or aggressive Vanguard.",
  },
  {
    id: "titanium_chestplate",
    name: "Titanium Chestplate",
    unlockLevel: 5,
    required: ["titanium_plate", "iron_shard"],
    amounts: { titanium_plate: 2, iron_shard: 3 },
    statBoost: "+1 hit protection",
    effectSummary: "Jedna greska vise uz cooldown.",
    purpose: "Reliable torso baseline before entering Underground pressure.",
    classSynergy: "Best fit: Vanguard; useful for every first clear.",
  },
  {
    id: "gravity_boots",
    name: "Gravity Boots",
    unlockLevel: 6,
    required: ["gravity_stone", "titanium_plate"],
    amounts: { gravity_stone: 2, titanium_plate: 2 },
    prerequisite: "runner_boots",
    statBoost: "-10% fall speed",
    effectSummary: "+5% jump stability.",
    purpose: "Tier-two leg upgrade built from the Runner Boots platform.",
    classSynergy: "Best fit: Riftweaver zone control and map traversal.",
  },
  {
    id: "neon_visor",
    name: "Neon Visor",
    unlockLevel: 7,
    required: ["neon_circuit", "crystal_dust"],
    amounts: { neon_circuit: 2, crystal_dust: 3 },
    statBoost: "0.4s warning",
    effectSummary: "Raniji warning za opasnosti.",
    purpose: "Makes boss telegraphs and portal hazards easier to read.",
    classSynergy: "Universal boss-learning item.",
  },
  {
    id: "void_cloak",
    name: "Void Cloak",
    unlockLevel: 8,
    required: ["void_thread", "shadow_fiber"],
    amounts: { void_thread: 2, shadow_fiber: 3 },
    prerequisite: "titanium_chestplate",
    statBoost: "0.25s phase dodge",
    effectSummary: "Cooldown 8s.",
    purpose: "Tier-two torso weave layered over the Titanium Chestplate.",
    classSynergy: "Best fit: Spectre; defensive alternative for Riftweaver.",
  },
  {
    id: "solar_ring",
    name: "Solar Artifact Socket",
    unlockLevel: 9,
    required: ["solar_fragment", "plasma_core"],
    amounts: { solar_fragment: 2, plasma_core: 3 },
    statBoost: "+12% speed burst",
    effectSummary: "Boost 1.5s svakih 5 core pickup-a.",
    purpose: "Weapon-slot module that amplifies the class artifact; it is not a replacement weapon.",
    classSynergy: "Universal artifact module with a strong Spectre tempo bias.",
  },
  {
    id: "ancient_stabilizer",
    name: "Ancient Stabilizer",
    unlockLevel: 10,
    required: ["ancient_gear_core", "gravity_stone"],
    amounts: { ancient_gear_core: 2, gravity_stone: 3 },
    prerequisite: "shadow_gloves",
    statBoost: "-20% knockback",
    effectSummary: "Stabilnija fizika i rebound.",
    purpose: "Legendary arm stabilizer built on the Shadow Gloves control layer.",
    classSynergy: "Best fit: Vanguard and precise Riftweaver lanes.",
  },
  {
    id: "dragon_engine",
    name: "Dragon Engine",
    unlockLevel: 10,
    required: ["ancient_gear_core", "solar_fragment"],
    amounts: { ancient_gear_core: 3, solar_fragment: 3 },
    prerequisite: "plasma_belt",
    statBoost: "+6% speed/+6% air",
    effectSummary: "Emergency shield jednom po levelu.",
    purpose: "Legendary core upgrade and the long-term crafting target for repeatable endgame.",
    classSynergy: "Universal capstone; highest value in hybrid builds.",
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
  recipe.required.reduce(
    (missing, id) => missing + Math.max(0, (recipe.amounts[id] ?? 1) - (inventory?.[id] ?? 0)),
    0
  );

export const getMissingMaterialIds = (
  recipe: CraftingRecipe,
  inventory: Partial<MaterialInventory> | undefined
): MaterialId[] =>
  recipe.required.filter((id) => (inventory?.[id] ?? 0) < (recipe.amounts[id] ?? 1));
