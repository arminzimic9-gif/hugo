"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Cpu, Hammer, Lock, Sparkles, Swords, Zap } from "lucide-react";
import {
  ARTIFACT_WEAPONS,
  ARENA_CLASSES,
  ARENA_SKILL_NODES,
  SKILL_BRANCHES,
  getArtifactPowerThreshold,
  type ArenaSkillNode,
  type ArtifactTrait,
  type SkillBranch,
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

// ---------------------------------------------------------------------------
// Uredan raspored stabla: redovi po dubini zavisnosti, kolone ravnomjerno.
// Isti algoritam pokrece Skill Matrix kolone i Artifact trait stablo.
// ---------------------------------------------------------------------------

type TreeNodeInput = { id: string; requires: string[] };
type TreeLayout = {
  positions: Record<string, { x: number; y: number }>;
  edges: Array<{ from: string; to: string }>;
  rows: number;
};

function layoutTree(nodes: TreeNodeInput[], rootIds: string[]): TreeLayout {
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const depthMemo: Record<string, number> = {};
  const depthOf = (id: string): number => {
    if (depthMemo[id] !== undefined) return depthMemo[id];
    depthMemo[id] = 0; // guard protiv ciklusa
    const node = byId[id];
    const parents = (node?.requires ?? []).filter((req) => byId[req]);
    const depth = parents.length ? 1 + Math.max(...parents.map(depthOf)) : 0;
    depthMemo[id] = depth;
    return depth;
  };
  nodes.forEach((node) => depthOf(node.id));

  const depths = nodes.map((node) => depthMemo[node.id]);
  const minDepth = Math.min(...depths);
  const maxDepth = Math.max(...depths);
  const rows = maxDepth - minDepth + 1;

  const rowBuckets: Record<number, string[]> = {};
  for (const node of nodes) {
    const row = depthMemo[node.id] - minDepth;
    (rowBuckets[row] ??= []).push(node.id);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  for (const [rowKey, ids] of Object.entries(rowBuckets)) {
    const row = Number(rowKey);
    ids.forEach((id, index) => {
      positions[id] = {
        x: ((index + 1) / (ids.length + 1)) * 100,
        y: ((row + 0.5) / rows) * 100,
      };
    });
  }

  const edges = nodes.flatMap((node) =>
    node.requires
      .filter((req) => byId[req] || rootIds.includes(req))
      .filter((req) => byId[req])
      .map((req) => ({ from: req, to: node.id }))
  );

  return { positions, edges, rows };
}

const BRANCH_ORDER: SkillBranch[] = ["assault", "fortitude", "mobility", "control", "convergence"];

const TIER_CORES = [
  { tier: 1 as const, numeral: "I", core: "ARTIFACT SPARK", boss: "AXIOM WARDEN" },
  { tier: 2 as const, numeral: "II", core: "CLASS AUGMENT", boss: "GEMINI CHOIR" },
  { tier: 3 as const, numeral: "III", core: "MYTHIC CORE", boss: "THE HOLLOW CROWN" },
];

function DiamondNode({
  color,
  state,
  size = 48,
  children,
}: {
  color: string;
  state: "active" | "ready" | "locked" | "selected";
  size?: number;
  children?: React.ReactNode;
}) {
  const borderColor = state === "locked" ? "#2c3440" : color;
  return (
    <span
      className="flex rotate-45 items-center justify-center border bg-[#05080b] transition-all"
      style={{
        width: size,
        height: size,
        borderColor,
        borderWidth: state === "active" ? 2 : 1,
        color: state === "locked" ? "#4e5865" : color,
        boxShadow:
          state === "active"
            ? `0 0 18px ${color}55`
            : state === "ready"
              ? `0 0 12px ${color}33`
              : state === "selected"
                ? `0 0 10px ${color}44`
                : undefined,
      }}
    >
      <span className="-rotate-45">{children}</span>
    </span>
  );
}

export default function SkillsPage() {
  const router = useRouter();
  const { username, hero, stats, unlockSkill, upgradeArtifactTrait, craftRecipe } = useGameStore();
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<ProgressionView>("matrix");
  const [selectedSkillId, setSelectedSkillId] = useState("core");
  const [selectedTraitId, setSelectedTraitId] = useState<string | null>(null);
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
  const selectedSkill =
    ARENA_SKILL_NODES.find((node) => node.id === selectedSkillId) ?? ARENA_SKILL_NODES[0];
  const selectedTrait =
    artifactDefinition.traits.find((trait) => trait.id === selectedTraitId) ?? null;
  const selectedRecipe =
    CRAFTING_RECIPES.find((recipe) => recipe.id === selectedRecipeId) ?? CRAFTING_RECIPES[0];

  const unlocked = (id: string) => id === "core" || stats.skills.includes(id);
  const available = (id: string) => {
    const node = ARENA_SKILL_NODES.find((candidate) => candidate.id === id);
    return Boolean(node && !unlocked(id) && node.requires.every(unlocked));
  };

  // Uredne kolone: po jedno mini-stablo za svaku granu.
  const branchLayouts = useMemo(() => {
    return BRANCH_ORDER.map((branchId) => {
      const nodes = ARENA_SKILL_NODES.filter((node) => node.branch === branchId);
      return { branchId, nodes, layout: layoutTree(nodes, ["core"]) };
    });
  }, []);

  const traitLayout = useMemo(
    () => layoutTree(artifactDefinition.traits, []),
    [artifactDefinition]
  );

  if (!mounted || !username) return null;

  const flashNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 1800);
  };
  const buySkill = (id: string) => {
    const node = ARENA_SKILL_NODES.find((candidate) => candidate.id === id);
    if (!node || !available(id)) return;
    flashNotice(
      unlockSkill(node.id, node.cost)
        ? `${node.label} ONLINE`
        : `NEED ${node.cost} SKILL POINT${node.cost === 1 ? "" : "S"}`
    );
  };
  const buyTrait = (traitId: string) => {
    const trait = artifactDefinition.traits.find((candidate) => candidate.id === traitId);
    flashNotice(
      upgradeArtifactTrait(traitId)
        ? `${trait?.label ?? "TRAIT"} UPGRADED`
        : "TRAIT REQUIREMENT NOT MET"
    );
  };
  const getCraftState = (recipe: (typeof CRAFTING_RECIPES)[number]) => {
    const crafted = stats.craftedGear.includes(recipe.id);
    const levelReady = stats.level >= recipe.unlockLevel;
    const prerequisiteReady = !recipe.prerequisite || stats.craftedGear.includes(recipe.prerequisite);
    const missing = getMissingMaterialIds(recipe, materialInventory);
    return {
      crafted,
      levelReady,
      prerequisiteReady,
      missing,
      canCraft: !crafted && levelReady && prerequisiteReady && missing.length === 0,
    };
  };

  const traitState = (trait: ArtifactTrait) => {
    const rank = artifact.traits[trait.id] ?? 0;
    const requirementsMet = trait.requires.every((id) => (artifact.traits[id] ?? 0) > 0);
    const tierMet = artifact.tier >= trait.requiredTier;
    const canBuy = tierMet && requirementsMet && rank < trait.maxRank && artifact.points >= trait.cost;
    return { rank, requirementsMet, tierMet, canBuy };
  };

  const skillNodeState = (node: ArenaSkillNode): "active" | "ready" | "locked" | "selected" => {
    if (unlocked(node.id)) return "active";
    if (available(node.id)) return "ready";
    return "locked";
  };

  return (
    <main className="min-h-screen bg-[#030607] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-20 scanlines" />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#030607]/96 backdrop-blur-xl">
        <div className="flex min-h-20 flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-8">
          <button
            type="button"
            onClick={() => router.push("/hub")}
            className="flex items-center gap-2 font-mono text-[9px] tracking-[0.18em] text-gray-500 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" /> CONTROL DECK
          </button>
          <nav className="grid grid-cols-3 border border-white/10">
            {VIEWS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className="flex h-11 items-center justify-center gap-2 border-r border-white/10 px-3 font-mono text-[8px] last:border-r-0"
                style={{
                  color: view === id ? classDefinition.accent : "#68717e",
                  background: view === id ? `${classDefinition.accent}12` : "transparent",
                }}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-6 text-right font-mono">
            <div>
              <div className="text-[7px] text-gray-500">SKILL POINTS</div>
              <div className="text-xl" style={{ color: classDefinition.accent }}>{stats.skillPoints}</div>
            </div>
            <div>
              <div className="text-[7px] text-gray-500">ACTIVE CLASS</div>
              <div className="text-sm text-white">{classDefinition.label}</div>
            </div>
          </div>
        </div>
      </header>

      {view === "matrix" ? (
        <section className="grid min-h-[calc(100vh-80px)] grid-cols-1 xl:grid-cols-[1fr_350px]">
          <div className="overflow-auto border-r border-white/10 p-4 md:p-7">
            <div className="mb-5">
              <div className="font-mono text-[8px] tracking-[0.24em] text-cyan-200/60">
                PERMANENT ACCOUNT POWER · ALL CLASSES
              </div>
              <h1 className="font-display text-3xl tracking-[0.12em]">SKILL MATRIX</h1>
              <p className="mt-2 max-w-2xl font-mono text-[9px] leading-relaxed text-gray-500">
                Five disciplines, one core. Every node is loaded into Arena combat. Click a node to
                inspect it; unlock it from the panel or with a double-click.
              </p>
            </div>

            {/* Core cvor iznad kolona */}
            <div className="mb-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedSkillId("core")}
                className="flex flex-col items-center gap-2"
              >
                <DiamondNode color="#ffffff" state={selectedSkillId === "core" ? "selected" : "active"} size={56}>
                  <Cpu className="h-5 w-5" />
                </DiamondNode>
                <span className="font-mono text-[8px] tracking-[0.3em] text-white">HUGO CORE</span>
              </button>
            </div>

            {/* Pet urednih kolona — po jedna za svaku granu */}
            <div className="grid gap-3 md:grid-cols-3 2xl:grid-cols-5">
              {branchLayouts.map(({ branchId, nodes, layout }) => {
                const branch = SKILL_BRANCHES[branchId];
                const active = nodes.filter((node) => unlocked(node.id)).length;
                const panelHeight = Math.max(300, layout.rows * 108);
                return (
                  <div key={branchId} className="border border-white/10 bg-black/35">
                    <div
                      className="flex items-center justify-between border-b px-3 py-2 font-mono text-[8px] tracking-[0.22em]"
                      style={{ borderColor: `${branch.color}44`, color: branch.color }}
                    >
                      <span>{branch.label}</span>
                      <span>{active}/{nodes.length}</span>
                    </div>
                    <div className="relative" style={{ height: panelHeight }}>
                      <svg className="pointer-events-none absolute inset-0 h-full w-full">
                        {layout.edges.map(({ from, to }) => {
                          const a = layout.positions[from];
                          const b = layout.positions[to];
                          if (!a || !b) return null;
                          const lit = unlocked(from) && unlocked(to);
                          const half = unlocked(from);
                          return (
                            <line
                              key={`${from}-${to}`}
                              x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`}
                              stroke={lit ? branch.color : half ? `${branch.color}55` : "#1d2430"}
                              strokeWidth={lit ? 2 : 1}
                            />
                          );
                        })}
                      </svg>
                      {nodes.map((node) => {
                        const position = layout.positions[node.id];
                        const state = skillNodeState(node);
                        const displayState = selectedSkillId === node.id && state === "locked" ? "selected" : state;
                        const crossRequires = node.requires.filter(
                          (req) => req !== "core" && !nodes.some((sibling) => sibling.id === req)
                        );
                        return (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => setSelectedSkillId(node.id)}
                            onDoubleClick={() => buySkill(node.id)}
                            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
                            style={{ left: `${position.x}%`, top: `${position.y}%` }}
                          >
                            <DiamondNode color={branch.color} state={displayState} size={44}>
                              {state === "active" ? (
                                <Check className="h-4 w-4" />
                              ) : state === "ready" ? (
                                <Zap className="h-4 w-4" />
                              ) : (
                                <Lock className="h-3.5 w-3.5" />
                              )}
                            </DiamondNode>
                            <span
                              className="max-w-24 text-center font-mono text-[6.5px] leading-tight tracking-wide"
                              style={{ color: state === "active" ? "#fff" : state === "ready" ? branch.color : "#59616c" }}
                            >
                              {node.label}
                            </span>
                            {crossRequires.length ? (
                              <span className="font-mono text-[6px] text-gray-600">
                                REQ: {crossRequires.join(" · ").toUpperCase()}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="bg-black/55 p-6 xl:sticky xl:top-20 xl:h-[calc(100vh-80px)]">
            <div
              className="font-mono text-[8px] tracking-[0.24em]"
              style={{ color: SKILL_BRANCHES[selectedSkill.branch].color }}
            >
              {SKILL_BRANCHES[selectedSkill.branch].label}
            </div>
            <h2 className="mt-2 font-display text-2xl tracking-[0.12em]">{selectedSkill.label}</h2>
            <p className="mt-4 font-mono text-[11px] leading-relaxed text-gray-300">
              {selectedSkill.description}
            </p>
            <div className="mt-4 border-l-2 border-white/10 pl-3 font-mono text-[9px] leading-relaxed text-gray-500">
              WHY: {selectedSkill.why}
            </div>
            <div className="mt-6 space-y-2 border-y border-white/10 py-5 font-mono text-[8px]">
              <div className="flex justify-between">
                <span className="text-gray-500">COST</span>
                <span>{selectedSkill.cost} SKILL POINT{selectedSkill.cost === 1 ? "" : "S"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">REQUIRES</span>
                <span className="text-right">
                  {selectedSkill.requires.length ? selectedSkill.requires.join(" · ").toUpperCase() : "NONE"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">STATUS</span>
                <span>
                  {unlocked(selectedSkill.id) ? "ACTIVE" : available(selectedSkill.id) ? "READY" : "LOCKED"}
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={!available(selectedSkill.id) || stats.skillPoints < selectedSkill.cost}
              onClick={() => buySkill(selectedSkill.id)}
              className="mt-6 w-full border px-4 py-4 text-left font-mono text-[9px] disabled:opacity-30"
              style={{
                borderColor: SKILL_BRANCHES[selectedSkill.branch].color,
                color: SKILL_BRANCHES[selectedSkill.branch].color,
              }}
            >
              {unlocked(selectedSkill.id) ? "NODE ACTIVE" : `UNLOCK · ${selectedSkill.cost} SP`}
            </button>
          </aside>
        </section>
      ) : null}

      {view === "artifact" ? (
        <section className="mx-auto min-h-[calc(100vh-80px)] max-w-7xl p-5 lg:p-9">
          <div className="mb-2 font-mono text-[8px] tracking-[0.25em]" style={{ color: artifactDefinition.color }}>
            {classDefinition.fantasy} ARTIFACT · PER-CLASS PROGRESSION
          </div>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <h1 className="font-display text-4xl tracking-[0.12em]">{artifactDefinition.name}</h1>
            <div className="font-mono text-[9px] text-gray-500">STARTS AS · {artifactDefinition.prototype}</div>
          </div>

          {/* Tier kartice — Quironax stil: rimski broj, jezgra, power prsten */}
          <div className="grid gap-3 md:grid-cols-3">
            {TIER_CORES.map(({ tier, numeral, core, boss }) => {
              const claimed = artifact.tier >= tier;
              const isNext = artifact.tier === tier - 1;
              const ringProgress = Math.min(1, artifact.power / artifactThreshold);
              const circumference = 2 * Math.PI * 44;
              return (
                <div
                  key={tier}
                  className="relative flex items-center gap-5 border bg-black/40 p-5"
                  style={{
                    borderColor: claimed ? `${artifactDefinition.color}88` : isNext ? `${artifactDefinition.color}44` : "rgba(255,255,255,.08)",
                    boxShadow: claimed ? `inset 0 0 40px ${artifactDefinition.color}0d` : undefined,
                    opacity: claimed || isNext ? 1 : 0.55,
                  }}
                >
                  <div className="relative h-24 w-24 shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3" />
                      {claimed ? (
                        <circle cx="50" cy="50" r="44" fill="none" stroke={artifactDefinition.color} strokeWidth="3" />
                      ) : isNext ? (
                        <circle
                          cx="50" cy="50" r="44" fill="none"
                          stroke={artifactDefinition.color} strokeWidth="3"
                          strokeDasharray={`${ringProgress * circumference} ${circumference}`}
                          strokeLinecap="butt"
                        />
                      ) : null}
                    </svg>
                    <div
                      className="absolute inset-0 flex items-center justify-center font-display text-3xl"
                      style={{ color: claimed || isNext ? artifactDefinition.color : "#3d4552" }}
                    >
                      {numeral}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-base tracking-[0.1em] text-white">{core}</div>
                    <div className="mt-1 font-mono text-[8px] leading-relaxed text-gray-500">
                      {claimed ? (
                        <span style={{ color: artifactDefinition.color }}>CLAIMED</span>
                      ) : (
                        <>DEFEAT <span className="text-gray-300">{boss}</span></>
                      )}
                    </div>
                    {isNext && !claimed ? (
                      <div className="mt-2 font-mono text-[8px] text-gray-400">
                        POWER {artifact.power}/{artifactThreshold} → +1 TRAIT POINT
                      </div>
                    ) : null}
                    {claimed && tier === artifact.tier ? (
                      <div className="mt-2 font-mono text-[8px]" style={{ color: artifactDefinition.color }}>
                        {artifact.points} TRAIT POINT{artifact.points === 1 ? "" : "S"} · POWER {artifact.power}/{artifactThreshold}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trait stablo — pravo stablo sa linijama, rank pipovima i tier kapijama */}
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_330px]">
            <div className="border border-white/10 bg-black/35">
              <div className="border-b border-white/10 px-4 py-2 font-mono text-[8px] tracking-[0.24em] text-gray-500">
                TRAIT TREE · ARTIFACT POWER → TRAIT POINTS → RANKS
              </div>
              <div className="relative" style={{ height: Math.max(360, traitLayout.rows * 130) }}>
                <svg className="pointer-events-none absolute inset-0 h-full w-full">
                  {traitLayout.edges.map(({ from, to }) => {
                    const a = traitLayout.positions[from];
                    const b = traitLayout.positions[to];
                    if (!a || !b) return null;
                    const lit = (artifact.traits[from] ?? 0) > 0 && (artifact.traits[to] ?? 0) > 0;
                    const half = (artifact.traits[from] ?? 0) > 0;
                    return (
                      <line
                        key={`${from}-${to}`}
                        x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`}
                        stroke={lit ? artifactDefinition.color : half ? `${artifactDefinition.color}55` : "#1d2430"}
                        strokeWidth={lit ? 2 : 1}
                      />
                    );
                  })}
                </svg>
                {artifactDefinition.traits.map((trait) => {
                  const position = traitLayout.positions[trait.id];
                  const state = traitState(trait);
                  const nodeState =
                    state.rank > 0 ? "active" : state.tierMet && state.requirementsMet ? "ready" : "locked";
                  return (
                    <button
                      key={trait.id}
                      type="button"
                      onClick={() => setSelectedTraitId(trait.id)}
                      onDoubleClick={() => buyTrait(trait.id)}
                      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
                      style={{ left: `${position.x}%`, top: `${position.y}%` }}
                    >
                      <DiamondNode
                        color={artifactDefinition.color}
                        state={selectedTraitId === trait.id && nodeState === "locked" ? "selected" : nodeState}
                        size={52}
                      >
                        {state.rank > 0 ? (
                          <Sparkles className="h-4 w-4" />
                        ) : nodeState === "ready" ? (
                          <Zap className="h-4 w-4" />
                        ) : (
                          <Lock className="h-4 w-4" />
                        )}
                      </DiamondNode>
                      <span
                        className="max-w-28 text-center font-mono text-[7px] leading-tight"
                        style={{ color: state.rank > 0 ? "#fff" : nodeState === "ready" ? artifactDefinition.color : "#59616c" }}
                      >
                        {trait.label}
                      </span>
                      <span className="flex items-center gap-1">
                        {Array.from({ length: trait.maxRank }, (_, pip) => (
                          <span
                            key={pip}
                            className="h-1 w-3"
                            style={{
                              background: pip < state.rank ? artifactDefinition.color : "rgba(255,255,255,.14)",
                              boxShadow: pip < state.rank ? `0 0 6px ${artifactDefinition.color}66` : undefined,
                            }}
                          />
                        ))}
                      </span>
                      {!state.tierMet ? (
                        <span className="font-mono text-[6px] text-gray-600">TIER {trait.requiredTier}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="border border-white/10 bg-black/55 p-6">
              {selectedTrait ? (
                (() => {
                  const state = traitState(selectedTrait);
                  return (
                    <>
                      <div className="font-mono text-[8px] tracking-[0.24em]" style={{ color: artifactDefinition.color }}>
                        TIER {selectedTrait.requiredTier} TRAIT · RANK {state.rank}/{selectedTrait.maxRank}
                      </div>
                      <h2 className="mt-2 font-display text-2xl tracking-[0.1em]">{selectedTrait.label}</h2>
                      <p className="mt-4 font-mono text-[11px] leading-relaxed text-gray-300">
                        {selectedTrait.description}
                      </p>
                      <div className="mt-4 border-l-2 border-white/10 pl-3 font-mono text-[9px] leading-relaxed text-gray-500">
                        WHY: {selectedTrait.why}
                      </div>
                      <div className="mt-6 space-y-2 border-y border-white/10 py-5 font-mono text-[8px]">
                        <div className="flex justify-between">
                          <span className="text-gray-500">COST</span>
                          <span>{selectedTrait.cost} TRAIT POINT{selectedTrait.cost === 1 ? "" : "S"}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500">REQUIRES</span>
                          <span className="text-right">
                            {selectedTrait.requires.length ? selectedTrait.requires.join(" · ").toUpperCase() : "NONE"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">GATE</span>
                          <span>{state.tierMet ? "TIER OPEN" : `DEFEAT BOSS ${selectedTrait.requiredTier}`}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!state.canBuy}
                        onClick={() => buyTrait(selectedTrait.id)}
                        className="mt-6 w-full border px-4 py-4 text-left font-mono text-[9px] disabled:opacity-30"
                        style={{ borderColor: artifactDefinition.color, color: artifactDefinition.color }}
                      >
                        {state.rank >= selectedTrait.maxRank
                          ? "MAX RANK"
                          : !state.tierMet
                            ? `DEFEAT BOSS ${selectedTrait.requiredTier}`
                            : !state.requirementsMet
                              ? "PREREQUISITE LOCKED"
                              : `UPGRADE · ${selectedTrait.cost} AP`}
                      </button>
                    </>
                  );
                })()
              ) : (
                <div className="font-mono text-[9px] leading-relaxed text-gray-500">
                  <div className="mb-3 text-[8px] tracking-[0.24em] text-gray-400">HOW IT WORKS</div>
                  Boss cores open tiers. Artifact Residue builds Power; each threshold grants a Trait
                  Point. Click a trait to inspect it; double-click to upgrade.
                  <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                    <div><span className="text-gray-500">BOSS I</span><br />Artifact Spark — awakens the prototype, opens Tier 1.</div>
                    <div><span className="text-gray-500">BOSS II</span><br />Class Augment — opens specialization traits.</div>
                    <div><span className="text-gray-500">BOSS III</span><br />Mythic Core — capstone and the Underground gate.</div>
                  </div>
                </div>
              )}
            </aside>
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
