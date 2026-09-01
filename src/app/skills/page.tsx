"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, CircleDot, Cpu, Hammer, Lock, Sparkles, Swords, Zap } from "lucide-react";
import {
  ARTIFACT_WEAPONS,
  ARENA_CLASSES,
  ARENA_SKILL_NODES,
  SKILL_BRANCHES,
  getArtifactPowerThreshold,
} from "@/data/arenaProgression";
import {
  CRAFTING_RECIPES,
  MATERIALS_BY_ID,
  createEmptyMaterialInventory,
  getMissingMaterialIds,
} from "@/data/crafting";
import { ARENA_GEAR_CATALOG, ARENA_GEAR_RARITIES } from "@/data/arenaGear";
import { useGameStore } from "@/store/gameStore";

type ProgressionView = "matrix" | "artifact" | "crafting";

const VIEWS: Array<{ id: ProgressionView; label: string; Icon: typeof Cpu }> = [
  { id: "matrix", label: "SKILL MATRIX", Icon: Cpu },
  { id: "artifact", label: "ARTIFACT WEAPON", Icon: Swords },
  { id: "crafting", label: "GEAR CRAFTING", Icon: Hammer },
];

export default function SkillsPage() {
  const router = useRouter();
  const { username, hero, stats, unlockSkill, upgradeArtifactTrait, craftRecipe } = useGameStore();
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<ProgressionView>("matrix");
  const [selectedSkillId, setSelectedSkillId] = useState("core");
  const [selectedRecipeId, setSelectedRecipeId] = useState(CRAFTING_RECIPES[0]?.id);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const finishHydration = () => setMounted(true);
    if (useGameStore.persist.hasHydrated()) finishHydration();
    return useGameStore.persist.onFinishHydration(finishHydration);
  }, []);

  useEffect(() => {
    if (mounted && !username) router.push("/");
  }, [mounted, router, username]);

  const classDefinition = ARENA_CLASSES[hero.archetype];
  const artifactDefinition = ARTIFACT_WEAPONS[hero.archetype];
  const artifact = stats.artifactWeapons[hero.archetype];
  const artifactThreshold = getArtifactPowerThreshold(artifact);
  const materialInventory = stats.materials ?? createEmptyMaterialInventory();
  const selectedSkill = ARENA_SKILL_NODES.find((node) => node.id === selectedSkillId) ?? ARENA_SKILL_NODES[0];
  const selectedRecipe = CRAFTING_RECIPES.find((recipe) => recipe.id === selectedRecipeId) ?? CRAFTING_RECIPES[0];
  const unlocked = (id: string) => id === "core" || stats.skills.includes(id);
  const available = (id: string) => {
    const node = ARENA_SKILL_NODES.find((candidate) => candidate.id === id);
    return Boolean(node && !unlocked(id) && node.requires.every(unlocked));
  };
  const branchCounts = useMemo(
    () => Object.fromEntries(Object.keys(SKILL_BRANCHES).map((branch) => [branch, {
      total: ARENA_SKILL_NODES.filter((node) => node.branch === branch).length,
      active: ARENA_SKILL_NODES.filter((node) => node.branch === branch && unlocked(node.id)).length,
    }])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats.skills]
  );

  if (!mounted || !username) return null;

  const flashNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 1800);
  };
  const buySkill = (id: string) => {
    const node = ARENA_SKILL_NODES.find((candidate) => candidate.id === id);
    if (!node || !available(id)) return;
    flashNotice(unlockSkill(node.id, node.cost) ? `${node.label} ONLINE` : `NEED ${node.cost} SKILL POINT${node.cost === 1 ? "" : "S"}`);
  };
  const buyTrait = (traitId: string) => {
    const trait = artifactDefinition.traits.find((candidate) => candidate.id === traitId);
    flashNotice(upgradeArtifactTrait(traitId) ? `${trait?.label ?? "TRAIT"} UPGRADED` : "TRAIT REQUIREMENT NOT MET");
  };
  const getCraftState = (recipe: (typeof CRAFTING_RECIPES)[number]) => {
    const crafted = stats.craftedGear.includes(recipe.id);
    const levelReady = stats.level >= recipe.unlockLevel;
    const prerequisiteReady = !recipe.prerequisite || stats.craftedGear.includes(recipe.prerequisite);
    const missing = getMissingMaterialIds(recipe, materialInventory);
    return { crafted, levelReady, prerequisiteReady, missing, canCraft: !crafted && levelReady && prerequisiteReady && missing.length === 0 };
  };

  return (
    <main className="min-h-screen bg-[#030607] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-20 scanlines" />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#030607]/96 backdrop-blur-xl">
        <div className="flex min-h-20 flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-8">
          <button type="button" onClick={() => router.push("/hub")} className="flex items-center gap-2 font-mono text-[9px] tracking-[0.18em] text-gray-500 hover:text-white">
            <ChevronLeft className="h-4 w-4" /> CONTROL DECK
          </button>
          <nav className="grid grid-cols-3 border border-white/10">
            {VIEWS.map(({ id, label, Icon }) => (
              <button key={id} type="button" onClick={() => setView(id)} className="flex h-11 items-center justify-center gap-2 border-r border-white/10 px-3 font-mono text-[8px] last:border-r-0" style={{ color: view === id ? classDefinition.accent : "#68717e", background: view === id ? `${classDefinition.accent}12` : "transparent" }}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-6 text-right font-mono">
            <div><div className="text-[7px] text-gray-500">SKILL POINTS</div><div className="text-xl" style={{ color: classDefinition.accent }}>{stats.skillPoints}</div></div>
            <div><div className="text-[7px] text-gray-500">ACTIVE CLASS</div><div className="text-sm text-white">{classDefinition.label}</div></div>
          </div>
        </div>
      </header>

      {view === "matrix" ? (
        <section className="grid min-h-[calc(100vh-80px)] grid-cols-1 xl:grid-cols-[minmax(760px,1fr)_360px]">
          <div className="overflow-auto border-r border-white/10 p-4 md:p-7">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="font-mono text-[8px] tracking-[0.24em] text-cyan-200/60">PERMANENT ACCOUNT POWER</div>
                <h1 className="font-display text-3xl tracking-[0.12em]">CONNECTED SKILL MATRIX</h1>
                <p className="mt-2 max-w-2xl font-mono text-[9px] leading-relaxed text-gray-500">Every node below is loaded into Arena combat. Levels award one Skill Point; no node refers to retired campaign mechanics.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SKILL_BRANCHES).filter(([id]) => id !== "core").map(([id, branch]) => {
                  const count = branchCounts[id];
                  return <div key={id} className="border border-white/10 bg-black/45 px-2.5 py-2 font-mono text-[7px]" style={{ color: branch.color }}>{branch.label} {count.active}/{count.total}</div>;
                })}
              </div>
            </div>
            <div className="relative h-[820px] min-w-[760px] overflow-hidden border border-white/10 bg-black/35">
              <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "36px 36px" }} />
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {ARENA_SKILL_NODES.flatMap((node) => node.requires.map((requirementId) => {
                  const parent = ARENA_SKILL_NODES.find((candidate) => candidate.id === requirementId);
                  if (!parent) return null;
                  const active = unlocked(node.id) && unlocked(parent.id);
                  const color = SKILL_BRANCHES[node.branch].color;
                  return <line key={`${node.id}-${parent.id}`} x1={`${parent.x}%`} y1={`${parent.y}%`} x2={`${node.x}%`} y2={`${node.y}%`} stroke={active ? color : unlocked(parent.id) ? `${color}66` : "#202733"} strokeWidth={active ? 2.5 : 1} />;
                }))}
              </svg>
              {ARENA_SKILL_NODES.map((node) => {
                const active = unlocked(node.id);
                const ready = available(node.id);
                const selected = selectedSkill.id === node.id;
                const branch = SKILL_BRANCHES[node.branch];
                return (
                  <button key={node.id} type="button" onClick={() => setSelectedSkillId(node.id)} onDoubleClick={() => buySkill(node.id)} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{ left: `${node.x}%`, top: `${node.y}%` }}>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border bg-[#05080b] transition-transform hover:scale-105" style={{ borderColor: active || ready || selected ? branch.color : "#2c3440", color: active || ready ? branch.color : "#4e5865", boxShadow: active ? `0 0 18px ${branch.color}55` : selected ? `0 0 10px ${branch.color}33` : undefined }}>
                      {active ? <Check className="h-4 w-4" /> : ready ? <Zap className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
                    </span>
                    <span className="max-w-28 text-center font-mono text-[7px] leading-tight" style={{ color: active ? "#fff" : ready ? branch.color : "#59616c" }}>{node.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <aside className="bg-black/55 p-6 xl:sticky xl:top-20 xl:h-[calc(100vh-80px)]">
            <div className="font-mono text-[8px] tracking-[0.24em]" style={{ color: SKILL_BRANCHES[selectedSkill.branch].color }}>{SKILL_BRANCHES[selectedSkill.branch].label}</div>
            <h2 className="mt-2 font-display text-2xl tracking-[0.12em]">{selectedSkill.label}</h2>
            <p className="mt-4 font-mono text-[11px] leading-relaxed text-gray-300">{selectedSkill.description}</p>
            <div className="mt-4 border-l-2 border-white/10 pl-3 font-mono text-[9px] leading-relaxed text-gray-500">WHY: {selectedSkill.why}</div>
            <div className="mt-6 space-y-2 border-y border-white/10 py-5 font-mono text-[8px]">
              <div className="flex justify-between"><span className="text-gray-500">COST</span><span>{selectedSkill.cost} SKILL POINT{selectedSkill.cost === 1 ? "" : "S"}</span></div>
              <div className="flex justify-between gap-4"><span className="text-gray-500">REQUIRES</span><span className="text-right">{selectedSkill.requires.length ? selectedSkill.requires.join(" · ").toUpperCase() : "NONE"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">STATUS</span><span>{unlocked(selectedSkill.id) ? "ACTIVE" : available(selectedSkill.id) ? "READY" : "LOCKED"}</span></div>
            </div>
            <button type="button" disabled={!available(selectedSkill.id) || stats.skillPoints < selectedSkill.cost} onClick={() => buySkill(selectedSkill.id)} className="mt-6 w-full border px-4 py-4 text-left font-mono text-[9px] disabled:opacity-30" style={{ borderColor: SKILL_BRANCHES[selectedSkill.branch].color, color: SKILL_BRANCHES[selectedSkill.branch].color }}>
              {unlocked(selectedSkill.id) ? "NODE ACTIVE" : `UNLOCK · ${selectedSkill.cost} SP`}
            </button>
          </aside>
        </section>
      ) : null}

      {view === "artifact" ? (
        <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl grid-cols-1 lg:grid-cols-[360px_1fr]">
          <aside className="border-r border-white/10 bg-black/55 p-6 lg:p-8">
            <div className="font-mono text-[8px] tracking-[0.25em]" style={{ color: artifactDefinition.color }}>{classDefinition.fantasy} ARTIFACT</div>
            <h1 className="mt-2 font-display text-4xl tracking-[0.12em]">{artifactDefinition.name}</h1>
            <div className="mt-2 font-mono text-[9px] text-gray-500">STARTS AS · {artifactDefinition.prototype}</div>
            <div className="mt-7 grid grid-cols-2 gap-2">
              <div className="border border-white/10 bg-black/45 p-4"><div className="font-mono text-[7px] text-gray-500">AWAKENING TIER</div><div className="mt-1 font-display text-3xl">{artifact.tier}/3</div></div>
              <div className="border border-white/10 bg-black/45 p-4"><div className="font-mono text-[7px] text-gray-500">TRAIT POINTS</div><div className="mt-1 font-display text-3xl">{artifact.points}</div></div>
            </div>
            <div className="mt-5"><div className="flex justify-between font-mono text-[8px] text-gray-500"><span>ARTIFACT POWER</span><span>{artifact.power}/{artifactThreshold}</span></div><div className="mt-2 h-1.5 bg-white/10"><div className="h-full" style={{ width: `${Math.min(100, artifact.power / artifactThreshold * 100)}%`, background: artifactDefinition.color }} /></div></div>
            <div className="mt-7 space-y-3 border-t border-white/10 pt-6 font-mono text-[9px] leading-relaxed">
              <div><span className="text-gray-500">BOSS I</span><br />Artifact Spark awakens the prototype and opens Tier 1.</div>
              <div><span className="text-gray-500">BOSS II</span><br />Class Augment opens specialization traits.</div>
              <div><span className="text-gray-500">BOSS III</span><br />Mythic Core opens the capstone and Underground endgame.</div>
            </div>
          </aside>
          <div className="p-5 lg:p-9">
            <h2 className="font-display text-2xl tracking-[0.12em]">ARTIFACT TRAIT GRID</h2>
            <p className="mt-2 font-mono text-[9px] text-gray-500">Artifact Power becomes Trait Points. Boss tiers gate new rows; class choice determines the weapon and tree.</p>
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {artifactDefinition.traits.map((trait) => {
                const rank = artifact.traits[trait.id] ?? 0;
                const requirementsMet = trait.requires.every((id) => (artifact.traits[id] ?? 0) > 0);
                const tierMet = artifact.tier >= trait.requiredTier;
                const canBuy = tierMet && requirementsMet && rank < trait.maxRank && artifact.points >= trait.cost;
                return (
                  <article key={trait.id} className="border bg-black/45 p-4" style={{ borderColor: rank > 0 ? `${artifactDefinition.color}99` : "rgba(255,255,255,.1)" }}>
                    <div className="flex items-start justify-between gap-4"><div className="flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: tierMet ? artifactDefinition.color : "#343b45", color: tierMet ? artifactDefinition.color : "#4d5662" }}>{rank > 0 ? <Sparkles className="h-4 w-4" /> : tierMet ? <CircleDot className="h-4 w-4" /> : <Lock className="h-4 w-4" />}</div><div className="font-mono text-[8px] text-gray-500">TIER {trait.requiredTier} · RANK {rank}/{trait.maxRank}</div></div>
                    <h3 className="mt-4 font-display text-lg tracking-[0.1em]">{trait.label}</h3>
                    <p className="mt-2 font-mono text-[9px] leading-relaxed text-gray-300">{trait.description}</p>
                    <p className="mt-2 font-mono text-[8px] leading-relaxed text-gray-600">WHY: {trait.why}</p>
                    <button type="button" disabled={!canBuy} onClick={() => buyTrait(trait.id)} className="mt-4 w-full border px-3 py-2 font-mono text-[8px] disabled:opacity-25" style={{ borderColor: artifactDefinition.color, color: artifactDefinition.color }}>{rank >= trait.maxRank ? "MAX RANK" : !tierMet ? `DEFEAT BOSS ${trait.requiredTier}` : !requirementsMet ? "PREREQUISITE LOCKED" : `UPGRADE · ${trait.cost} AP`}</button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {view === "crafting" ? (
        <section className="mx-auto max-w-7xl p-5 lg:p-9">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="font-mono text-[8px] tracking-[0.25em] text-amber-200/70">MATERIAL → COMPONENT → GEAR</div><h1 className="font-display text-3xl tracking-[0.12em]">GEAR CRAFTING</h1><p className="mt-2 font-mono text-[9px] text-gray-500">Gear modifies the human pilot. Weapon-slot items are artifact modules; they never replace the class weapon.</p></div><div className="font-mono text-[9px] text-gray-400">{stats.craftedGear.length}/{CRAFTING_RECIPES.length} CRAFTED</div></div>
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {CRAFTING_RECIPES.map((recipe) => {
                const state = getCraftState(recipe);
                const gear = ARENA_GEAR_CATALOG[recipe.id];
                const rarity = ARENA_GEAR_RARITIES[gear.rarity];
                return <button key={recipe.id} type="button" onClick={() => setSelectedRecipeId(recipe.id)} className="border bg-black/45 p-4 text-left" style={{ borderColor: selectedRecipe?.id === recipe.id ? rarity.color : "rgba(255,255,255,.1)" }}><div className="flex justify-between font-mono text-[7px]" style={{ color: rarity.color }}><span>{rarity.label}</span><span>{gear.slot.toUpperCase()}</span></div><div className="mt-3 font-display text-lg tracking-[0.08em]">{recipe.name}</div><div className="mt-2 font-mono text-[9px] text-cyan-100">{recipe.statBoost}</div><div className="mt-1 font-mono text-[8px] text-gray-500">{state.crafted ? "CRAFTED" : state.canCraft ? "READY" : !state.levelReady ? `LEVEL ${recipe.unlockLevel}` : !state.prerequisiteReady ? `BUILD ${recipe.prerequisite?.replaceAll("_", " ").toUpperCase()} FIRST` : "MISSING MATERIAL"}</div></button>;
              })}
            </div>
            {selectedRecipe ? (() => {
              const state = getCraftState(selectedRecipe);
              const gear = ARENA_GEAR_CATALOG[selectedRecipe.id];
              const rarity = ARENA_GEAR_RARITIES[gear.rarity];
              return <aside className="border border-white/10 bg-black/55 p-6"><div className="font-mono text-[8px]" style={{ color: rarity.color }}>{rarity.label} · {gear.slot.toUpperCase()}</div><h2 className="mt-2 font-display text-2xl tracking-[0.1em]">{selectedRecipe.name}</h2><div className="mt-4 border-l-2 pl-3 font-mono text-[10px] text-cyan-100" style={{ borderColor: rarity.color }}>{selectedRecipe.statBoost}</div><p className="mt-3 font-mono text-[9px] leading-relaxed text-gray-400">{selectedRecipe.effectSummary}</p><p className="mt-3 font-mono text-[8px] leading-relaxed text-gray-500">PURPOSE: {selectedRecipe.purpose}</p><p className="mt-2 font-mono text-[8px] leading-relaxed" style={{ color: rarity.color }}>SYNERGY: {selectedRecipe.classSynergy}</p>{selectedRecipe.prerequisite ? <div className="mt-4 border border-white/10 px-3 py-2 font-mono text-[8px] text-gray-400">PREREQUISITE · {selectedRecipe.prerequisite.replaceAll("_", " ").toUpperCase()} · {state.prerequisiteReady ? "READY" : "LOCKED"}</div> : null}<div className="mt-6 space-y-2">{selectedRecipe.required.map((materialId) => { const material = MATERIALS_BY_ID[materialId]; const owned = materialInventory[materialId] ?? 0; const needed = selectedRecipe.amounts[materialId] ?? 1; return <div key={materialId} className="flex items-center justify-between border border-white/10 px-3 py-2 font-mono text-[9px]"><span style={{ color: material.color }}>{material.name}</span><span style={{ color: owned >= needed ? "#fff" : "#ff8a80" }}>{owned} / {needed}</span></div>; })}</div><button type="button" disabled={!state.canCraft} onClick={() => flashNotice(craftRecipe(selectedRecipe.id) ? `${selectedRecipe.name} CRAFTED` : "CRAFT REQUIREMENT NOT MET")} className="mt-6 w-full border px-4 py-4 font-mono text-[9px] disabled:opacity-25" style={{ borderColor: rarity.color, color: rarity.color }}>{state.crafted ? "CRAFTED" : state.canCraft ? "CRAFT AND AUTO-EQUIP IF SLOT IS EMPTY" : "REQUIREMENTS NOT MET"}</button></aside>;
            })() : null}
          </div>
        </section>
      ) : null}
      {notice ? <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-cyan-300/40 bg-black/90 px-5 py-3 font-mono text-[9px] tracking-[0.18em] text-cyan-100">{notice}</div> : null}
    </main>
  );
}
