"use client";

import {
  ArrowLeft,
  Crosshair,
  Heart,
  Magnet,
  Map,
  Pause,
  Play,
  Shield,
  Snowflake,
  Target,
  Zap,
} from "lucide-react";

export type GameHudSnapshot = {
  score: number;
  combo: number;
  lives: number;
  levelLabel: string;
  modeLabel: string;
  targetLabel: string;
  progress: number;
  powerLabel: string;
  powerProgress: number;
  sectionLabel: string;
  modifierLabel: string;
  modifierProgress: number;
  checkpointLabel: string;
  bestRankLabel: string;
  objectives: string[];
  bossActive: boolean;
  bossPhase: number;
  bossHealth: number;
  bossName: string;
  bossColor: string;
  eyeX: number;
  eyeY: number;
  eyeScale: number;
  eyeActive: boolean;
  lightningActive: boolean;
  lightningHue: number;
  lightningIntensity: number;
  lightningSpeed: number;
  lightningSize: number;
  lightningXOffset: number;
  isTestingBoss: boolean;
};

type GameHudProps = {
  hud: GameHudSnapshot;
  ownedSkills: string[];
  paused: boolean;
  hideAbilities?: boolean;
  hideMapButton?: boolean;
  hideObjectives?: boolean;
  onAbort: () => void;
  onOpenMap: () => void;
  onTogglePause: () => void;
};

const ABILITIES = [
  { key: "Q", label: "FREEZE", skill: "reflexes", icon: Snowflake, color: "#67e8f9" },
  { key: "E", label: "MAGNET", skill: "magnet2", icon: Magnet, color: "#f0abfc" },
  { key: "R", label: "BARRIER", skill: "shield", icon: Shield, color: "#60a5fa" },
  { key: "F", label: "BLAST", skill: "blast", icon: Crosshair, color: "#fb7185" },
] as const;

export default function GameHud({ hud, ownedSkills, paused, hideAbilities = false, hideMapButton = false, hideObjectives = false, onAbort, onOpenMap, onTogglePause }: GameHudProps) {
  const accent = hud.bossActive ? hud.bossColor : "#67e8f9";
  const primaryObjective = hud.objectives[0] ?? "Maintain neural link.";
  const objectives = hud.objectives.length > 0 ? hud.objectives.slice(0, 3) : [primaryObjective];
  const modifierActive = hud.modifierLabel !== "NONE" && hud.modifierProgress > 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 select-none text-white">
      <header className="absolute left-2 right-2 top-2 sm:left-3 sm:right-3 sm:top-3">
        <div className="grid h-[60px] grid-cols-[88px_minmax(0,1fr)_62px] gap-1.5 sm:h-[68px] sm:grid-cols-[180px_minmax(260px,1fr)_170px] sm:gap-2">
          <section className="relative min-w-0 overflow-hidden border border-white/12 bg-[#05070a]/92 px-2.5 py-2 sm:px-3">
            <div className="flex items-center gap-1.5 font-mono text-[7px] uppercase tracking-normal text-gray-500 sm:text-[8px] sm:tracking-normal">
              <Target className="h-2.5 w-2.5" /> <span className="hidden sm:inline">Core</span> Score
            </div>
            <div className="mt-0.5 truncate font-display text-[13px] tracking-normal text-white sm:text-lg sm:tracking-normal">
              {hud.score.toString().padStart(6, "0")}
            </div>
            <div className="mt-0.5 flex items-center gap-2 font-mono text-[7px] uppercase tracking-normal text-gray-400 sm:text-[8px]">
              <span>Combo x{hud.combo}</span>
              <span className="flex items-center gap-1"><Heart className="h-2.5 w-2.5 text-red-300" /> {hud.lives}</span>
            </div>
            <span className="absolute inset-y-0 left-0 w-px bg-cyan-200/70" />
          </section>

          <section className="relative min-w-0 overflow-hidden border border-white/12 bg-[#05070a]/94 px-2.5 py-2 sm:px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-mono text-[7px] uppercase tracking-normal text-gray-500 sm:text-[8px] sm:tracking-normal">
                  {hud.levelLabel}
                </div>
                <div className="truncate font-display text-[11px] uppercase tracking-normal text-white sm:text-sm sm:tracking-normal">
                  {hud.bossActive ? hud.bossName : hud.modeLabel}
                </div>
                <div className="truncate font-mono text-[6px] uppercase tracking-normal text-gray-500 sm:hidden">
                  {hud.targetLabel}
                </div>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <div className="font-mono text-[8px] uppercase tracking-normal" style={{ color: accent }}>
                  {hud.bossActive ? `Phase ${hud.bossPhase}` : hud.sectionLabel}
                </div>
                <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">{hud.targetLabel}</div>
              </div>
            </div>
            <div className="absolute inset-x-2.5 bottom-2 h-[3px] bg-white/10 sm:inset-x-4">
              <div className="h-full transition-[width] duration-150" style={{ width: `${Math.max(2, hud.progress * 100)}%`, background: accent }} />
            </div>
          </section>

          <section className="relative min-w-0 overflow-hidden border border-white/12 bg-[#05070a]/92 px-2 py-2 sm:px-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="hidden font-mono text-[8px] uppercase tracking-normal text-gray-500 sm:block">Power</div>
                <div className="truncate font-mono text-[7px] uppercase tracking-normal text-white sm:text-[10px] sm:tracking-normal">
                  {hud.powerLabel}
                </div>
              </div>
              <Zap className="hidden h-3.5 w-3.5 shrink-0 sm:block" style={{ color: hud.powerProgress > 0 ? "#fde68a" : "#6b7280" }} />
            </div>
            <div className="absolute inset-x-2 bottom-2 h-[3px] bg-white/10 sm:inset-x-3">
              <div className="h-full bg-amber-200 transition-[width] duration-150" style={{ width: `${hud.powerProgress * 100}%` }} />
            </div>
            <span className="absolute inset-y-0 right-0 w-px bg-red-400/65" />
          </section>
        </div>

        <div className="mt-1.5 flex min-w-0 items-start justify-between gap-1.5 sm:gap-2">
          {!hideObjectives && (
            <section className="flex h-8 min-w-0 flex-1 items-center gap-2 border border-white/10 bg-[#05070a]/88 px-2.5 xl:hidden">
              <Target className="h-3 w-3 shrink-0" style={{ color: accent }} />
              <span className="hidden shrink-0 font-mono text-[7px] uppercase tracking-normal text-gray-500 sm:inline">Objective</span>
              <div className="min-w-0 flex-1 truncate font-mono text-[8px] text-gray-300">{primaryObjective}</div>
            </section>
          )}

          {!hideObjectives && (
            <aside className="hidden w-[260px] border-l border-white/15 bg-[#05070a]/88 px-3 py-2.5 xl:block">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-normal text-gray-500">
                  <Target className="h-3 w-3" /> Objectives
                </div>
                <div className="truncate font-mono text-[8px] uppercase tracking-normal" style={{ color: accent }}>
                  {hud.sectionLabel}
                </div>
              </div>
              <div className="space-y-1.5">
                {objectives.map((objective, index) => (
                  <div key={`${objective}-${index}`} className="flex min-w-0 items-start gap-2 font-mono text-[9px] leading-relaxed text-gray-300">
                    <span className="mt-1.5 h-1 w-1 shrink-0" style={{ background: index === 0 ? accent : "#5f6670" }} />
                    <span>{objective}</span>
                  </div>
                ))}
              </div>
            </aside>
          )}

          <div className="pointer-events-auto ml-auto flex shrink-0 items-center gap-1.5">
            <div className="relative hidden h-8 min-w-[188px] overflow-hidden border border-white/10 bg-[#05070a]/88 px-2.5 py-2 font-mono text-[7px] uppercase tracking-normal text-gray-400 md:block">
              {hud.modifierLabel} / CP {hud.checkpointLabel} / RANK {hud.bestRankLabel}
              {modifierActive && (
                <span className="absolute inset-x-0 bottom-0 h-px bg-white/10">
                  <span className="block h-full" style={{ width: `${hud.modifierProgress * 100}%`, background: accent }} />
                </span>
              )}
            </div>
            {!hideMapButton && (
              <button
                type="button"
                onClick={onOpenMap}
                aria-label="Open mission map"
                title="Open mission map"
                className="flex h-8 w-8 items-center justify-center border border-white/10 bg-[#05070a]/92 text-gray-400 transition-colors hover:border-cyan-300/40 hover:text-white"
              >
                <Map className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onTogglePause}
              aria-label={paused ? "Resume mission" : "Pause mission"}
              title={paused ? "Resume mission" : "Pause mission"}
              className="flex h-8 w-8 items-center justify-center border border-white/10 bg-[#05070a]/92 text-gray-400 transition-colors hover:border-cyan-300/40 hover:text-white"
            >
              {paused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
            </button>
          </div>
        </div>
      </header>

      <button
        type="button"
        onClick={onAbort}
        aria-label="Abort mission"
        title="Abort mission"
        className="pointer-events-auto absolute bottom-2 left-2 flex h-9 items-center gap-2 border border-white/10 bg-[#05070a]/92 px-2.5 font-mono text-[8px] uppercase tracking-normal text-gray-500 transition-colors hover:border-red-400/50 hover:text-red-300 sm:bottom-3 sm:left-3 sm:h-10 sm:px-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Abort mission</span>
      </button>

      {!hideAbilities && (
        <div className="pointer-events-auto absolute bottom-2 left-1/2 flex -translate-x-1/2 items-end gap-1.5 sm:bottom-3 sm:gap-2">
          {ABILITIES.map(({ key, label, skill, icon: Icon, color }) => {
            const owned = ownedSkills.includes(skill);
            return (
              <div key={key} className="flex flex-col items-center gap-1">
                <div className="hidden font-mono text-[7px] uppercase tracking-normal md:block" style={{ color: owned ? color : "#3b4048" }}>
                  {owned ? label : "LOCKED"}
                </div>
                <div
                  className="relative flex h-9 w-9 items-center justify-center border bg-[#05070a]/92 sm:h-10 sm:w-10"
                  style={{ borderColor: owned ? `${color}88` : "rgba(255,255,255,0.1)" }}
                  title={`${key}: ${label}`}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: owned ? color : "#343941" }} />
                  <span className="absolute bottom-0.5 right-1 font-mono text-[6px] text-gray-500">{key}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
