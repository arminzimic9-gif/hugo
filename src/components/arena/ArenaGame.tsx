"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import {
  Bomb,
  Crosshair,
  Gauge,
  Magnet,
  Share2,
  Shield,
  Zap,
  type LucideIcon,
} from "lucide-react";
import ARENA_CONFIG from "@/data/arena-config.json";
import ARENA_UPGRADES from "@/data/arena-upgrades.json";
import ARENA_ABILITIES from "@/data/arena-abilities.json";
import ARENA_EVOLUTIONS from "@/data/arena-evolutions.json";
import GEAR_MODS from "@/data/arena-gear-mods.json";
import { getArenaGearPower } from "@/data/arenaGear";
import { ARENA_PILOTS } from "@/data/arenaPilots";
import type { CraftingRecipeId } from "@/data/crafting";
import { HEROES, HERO_ARCHETYPES } from "@/data/heroes";
import { ARENA_OPERATORS, type ArenaOperatorDefinition } from "@/data/arenaOperators";
import { ARENA_META_UNLOCKS } from "@/data/arenaMeta";
import { ARENA_CONTRACTS_BY_ID } from "@/data/arenaContracts";
import { ARENA_POWER_DROPS } from "@/data/arenaPowerDrops";
import {
  ARENA_STORY_SPEAKERS,
  ARENA_STORY_TRANSMISSIONS,
  NEW_OPERATIVE_COPY,
} from "@/data/arenaStory";
import { ARENA_BOSSES } from "@/data/arenaBosses";
import {
  ARENA_CLASSES,
  ARENA_SKILL_NODES,
  SKILL_BRANCHES,
  computePermanentProgressionEffects,
  type ArenaClassId,
  type ProgressionEffects,
} from "@/data/arenaProgression";
import { arenaAudio } from "@/lib/arenaAudio";
import { getArenaWaveState } from "@/lib/arenaWaves";
import { useGameStore } from "@/store/gameStore";
import {
  COMBO_MILESTONES,
  useArenaSession,
  type GearMods,
  type ArenaRelicClass,
} from "@/store/arenaSession";
import {
  ArenaWorldContext,
  createArenaWorld,
  type ArenaControlMode,
  type ArenaWorld,
} from "./world";
import ArenaScene from "./ArenaScene";

const CAMERA = ARENA_CONFIG.camera;

const UPGRADE_VISUALS: Record<
  string,
  { Icon: LucideIcon; code: string; anchor: string; pattern: string }
> = {
  precision: { Icon: Crosshair, code: "LOCK", anchor: "18% 16%", pattern: "135deg" },
  rapidfire: { Icon: Zap, code: "RPM", anchor: "82% 18%", pattern: "25deg" },
  ricochet: { Icon: Share2, code: "CHAIN", anchor: "74% 76%", pattern: "160deg" },
  cluster: { Icon: Bomb, code: "BURST", anchor: "22% 78%", pattern: "55deg" },
  barrier: { Icon: Shield, code: "AEGIS", anchor: "50% 12%", pattern: "110deg" },
  magnet2: { Icon: Magnet, code: "PULL", anchor: "16% 52%", pattern: "15deg" },
  phaserush: { Icon: Gauge, code: "PHASE", anchor: "86% 48%", pattern: "145deg" },
};

function computeRunRewards(victory: boolean, score: number) {
  return {
    xp:
      (victory ? ARENA_CONFIG.rewards.baseXp : 0) +
      Math.floor(score / ARENA_CONFIG.rewards.scoreXpDivisor),
    credits:
      (victory ? ARENA_CONFIG.rewards.baseCredits : 0) +
      Math.floor(score / ARENA_CONFIG.rewards.scoreCreditsDivisor),
  };
}

const scaleGearMultiplier = (value: number, power: number): number =>
  value >= 1
    ? 1 + (value - 1) * power
    : Math.max(0.5, 1 - (1 - value) * power);

// Samo tri itema opremljena na aktivnom operativcu ulaze u run. Rarity
// pojacava identitet itema bez mijenjanja osnovnog JSON balansa.
function computeGearMods(equippedGear: CraftingRecipeId[]): GearMods {
  const gear = { speedMult: 1, damageMult: 1, fireIntervalMult: 1, maxHealthAdd: 0, pickupRadiusAdd: 0 };
  for (const id of equippedGear) {
    const def = (GEAR_MODS as Record<string, GearMods>)[id];
    if (!def) continue;
    const power = getArenaGearPower(id);
    if (def.speedMult) gear.speedMult *= scaleGearMultiplier(def.speedMult, power);
    if (def.damageMult) gear.damageMult *= scaleGearMultiplier(def.damageMult, power);
    if (def.fireIntervalMult) gear.fireIntervalMult *= scaleGearMultiplier(def.fireIntervalMult, power);
    if (def.maxHealthAdd) gear.maxHealthAdd += def.maxHealthAdd * power;
    if (def.pickupRadiusAdd) gear.pickupRadiusAdd += def.pickupRadiusAdd * power;
  }
  return gear;
}

function mergePermanentProgression(
  operator: ArenaOperatorDefinition["stats"],
  progression: ProgressionEffects
) {
  return {
    ...operator,
    damageMult: (operator.damageMult ?? 1) * (progression.damageMult ?? 1),
    fireIntervalMult:
      (operator.fireIntervalMult ?? 1) * (progression.fireIntervalMult ?? 1),
    speedMult: (operator.speedMult ?? 1) * (progression.speedMult ?? 1),
    maxHealthAdd: (operator.maxHealthAdd ?? 0) + (progression.maxHealthAdd ?? 0),
    pickupRadiusAdd:
      (operator.pickupRadiusAdd ?? 0) + (progression.pickupRadiusAdd ?? 0),
    multishot: (operator.multishot ?? 0) + (progression.multishotAdd ?? 0),
    pierces: (operator.pierces ?? 0) + (progression.piercesAdd ?? 0),
    bounces: progression.bouncesAdd ?? 0,
    bounceRange: progression.bounceRange ?? 0,
    clusterEveryKills: progression.clusterEveryKills ?? 0,
    clusterProjectiles: progression.clusterProjectilesAdd ?? 0,
    healPerKill: progression.healPerKill ?? 0,
    spreadRadians: Math.max(operator.spreadRadians ?? 0, progression.spreadRadians ?? 0),
  };
}

function AbilityBar() {
  const session = useArenaSession();
  const skills = useGameStore((s) => s.stats.skills);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const updateNow = () => setNow(performance.now());
    updateNow();
    const timer = window.setInterval(updateNow, 100);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="flex items-center justify-center gap-2">
      {ARENA_ABILITIES.map((ability) => {
        const unlocked = skills.includes(ability.skillId);
        const readyAt = session.abilityReadyAt[ability.id] ?? 0;
        const cooldownPct = unlocked
          ? Math.max(0, Math.min(1, (readyAt - now) / ability.cooldownMs))
          : 0;
        const remaining = Math.max(0, Math.ceil((readyAt - now) / 1000));
        const AbilityIcon =
          ability.kind === "nova"
            ? Bomb
            : ability.kind === "shield"
              ? Shield
              : ability.kind === "slow"
                ? Gauge
                : Zap;
        return (
          <div
            key={ability.id}
            className="relative h-16 w-16 overflow-hidden border bg-[#050a10]/94 text-center backdrop-blur-md"
            style={{
              borderColor: unlocked ? `${ability.color}88` : "#1f2937",
              opacity: unlocked ? 1 : 0.32,
              boxShadow:
                unlocked && cooldownPct === 0
                  ? `inset 0 0 18px ${ability.color}18, 0 0 14px ${ability.color}18`
                  : "none",
            }}
          >
            <div
              className="absolute inset-x-0 bottom-0 bg-black/75 transition-[height] duration-100"
              style={{ height: `${cooldownPct * 100}%` }}
            />
            <div className="absolute left-1.5 top-1 font-display text-[9px] text-white/55">
              {ability.key}
            </div>
            <div className="relative flex h-11 items-end justify-center pb-1">
              <AbilityIcon
                size={21}
                strokeWidth={1.45}
                style={{ color: unlocked ? ability.color : "#4b5563" }}
              />
            </div>
            <div className="relative truncate border-t border-white/[0.06] px-1 pt-1 text-[6px] tracking-[0.1em] text-gray-400">
              {unlocked ? (remaining > 0 ? `${remaining}S` : ability.label) : "LOCKED"}
            </div>
            {unlocked && cooldownPct === 0 ? (
              <span
                className="absolute right-1.5 top-1 h-1 w-1 animate-pulse rounded-full"
                style={{ background: ability.color }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function HudCoreDial({
  label,
  value,
  max,
  color,
  detail,
  active = false,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  detail: string;
  active?: boolean;
}) {
  const percent = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="relative h-28 w-28 shrink-0">
      <div
        className="absolute inset-0 rounded-full p-[2px] transition-all duration-200"
        style={{
          background: `conic-gradient(from -125deg, ${color} 0 ${percent}%, rgba(255,255,255,.08) ${percent}% 83%, transparent 83% 100%)`,
          filter: active ? `drop-shadow(0 0 12px ${color})` : `drop-shadow(0 0 5px ${color}55)`,
        }}
      >
        <div className="relative flex h-full w-full flex-col items-center justify-center rounded-full border border-white/10 bg-[#04080e]/96 shadow-[inset_0_0_28px_rgba(0,0,0,.9)]">
          <span className="text-[7px] tracking-[0.28em] text-gray-500">{label}</span>
          <span className="font-display mt-1 text-2xl tabular-nums text-white">{Math.ceil(value)}</span>
          <span className="mt-0.5 text-[7px] tracking-[0.14em]" style={{ color }}>{detail}</span>
          <span
            className={`absolute h-1.5 w-1.5 rounded-full ${active ? "animate-ping" : "animate-pulse"}`}
            style={{ bottom: 12, background: color }}
          />
        </div>
      </div>
      <div className="absolute left-1/2 top-1/2 h-px w-36 -translate-x-1/2 -translate-y-1/2 bg-white/[0.05]" />
      <div className="absolute left-1/2 top-1/2 h-36 w-px -translate-x-1/2 -translate-y-1/2 bg-white/[0.05]" />
    </div>
  );
}

function Hud() {
  const session = useArenaSession();
  const underground = session.environment === "underground";
  const seconds = Math.ceil(session.timeLeft);
  const elapsed = ARENA_CONFIG.meta.durationSeconds - session.timeLeft;
  const wave = getArenaWaveState(elapsed);
  const eliteCountdown =
    wave.nextEliteSecond === null ? null : Math.max(0, Math.ceil(wave.nextEliteSecond - elapsed));
  const nextMilestone = COMBO_MILESTONES.find(
    (milestone) => !session.comboMilestonesClaimed.includes(milestone.combo)
  );
  const milestoneProgress = nextMilestone
    ? Math.max(0, Math.min(1, session.combo / nextMilestone.combo))
    : 1;
  const healthColor =
    session.health / session.maxHealth > 0.35
      ? ARENA_CONFIG.meta.support
      : ARENA_CONFIG.meta.danger;
  const sprintColor =
    session.sprintEnergy > ARENA_CONFIG.player.sprint.maxEnergy * 0.25
      ? ARENA_CONFIG.meta.accent
      : "#ffcf40";
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 font-mono text-white">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-gray-500">
            {underground ? "RECURSIVE ENDGAME PROTOCOL" : ARENA_CONFIG.meta.descriptor}
          </div>
          <div className="font-display text-2xl tracking-[0.2em]">
            {underground ? `UNDERGROUND · DEPTH ${session.undergroundDepth}` : ARENA_CONFIG.meta.name}
          </div>
        </div>
        <div className="text-center">
          <div
            className="border px-4 py-2 text-3xl tabular-nums"
            style={{
              borderColor:
                seconds <= 10 || wave.breakWindow ? ARENA_CONFIG.meta.danger : "#1f2937",
            }}
          >
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
          </div>
          <div
            className="mt-1 text-[9px] tracking-[0.25em]"
            style={{
              color:
                session.bossTimerHold || wave.breakWindow
                  ? ARENA_CONFIG.meta.danger
                  : ARENA_CONFIG.meta.accent,
            }}
          >
            {session.bossTimerHold
              ? "TIMER HOLD · DESTROY THE BOSS"
              : wave.breakWindow
                ? `${wave.breakWindow.label} · ${Math.ceil(wave.breakWindow.endSecond - elapsed)}S`
                : `WAVE ${wave.index + 1} · ${wave.phase.label}${
                    eliteCountdown === null ? "" : ` · BOSS ${Math.floor(eliteCountdown / 60)}:${String(eliteCountdown % 60).padStart(2, "0")}`
                  }`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] tracking-[0.3em] text-gray-500">SCORE</div>
          <div className="text-2xl tabular-nums" style={{ color: ARENA_CONFIG.meta.accent }}>
            {session.score.toLocaleString()}
          </div>
          <div className="text-[10px] tracking-[0.3em] text-gray-500">KILLS {session.kills}</div>
          <div className="text-[9px] tracking-[0.2em] text-gray-600">
            EVOLUTIONS {session.evolutions.length}/{ARENA_EVOLUTIONS.length}
          </div>
          {session.combo > 1 ? (
            <div className="mt-2 min-h-16 border-r-2 border-[#ffcf40] pr-3">
              <div
                className="font-display text-3xl tracking-[0.12em] text-[#ffcf40]"
                style={{ textShadow: "0 0 12px #ffcf40, 0 0 28px rgba(255,207,64,.55)" }}
              >
                {session.combo}×
              </div>
              <div className="text-[9px] tracking-[0.32em] text-[#ffcf40]">COMBO CHAIN</div>
              <div className="ml-auto mt-1 h-0.5 w-32 bg-white/10">
                <div
                  className="h-full bg-[#ffcf40]"
                  style={{ width: `${Math.min(100, (session.comboTimeLeft / 2.8) * 100)}%` }}
                />
              </div>
              {nextMilestone ? (
                <div className="mt-1">
                  <div className="text-[7px] tracking-[0.22em] text-white/50">
                    NEXT POWER · {nextMilestone.combo}
                  </div>
                  <div className="ml-auto mt-0.5 h-px w-32 bg-white/10">
                    <div
                      className="h-full"
                      style={{ width: `${milestoneProgress * 100}%`, background: nextMilestone.color }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 min-h-16" />
          )}
        </div>
      </div>
      <div className="flex items-end justify-center gap-3 px-3">
        <HudCoreDial
          label="INTEGRITY"
          value={session.health}
          max={session.maxHealth}
          color={healthColor}
          detail={`/${session.maxHealth} HP`}
          active={session.health / session.maxHealth <= 0.35}
        />

        <div className="relative mb-1 min-w-0 w-full max-w-3xl border border-white/10 bg-[#03070d]/88 px-4 pb-3 pt-2 shadow-[0_18px_50px_rgba(0,0,0,.55)] backdrop-blur-md">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/55 to-transparent" />
          <div className="mb-2 flex items-center justify-between text-[7px] tracking-[0.22em] text-gray-500">
            <span>LINK LV {session.xpLevel}</span>
            <span className="text-cyan-100/65">{session.xp}/{session.xpNeeded} XP</span>
          </div>
          <div className="mb-3 h-1 overflow-hidden bg-white/[0.07]">
            <div
              className="h-full transition-[width] duration-150"
              style={{
                width: `${Math.min(100, (session.xp / session.xpNeeded) * 100)}%`,
                background: ARENA_CONFIG.meta.accent,
                boxShadow: `0 0 12px ${ARENA_CONFIG.meta.accent}`,
              }}
            />
          </div>
          <AbilityBar />
          <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[7px] tracking-[0.16em] text-gray-600">
            <span>{session.relicClass ? `RELIC / ${session.relicClass.toUpperCase()}` : "RELIC / UNBOUND"}</span>
            <span>{session.relicAugmentLevel > 0 ? `AUGMENT +${session.relicAugmentLevel}` : "AUGMENT / NONE"}</span>
            <span style={{ color: session.chassisCoreActive ? "#ffca58" : undefined }}>
              {session.chassisCoreActive ? "COMBAT CORE / ONLINE" : "COMBAT CORE / EMPTY"}
            </span>
          </div>
        </div>

        <HudCoreDial
          label="SPRINT"
          value={session.sprintEnergy}
          max={ARENA_CONFIG.player.sprint.maxEnergy}
          color={sprintColor}
          detail="SPACE / EN"
          active={session.sprintRequested}
        />
      </div>
    </div>
  );
}

function PortalAccessHud() {
  const environment = useArenaSession((state) => state.environment);
  const near = useArenaSession((state) => state.portalProximity);
  const charge = useArenaSession((state) => state.portalCharge);
  const endgameUnlocked = useGameStore((state) => state.stats.endgameUnlocked);
  const chassisCoreActive = useArenaSession((state) => state.chassisCoreActive);
  const portalActive = endgameUnlocked || chassisCoreActive;
  if (environment !== "surface" || !near) return null;
  return (
    <div className="pointer-events-none absolute left-6 top-[38%] z-30 w-72 border border-white/10 bg-[#03070d]/92 p-4 font-mono text-white backdrop-blur-md">
      <div
        className="text-[8px] tracking-[0.32em]"
        style={{ color: portalActive ? "#62ffd1" : "#52677b" }}
      >
        TRANSIT GATE · {portalActive ? "ONLINE" : "DORMANT"}
      </div>
      <div className="font-display mt-1 text-base tracking-[0.18em]">
        {portalActive ? "UNDERGROUND DESCENT" : "THREE COMMAND KEYS REQUIRED"}
      </div>
      <div className="mt-2 text-[9px] leading-relaxed text-gray-500">
        {portalActive
          ? "Stand inside the inner ring to synchronize the Mythic Core and descend."
          : "Defeat the three Surface jailers and bind the Mythic Core. The portal frame remains here until the command key is complete."}
      </div>
      <div className="mt-3 h-1 overflow-hidden bg-white/10">
        <div
          className="h-full transition-[width] duration-100"
          style={{
            width: `${portalActive ? charge * 100 : 0}%`,
            background: portalActive ? "#62ffd1" : "#273343",
            boxShadow: portalActive ? "0 0 14px #62ffd1" : "none",
          }}
        />
      </div>
      <div className="mt-2 text-[7px] tracking-[0.22em] text-gray-600">
        {portalActive ? `${Math.round(charge * 100)}% LINK CHARGE` : "BOSS I / II / III · ARTIFACT TIER III"}
      </div>
    </div>
  );
}

function FixerContractHud() {
  const session = useArenaSession();
  const contract = session.activeContract;
  const offer = session.fixerOfferId ? ARENA_CONTRACTS_BY_ID[session.fixerOfferId] : null;
  const result = session.contractResult;
  if (!contract && !offer && !result) return null;

  const progress = contract
    ? Math.max(0, Math.min(1, contract.progress / Math.max(1, contract.target)))
    : 0;
  const statusColor = result?.status === "failed" ? "#ff4d62" : "#58ffd4";

  return (
    <div className="pointer-events-none absolute left-6 top-28 z-20 w-72 font-mono text-white">
      {offer ? (
        <div className="border-l-2 border-[#58ffd4] bg-black/82 px-4 py-3 shadow-[0_0_28px_rgba(88,255,212,.13)]">
          <div className="text-[8px] tracking-[0.32em] text-[#58ffd4]">HOLO-FIXER SIGNAL</div>
          <div className="mt-1 font-display text-lg tracking-[0.14em]">{offer.label}</div>
          <div className="mt-1 text-[9px] leading-relaxed text-gray-400">Priđi zelenom svjetlosnom stubu · auto-accept</div>
        </div>
      ) : null}
      {contract ? (
        <div className="border-l-2 border-[#58ffd4] bg-black/86 px-4 py-3 shadow-[0_0_34px_rgba(88,255,212,.16)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[8px] tracking-[0.3em] text-[#58ffd4]">FIXER CONTRACT</span>
            <span className="font-display text-lg tabular-nums text-[#58ffd4]">{Math.ceil(contract.timeLeft)}s</span>
          </div>
          <div className="mt-1 font-display text-xl tracking-[0.12em]">{contract.label}</div>
          <div className="mt-1 text-[9px] leading-relaxed text-gray-400">{contract.description}</div>
          <div className="mt-3 h-1 bg-white/10">
            <div className="h-full bg-[#58ffd4] transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-1 flex items-center justify-between text-[8px] tracking-[0.18em] text-gray-500">
            <span>{Math.min(contract.target, Math.floor(contract.progress))}/{contract.target}</span>
            <span>{contract.rewardLabel}</span>
          </div>
        </div>
      ) : null}
      {result ? (
        <div
          className="border-l-2 bg-black/88 px-4 py-3 shadow-[0_0_32px_rgba(88,255,212,.12)]"
          style={{ borderColor: statusColor }}
        >
          <div className="text-[8px] tracking-[0.3em]" style={{ color: statusColor }}>
            {result.status === "complete" ? "CONTRACT COMPLETE" : "CONTRACT EXPIRED"}
          </div>
          <div className="mt-1 font-display text-xl tracking-[0.12em]">{result.label}</div>
          <div className="mt-1 text-[9px] tracking-[0.2em]" style={{ color: statusColor }}>
            {result.rewardLabel}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ComboMilestoneBanner() {
  const milestoneCombo = useArenaSession((state) => state.lastComboMilestone);
  const milestoneUntil = useArenaSession((state) => state.comboMilestoneUntil);
  const [visible, setVisible] = useState(false);
  const milestone = COMBO_MILESTONES.find((candidate) => candidate.combo === milestoneCombo);
  useEffect(() => {
    if (!milestoneCombo) return;
    setVisible(true);
    const duration = Math.max(0, milestoneUntil - performance.now());
    const timeout = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(timeout);
  }, [milestoneCombo, milestoneUntil]);
  if (!milestone || !visible) {
    return null;
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center overflow-hidden font-mono">
      <div
        className="absolute inset-4 animate-pulse border"
        style={{
          borderColor: `${milestone.color}88`,
          boxShadow: `inset 0 0 90px ${milestone.color}26, 0 0 70px ${milestone.color}20`,
        }}
      />
      <div
        className="absolute h-[2px] w-full animate-pulse"
        style={{ background: `linear-gradient(90deg, transparent, ${milestone.color}, transparent)` }}
      />
      <div className="relative bg-black/65 px-12 py-5 text-center backdrop-blur-sm">
        <div className="text-[10px] tracking-[0.55em]" style={{ color: milestone.color }}>
          COMBO PROTOCOL · {milestone.combo}
        </div>
        <div
          className="font-display mt-2 text-4xl tracking-[0.2em] text-white sm:text-6xl"
          style={{ textShadow: `0 0 12px ${milestone.color}, 0 0 42px ${milestone.color}` }}
        >
          {milestone.label}
        </div>
        <div className="mt-2 text-[9px] tracking-[0.34em] text-white/60">
          VISIBLE HOSTILES PURGED · PROTOCOL CLAIMED
        </div>
      </div>
    </div>
  );
}

function BossCataclysmBanner() {
  const latestZone = useArenaSession((state) => state.cataclysmZones.at(-1) ?? null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!latestZone) return;
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 3600);
    return () => window.clearTimeout(timeout);
  }, [latestZone]);
  if (!latestZone || !visible) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[16] flex items-center justify-center overflow-hidden font-mono">
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle,transparent_25%,rgba(255,39,9,.34)_100%)]" />
      <div className="absolute inset-x-0 top-1/2 h-[3px] bg-gradient-to-r from-transparent via-orange-400 to-transparent shadow-[0_0_34px_#ff4d16]" />
      <div className="relative skew-x-[-8deg] border-y border-orange-400/70 bg-black/80 px-16 py-6 text-center shadow-[0_0_70px_rgba(255,54,16,.45)]">
        <div className="text-[10px] tracking-[0.6em] text-orange-300">BOSS ARRIVAL PROTOCOL</div>
        <div className="font-display mt-2 text-4xl tracking-[0.18em] text-white sm:text-6xl">
          DISTRICT COLLAPSE
        </div>
        <div className="mt-2 text-[9px] tracking-[0.34em] text-red-300">
          STRUCTURES PURGED · FIRE ZONE ACTIVE · BREACH BOSS ×{latestZone.tier}
        </div>
      </div>
    </div>
  );
}

function OverlayFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto border border-gray-800 bg-[#05070d]/95 p-8 text-center font-mono text-white">
        {children}
      </div>
    </div>
  );
}

function UpgradeOverlay({ onPicked }: { onPicked: (id: string) => void }) {
  const options = useArenaSession((s) => s.upgradeOptions);
  const ranks = useArenaSession((s) => s.upgradeRanks);
  const chooseUpgrade = useArenaSession((s) => s.chooseUpgrade);
  return (
    <OverlayFrame>
      <div className="mb-1 text-[10px] tracking-[0.3em] text-gray-500">NEURAL LINK ESTABLISHED</div>
      <div className="font-display mb-6 text-2xl tracking-[0.24em]">CHOOSE ONE:</div>
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {options.map((id) => {
          const upgrade = ARENA_UPGRADES.find((u) => u.id === id);
          if (!upgrade) return null;
          const visual = UPGRADE_VISUALS[id] ?? UPGRADE_VISUALS.precision;
          const Icon = visual.Icon;
          const currentRank = ranks[id] ?? 0;
          const nextRank = currentRank + 1;
          // Evolution steering: pokazi igracu kojoj evoluciji ovaj izbor vodi.
          const evolutionHint = ARENA_EVOLUTIONS.map((evolution) => {
            const requirement = evolution.requirements.find((req) => req.id === id);
            if (!requirement) return null;
            const remaining = requirement.rank - nextRank;
            if (remaining < 0) return null;
            const partnerHints = evolution.requirements
              .filter((req) => req.id !== id)
              .map((req) => {
                const partner = ARENA_UPGRADES.find((u) => u.id === req.id);
                const partnerRemaining = req.rank - (ranks[req.id] ?? 0);
                return { label: partner?.label ?? req.id, remaining: Math.max(0, partnerRemaining) };
              });
            const totalRemaining =
              remaining + partnerHints.reduce((sum, partner) => sum + partner.remaining, 0);
            return { evolution, totalRemaining };
          })
            .filter((hint): hint is NonNullable<typeof hint> => hint !== null)
            .sort((a, b) => a.totalRemaining - b.totalRemaining)[0];
          return (
            <button
              key={id}
              onClick={() => {
                chooseUpgrade(id);
                onPicked(id);
              }}
              className="group relative flex items-stretch gap-4 overflow-hidden border border-gray-800 p-4 text-left transition-all hover:scale-[1.015] hover:border-white/40"
              style={{
                borderLeftColor: upgrade.color,
                borderLeftWidth: 3,
                background: `linear-gradient(100deg, ${upgrade.color}14, transparent 40%), repeating-linear-gradient(${visual.pattern}, transparent 0 14px, ${upgrade.color}08 15px 16px), #070a11`,
                boxShadow: `inset 0 0 40px rgba(0,0,0,.45)`,
              }}
            >
              <div className="flex shrink-0 items-center">
                <div
                  className="flex h-16 w-16 rotate-45 items-center justify-center border bg-black/60 transition-transform group-hover:rotate-[50deg]"
                  style={{
                    borderColor: `${upgrade.color}aa`,
                    boxShadow: `0 0 24px ${upgrade.color}33`,
                  }}
                >
                  <Icon
                    aria-hidden="true"
                    className="h-7 w-7 -rotate-45"
                    style={{ color: upgrade.color }}
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-base tracking-[0.16em] text-white">
                    {upgrade.label}
                  </span>
                  <span
                    className="shrink-0 text-[9px] tracking-[0.3em]"
                    style={{ color: upgrade.color }}
                  >
                    {upgrade.branch}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] leading-relaxed text-gray-300">
                  {upgrade.description}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: 5 }, (_, pip) => (
                      <span
                        key={pip}
                        className="h-1.5 w-4"
                        style={{
                          background:
                            pip < nextRank ? upgrade.color : "rgba(255,255,255,.12)",
                          boxShadow: pip < nextRank ? `0 0 8px ${upgrade.color}66` : "none",
                        }}
                      />
                    ))}
                    <span className="ml-1 text-[8px] tracking-[0.24em] text-gray-500">
                      RANK {nextRank}
                    </span>
                  </div>
                  {evolutionHint ? (
                    <span
                      className="truncate text-[9px] tracking-[0.18em]"
                      style={{ color: evolutionHint.evolution.color }}
                    >
                      {evolutionHint.totalRemaining === 0
                        ? `▸ EVOLUCIJA SPREMNA · ${evolutionHint.evolution.label}`
                        : `▸ ${evolutionHint.totalRemaining} DO ${evolutionHint.evolution.label}`}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </OverlayFrame>
  );
}

function EvolutionOverlay({ onContinue }: { onContinue: (color: string) => void }) {
  const evolutionId = useArenaSession((state) => state.pendingEvolution);
  const acknowledgeEvolution = useArenaSession((state) => state.acknowledgeEvolution);
  const evolution = ARENA_EVOLUTIONS.find((candidate) => candidate.id === evolutionId);
  if (!evolution) return null;
  return (
    <OverlayFrame>
      <div className="mb-2 text-[10px] tracking-[0.35em]" style={{ color: evolution.color }}>
        WEAPON EVOLUTION COMPLETE
      </div>
      <div
        className="font-display mb-4 text-3xl tracking-[0.2em]"
        style={{ color: evolution.color, textShadow: `0 0 24px ${evolution.color}` }}
      >
        {evolution.label}
      </div>
      <div className="mx-auto mb-6 max-w-md text-xs leading-relaxed text-gray-300">
        {evolution.description}
      </div>
      <button
        onClick={() => {
          acknowledgeEvolution();
          onContinue(evolution.color);
        }}
        className="border px-8 py-3 text-xs tracking-[0.3em] transition-colors hover:bg-white hover:text-black"
        style={{ borderColor: evolution.color }}
      >
        ENGAGE
      </button>
    </OverlayFrame>
  );
}

// Minimap sa fog-of-war otkrivanjem: mapa se crta samo tamo gdje je pilot hodao.
function MinimapHud({
  world,
  runId,
}: {
  world: ReturnType<typeof createArenaWorld>;
  runId: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visitedRef = useRef<Set<string>>(new Set());
  const phase = useArenaSession((state) => state.phase);
  const environment = useArenaSession((state) => state.environment);

  useEffect(() => {
    visitedRef.current = new Set();
  }, [runId, environment]);

  useEffect(() => {
    const CELL = 8; // 8m fog celije
    const RANGE = 110; // radijus prikaza u metrima
    const SIZE = 148;
    const interval = window.setInterval(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const px = world.playerPosition.x;
      const pz = world.playerPosition.z;
      const cellX = Math.round(px / CELL);
      const cellZ = Math.round(pz / CELL);
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          visitedRef.current.add(`${cellX + dx}:${cellZ + dz}`);
        }
      }
      const scale = SIZE / (RANGE * 2);
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = "rgba(3,7,13,0.92)";
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = environment === "underground" ? "rgba(177,59,255,0.12)" : "rgba(0,242,255,0.1)";
      const cellPx = CELL * scale;
      for (const key of visitedRef.current) {
        const [cx, cz] = key.split(":").map(Number);
        const sx = (cx * CELL - px) * scale + SIZE / 2;
        const sz = (cz * CELL - pz) * scale + SIZE / 2;
        if (sx < -cellPx || sx > SIZE + cellPx || sz < -cellPx || sz > SIZE + cellPx) continue;
        ctx.fillRect(sx - cellPx / 2, sz - cellPx / 2, cellPx + 0.5, cellPx + 0.5);
      }
      for (const enemy of world.enemies.values()) {
        const sx = (enemy.position.x - px) * scale + SIZE / 2;
        const sz = (enemy.position.z - pz) * scale + SIZE / 2;
        if (sx < 2 || sx > SIZE - 2 || sz < 2 || sz > SIZE - 2) continue;
        const isBossUnit = enemy.kind.startsWith("boss_");
        ctx.fillStyle = isBossUnit ? "#ffcf40" : enemy.kind === "elite" ? "#ff6a24" : "#ff3b5c";
        ctx.beginPath();
        ctx.arc(sx, sz, isBossUnit ? 3.5 : 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#00f2ff";
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,242,255,0.45)";
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, 6, 0, Math.PI * 2);
      ctx.stroke();
    }, 180);
    return () => window.clearInterval(interval);
  }, [world, environment]);

  if (phase === "briefing" || phase === "victory" || phase === "defeat") return null;
  return (
    <div
      className="pointer-events-none absolute right-5 top-24 z-30 border bg-black/55 backdrop-blur-sm"
      style={{
        borderColor: "rgba(0,242,255,0.25)",
        boxShadow: "0 0 24px rgba(0,242,255,0.12)",
        clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)",
      }}
    >
      <canvas ref={canvasRef} width={148} height={148} className="block" />
      <div className="border-t border-cyan-400/15 px-2 py-1 text-center text-[7px] tracking-[0.3em] text-cyan-200/60">
        SECTOR SCAN
      </div>
    </div>
  );
}

function StoryTransmissionHud() {
  const transmissionId = useArenaSession((state) => state.storyTransmission);
  const dismiss = useArenaSession((state) => state.dismissStoryTransmission);
  const transmission = transmissionId
    ? ARENA_STORY_TRANSMISSIONS[transmissionId]
    : null;

  // Dijalog pauzira igru i ceka igraca — nema auto-dismissa.
  // Enter/Space/klik nastavljaju (Hades stil).
  useEffect(() => {
    if (!transmission) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss, transmission]);

  if (!transmission) return null;
  return <HadesStyleTransmission transmission={transmission} onDismiss={dismiss} />;
}

// Hades-style dijalog u sci-fi fazonu: veliki portret govornika koji izlazi iznad
// okvira, name plate sa epitetom i uokvirena replika sa "continue" indikatorom.
function HadesStyleTransmission({
  transmission,
  onDismiss,
}: {
  transmission: (typeof ARENA_STORY_TRANSMISSIONS)[keyof typeof ARENA_STORY_TRANSMISSIONS];
  onDismiss: () => void;
}) {
  const pilotBody = useGameStore((state) => state.pilotBody);
  const speaker = ARENA_STORY_SPEAKERS[transmission.speaker];
  const portrait =
    transmission.speaker === "PILOT"
      ? `/images/pilots/pilot-${pilotBody}.png`
      : speaker.portrait;

  return (
    <div className="pointer-events-auto fixed inset-0 z-40" role="presentation" onClick={onDismiss}>
      {/* Fokus zavjesa: igra je pauzirana, dijalog je jedina svijetla tacka */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div className="absolute inset-x-0 bottom-24 flex justify-center px-4 sm:bottom-32">
      <div
        key={transmission.id}
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onDismiss();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onDismiss();
        }}
        className="relative w-full max-w-3xl cursor-pointer text-left"
      >
        {portrait ? (
          <div
            className="absolute bottom-2 left-0 z-10 h-64 w-44 select-none"
            style={{
              WebkitMaskImage: "linear-gradient(to top, black 72%, transparent 98%)",
              maskImage: "linear-gradient(to top, black 72%, transparent 98%)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={portrait}
              alt={speaker.name}
              className="h-full w-full object-cover object-top"
              style={
                speaker.silhouette
                  ? { filter: "brightness(0.16) saturate(0.15) contrast(1.5)" }
                  : { filter: `drop-shadow(0 0 22px ${transmission.color}55)` }
              }
            />
          </div>
        ) : null}

        <div
          className="relative z-20 ml-36 inline-flex items-baseline gap-3 border bg-[#04070d]/95 px-5 py-2 backdrop-blur-md"
          style={{
            borderColor: transmission.color,
            boxShadow: `0 0 24px ${transmission.color}33`,
            clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 100%, 0 100%)",
          }}
        >
          <span
            className="font-display text-xl tracking-[0.24em] text-white"
            style={{ textShadow: `0 0 14px ${transmission.color}88` }}
          >
            {speaker.name}
          </span>
          <span className="text-[9px] tracking-[0.28em]" style={{ color: transmission.color }}>
            {speaker.epithet.toUpperCase()}
          </span>
        </div>

        <div
          className="relative ml-32 border bg-[#03060c]/95 py-5 pl-16 pr-8 backdrop-blur-md"
          style={{
            borderColor: `${transmission.color}80`,
            boxShadow: `0 0 44px ${transmission.color}1f, inset 0 0 60px rgba(0,0,0,.5)`,
            clipPath:
              "polygon(0 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%)",
          }}
        >
          <div className="text-[8px] tracking-[0.32em] text-gray-500">
            {transmission.chapter} · {transmission.title.toUpperCase()}
          </div>
          <div className="mt-2 max-w-[56ch] text-sm leading-relaxed text-gray-100">
            {transmission.body}
          </div>
          <div
            className="absolute bottom-2 right-4 animate-bounce text-xs"
            style={{ color: transmission.color }}
          >
            ▼
          </div>
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              background:
                "repeating-linear-gradient(to bottom, transparent 0 2px, #ffffff 2px 3px)",
            }}
          />
        </div>
      </div>
      </div>
    </div>
  );
}

function EndOverlay({
  victory,
  runUnlockIds,
  onRetry,
  onNewOperative,
}: {
  victory: boolean;
  runUnlockIds: string[];
  onRetry: () => void;
  onNewOperative: (operator: ArenaClassId) => void;
}) {
  const router = useRouter();
  const session = useArenaSession();
  const ownedSkills = useGameStore((state) => state.stats.skills);
  const skillPoints = useGameStore((state) => state.stats.skillPoints);
  const unlockSkillNode = useGameStore((state) => state.unlockSkill);
  const endgameUnlocked = useGameStore((state) => state.stats.endgameUnlocked);
  const operativeCycles = useGameStore((state) => state.stats.operativeCycles);
  const activeClass = useGameStore((state) => state.hero.archetype);
  const rewards = useMemo(() => computeRunRewards(victory, session.score), [victory, session.score]);
  const survivedSeconds = Math.max(0, ARENA_CONFIG.meta.durationSeconds - session.timeLeft);
  const upgradeRanks = Object.values(session.upgradeRanks).reduce((sum, rank) => sum + rank, 0);
  // Quick panel nudi 3 najjeftinija DOSTUPNA cvora prave Skill Matrix —
  // isti cvorovi, ista valuta (Skill Points) kao na /skills stranici.
  const availableSkills = ARENA_SKILL_NODES.filter(
    (node) =>
      node.id !== "core" &&
      !ownedSkills.includes(node.id) &&
      node.requires.every(
        (requirement) => requirement === "core" || ownedSkills.includes(requirement)
      )
  )
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 3);
  const runUnlocks = ARENA_META_UNLOCKS.filter((unlock) => runUnlockIds.includes(unlock.id));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Enter" || event.repeat) return;
      event.preventDefault();
      onRetry();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onRetry]);

  return (
    <OverlayFrame>
      <div
        className="font-display mb-2 text-3xl tracking-[0.25em]"
        style={{ color: victory ? ARENA_CONFIG.meta.support : ARENA_CONFIG.meta.danger }}
      >
        {victory ? "SECTOR HELD" : "SIGNAL LOST"}
      </div>
      <div className="mb-4 text-[10px] tracking-[0.3em] text-gray-500">
        {victory ? "SECTOR TIMER COMPLETE" : `TERMINATED BY ${session.lastDamageSource}`}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-px bg-white/10 text-left sm:grid-cols-5">
        {[
          ["SURVIVED", `${Math.floor(survivedSeconds / 60)}:${String(Math.floor(survivedSeconds % 60)).padStart(2, "0")}`],
          ["KILLS", session.kills.toLocaleString()],
          ["BEST COMBO", `${session.comboBest}×`],
          ["DAMAGE", Math.round(session.damageDealt).toLocaleString()],
          ["LINK LEVEL", session.xpLevel],
          ["UPGRADE RANKS", upgradeRanks],
          ["EVOLUTIONS", `${session.evolutions.length}/${ARENA_EVOLUTIONS.length}`],
          ["DAMAGE TAKEN", Math.round(session.damageTaken).toLocaleString()],
          ["CONTRACTS", `${session.contractsCompleted} DONE · ${session.contractsFailed} MISSED`],
          ["FIXER DAMAGE", `${Math.round(session.contractDamageMult * 100)}%`],
        ].map(([label, value]) => (
          <div key={label} className="bg-[#070a11] p-3">
            <div className="text-[8px] tracking-[0.22em] text-gray-600">{label}</div>
            <div className="font-display mt-1 text-lg text-white">{value}</div>
          </div>
        ))}
      </div>
      <div className="mb-5 text-xs text-gray-300">
        +{rewards.xp} XP · +{rewards.credits} CR{victory ? " · MATERIJALI DODANI" : ""}
      </div>
      {runUnlocks.length > 0 ? (
        <div className="mb-5 border border-cyan-300/35 bg-cyan-300/[0.05] p-4 text-left">
          <div className="mb-3 text-[9px] tracking-[0.3em] text-cyan-200">META SIGNAL UNLOCKED</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {runUnlocks.map((unlock) => (
              <div key={unlock.id} className="border border-white/10 bg-black/35 p-3">
                <div className="font-display text-xs tracking-widest text-white">{unlock.label}</div>
                <div className="mt-1 text-[9px] leading-relaxed text-gray-500">{unlock.description}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {endgameUnlocked ? (
        <div className="mb-5 border border-emerald-300/35 bg-emerald-300/[0.04] p-4 text-left">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[9px] tracking-[0.3em] text-emerald-200">
                ENDGAME ONLINE · OPERATIVE CYCLE {operativeCycles + 1}
              </div>
              <div className="mt-1 text-[9px] leading-relaxed text-gray-500">
                Start another Act I run with a class weapon. Skill Matrix, crafting, and account unlocks remain; every Artifact Weapon keeps its own tier and traits.
              </div>
            </div>
            <div className="shrink-0 text-[8px] tracking-[0.2em] text-emerald-300">NEW OPERATIVE</div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {HERO_ARCHETYPES.map((classId) => {
              const definition = NEW_OPERATIVE_COPY[classId];
              const color = HEROES[classId].accent;
              return (
                <button
                  key={classId}
                  type="button"
                  onClick={() => onNewOperative(classId)}
                  className="border bg-black/35 p-3 text-left transition-colors hover:bg-white/5"
                  style={{ borderColor: `${color}${activeClass === classId ? "aa" : "45"}` }}
                >
                  <div className="font-display text-[10px] tracking-widest" style={{ color }}>
                    {definition.label}
                  </div>
                  <div className="mt-1 text-[8px] leading-relaxed text-gray-500">
                    {definition.campaignPromise}
                  </div>
                  <div className="mt-2 text-[7px] tracking-[0.18em]" style={{ color }}>
                    {activeClass === classId ? "REPEAT CURRENT CLASS" : "SYNCHRONIZE CLASS"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="mb-6 border border-white/10 p-4 text-left">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[9px] tracking-[0.25em] text-gray-500">QUICK SKILL MATRIX</div>
            <div className="text-[9px] text-gray-700">Potroši Skill Pointe i odmah uđi jači — isti čvorovi kao na /skills.</div>
          </div>
          <div className="font-display text-lg" style={{ color: "#35d9ff" }}>{skillPoints} SP</div>
        </div>
        {availableSkills.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {availableSkills.map((node) => {
              const affordable = skillPoints >= node.cost;
              const branch = SKILL_BRANCHES[node.branch];
              return (
                <button
                  key={node.id}
                  disabled={!affordable}
                  onClick={() => {
                    if (unlockSkillNode(node.id, node.cost)) arenaAudio.sfx("pickup");
                  }}
                  className="border border-white/10 p-3 text-left transition-colors enabled:hover:bg-white/5 disabled:opacity-35"
                  style={{ borderTopColor: branch.color, borderTopWidth: 2 }}
                >
                  <div className="text-[7px] tracking-[0.25em]" style={{ color: branch.color }}>{branch.label}</div>
                  <div className="mt-0.5 font-display text-xs tracking-widest text-white">{node.label}</div>
                  <div className="mt-1 text-[9px] leading-relaxed text-gray-500">{node.description}</div>
                  <div className="mt-2 text-[9px]" style={{ color: branch.color }}>{node.cost} SP</div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-[10px] tracking-widest text-gray-600">NEMA DOSTUPNIH ČVOROVA — SVE OTKLJUČANO ILI ČEKA PREREQUISITE</div>
        )}
      </div>
      <div className="flex justify-center gap-4">
        <button
          onClick={onRetry}
          className="border border-gray-700 px-6 py-3 text-xs tracking-[0.25em] transition-colors hover:bg-white hover:text-black"
        >
          RE-DEPLOY · ENTER
        </button>
        <button
          onClick={() => router.push("/hub")}
          className="border border-gray-800 px-6 py-3 text-xs tracking-[0.25em] text-gray-400 transition-colors hover:bg-white/5"
        >
          HUB
        </button>
      </div>
    </OverlayFrame>
  );
}

function BriefingOverlay({
  heroLabel,
  heroAccent,
  operator,
  controlMode,
  onControlMode,
  onStart,
}: {
  heroLabel: string;
  heroAccent: string;
  operator: ArenaOperatorDefinition;
  controlMode: ArenaControlMode;
  onControlMode: (mode: ArenaControlMode) => void;
  onStart: () => void;
}) {
  return (
    <OverlayFrame>
      <div className="mb-1 text-[10px] tracking-[0.3em] text-gray-500">{ARENA_CONFIG.meta.levelTag} · {heroLabel}</div>
      <div className="font-display mb-4 text-3xl tracking-[0.25em]">{ARENA_CONFIG.meta.name}</div>
      <div
        className="mx-auto mb-5 max-w-xl border p-4 text-left"
        style={{ borderColor: `${heroAccent}66`, background: `${heroAccent}0b` }}
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <div className="text-[8px] tracking-[0.35em]" style={{ color: heroAccent }}>
              OPERATOR CLASS
            </div>
            <div className="font-display mt-1 text-lg tracking-[0.16em]">{operator.className}</div>
          </div>
          <div className="text-right">
            <div className="text-[8px] tracking-[0.28em] text-gray-600">START WEAPON</div>
            <div className="font-display mt-1 text-xs" style={{ color: heroAccent }}>
              {operator.weaponName}
            </div>
          </div>
        </div>
        <div className="mt-2 text-[9px] leading-relaxed text-gray-400">{operator.description}</div>
        <div className="mt-3 grid grid-cols-4 gap-px bg-white/10 text-center">
          {[
            ["HP", ARENA_CONFIG.player.maxHealth + (operator.stats.maxHealthAdd ?? 0)],
            ["MOVE", `${Math.round((operator.stats.speedMult ?? 1) * 100)}%`],
            ["POWER", `${Math.round((operator.stats.damageMult ?? 1) * 100)}%`],
            ["CYCLE", `${Math.round(100 / (operator.stats.fireIntervalMult ?? 1))}%`],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#060910] px-2 py-2">
              <div className="text-[7px] tracking-[0.2em] text-gray-600">{label}</div>
              <div className="font-display mt-0.5 text-xs">{value}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mb-6 space-y-1 text-[11px] leading-relaxed text-gray-400">
        <div>Preživi {Math.round(ARENA_CONFIG.meta.durationSeconds / 60)} minuta.</div>
        <div>Nišan prati miš punih 360°; oružje puca pravo kroz prikazanu putanju.</div>
        <div>Drži SPACE za sprint; energija se puni kada prestaneš sprintati.</div>
        <div>Radijalne moći i combo protokoli napadaju sa svih strana.</div>
        <div>Skupljaj data core-ove i biraj support linkove.</div>
      </div>
      <div className="mx-auto mb-6 grid max-w-lg grid-cols-2 gap-3 text-left">
        {([
          ["keyboard", "TASTATURA", "WASD / strelice za kretanje · SPACE sprint · miš za 360° nišan"],
          ["mouse", "MIŠ", "Drži desni klik za kretanje · LMB napad · SPACE sprint"],
        ] as const).map(([mode, label, description]) => (
          <button
            key={mode}
            type="button"
            onClick={() => onControlMode(mode)}
            className="border p-3 transition-colors"
            style={{
              borderColor: controlMode === mode ? ARENA_CONFIG.meta.accent : "#283141",
              background: controlMode === mode ? "rgba(0,242,255,.08)" : "rgba(0,0,0,.25)",
            }}
          >
            <div
              className="font-display text-xs tracking-[0.22em]"
              style={{ color: controlMode === mode ? ARENA_CONFIG.meta.accent : "#9ca3af" }}
            >
              {label}
            </div>
            <div className="mt-1 text-[8px] leading-relaxed text-gray-500">{description}</div>
          </button>
        ))}
      </div>
      <div className="mx-auto mb-6 max-w-3xl text-left">
        <div className="mb-2 text-[8px] tracking-[0.28em] text-gray-600">POWER SIGNALS · COLOR / EFFECT</div>
        <div className="grid grid-cols-5 gap-1">
          {Object.values(ARENA_POWER_DROPS).map((power) => (
            <div key={power.id} className="border bg-black/35 p-2" style={{ borderColor: `${power.color}55` }}>
              <div className="text-[7px] tracking-[0.12em]" style={{ color: power.color }}>{power.shortLabel}</div>
              <div className="mt-1 text-[7px] leading-relaxed text-gray-500">{power.description}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto mb-6 max-w-3xl text-left">
        <div className="mb-2 text-[8px] tracking-[0.28em] text-gray-600">
          ACT I BOSS INTEL · ABILITY / COUNTERPLAY / REWARD
        </div>
        <div className="grid grid-cols-3 gap-1">
          {Object.values(ARENA_BOSSES).map((boss) => (
            <div key={boss.id} className="border bg-black/35 p-3" style={{ borderColor: `${boss.accent}55` }}>
              <div className="text-[7px] tracking-[0.18em]" style={{ color: boss.accent }}>
                BOSS {boss.tier} · {boss.label}
              </div>
              <div className="mt-1 font-display text-[10px] tracking-[0.12em] text-white">
                {boss.ability}
              </div>
              <div className="mt-1 text-[7px] leading-relaxed text-gray-500">
                {boss.abilityDescription}
              </div>
              <div className="mt-2 text-[7px] leading-relaxed text-gray-400">
                COUNTER: {boss.counterplay}
              </div>
              <div className="mt-2 text-[7px] leading-relaxed" style={{ color: boss.accent }}>
                {boss.reward}
              </div>
            </div>
          ))}
        </div>
      </div>
      <button
        onClick={onStart}
        className="border px-8 py-3 text-xs tracking-[0.3em] transition-colors hover:bg-white hover:text-black"
        style={{ borderColor: ARENA_CONFIG.meta.accent }}
      >
        DEPLOY
      </button>
    </OverlayFrame>
  );
}

const RELIC_CLASS_OPTIONS: Array<{
  id: ArenaRelicClass;
  label: string;
  weapon: string;
  color: string;
  description: string;
  Icon: LucideIcon;
}> = [
  {
    id: "warrior",
    label: "WARRIOR",
    weapon: "RELIC GREATSWORD",
    color: "#37f6ff",
    description: "Sporiji široki rez, najveći stagger i razoran udar u konusu.",
    Icon: Shield,
  },
  {
    id: "rogue",
    label: "ROGUE",
    weapon: "TWIN MONO-BLADES",
    color: "#ff5ad9",
    description: "Najbrži combo; isti relic blade se duplira u par za kratke nalete.",
    Icon: Gauge,
  },
  {
    id: "warlock",
    label: "WARLOCK",
    weapon: "VOID GLAIVE",
    color: "#76ff55",
    description: "Dugi energetski zamah koji detonira void energiju kroz grupu.",
    Icon: Zap,
  },
];

function RelicChoiceOverlay() {
  const chooseRelicClass = useArenaSession((state) => state.chooseRelicClass);
  return (
    <OverlayFrame>
      <div className="text-[9px] tracking-[0.38em] text-cyan-200">FIRST BOSS RELIC</div>
      <div className="font-display mt-2 text-3xl tracking-[0.2em] text-white">
        CHOOSE COMBAT CLASS
      </div>
      <div className="mx-auto mt-2 max-w-xl text-[10px] leading-relaxed text-gray-500">
        Relic Core se trajno oblikuje za ovaj run. LMB koristi class napad; automatska puška ostaje support weapon.
      </div>
      <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
        {RELIC_CLASS_OPTIONS.map(({ id, label, weapon, color, description, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              arenaAudio.sfx("ability");
              chooseRelicClass(id);
            }}
            className="group border bg-black/35 p-4 transition-transform hover:-translate-y-1"
            style={{ borderColor: `${color}88`, boxShadow: `0 0 24px ${color}14` }}
          >
            <Icon size={28} style={{ color }} />
            <div className="font-display mt-4 text-lg tracking-[0.16em]" style={{ color }}>
              {label}
            </div>
            <div className="mt-1 text-[8px] tracking-[0.22em] text-white/70">{weapon}</div>
            <div className="mt-3 text-[9px] leading-relaxed text-gray-500">{description}</div>
            <div className="mt-4 text-[8px] tracking-[0.24em]" style={{ color }}>
              BIND RELIC →
            </div>
          </button>
        ))}
      </div>
    </OverlayFrame>
  );
}

const QA_TIME_SCALES = [1, 2, 4, 8] as const;
const QA_BOSS_JUMPS = [
  { label: "BOSS 1", elapsed: 180, detail: "03:00" },
  { label: "BOSS 2", elapsed: 360, detail: "06:00" },
  { label: "BOSS 3", elapsed: 540, detail: "09:00" },
] as const;

function QaControlDeck({ world, onRestart }: { world: ArenaWorld; onRestart: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const elapsed = useArenaSession((state) =>
    Math.max(0, Math.floor(ARENA_CONFIG.meta.durationSeconds - state.timeLeft))
  );
  const testTimeScale = useArenaSession((state) => state.testTimeScale);
  const testInvulnerable = useArenaSession((state) => state.testInvulnerable);
  const health = useArenaSession((state) => state.health);
  const maxHealth = useArenaSession((state) => state.maxHealth);
  const relicClass = useArenaSession((state) => state.relicClass);
  const session = useArenaSession.getState;

  return (
    <div className="pointer-events-auto absolute right-5 top-28 z-30 w-80 font-mono text-white">
      <div className="relative overflow-hidden border border-cyan-200/35 bg-[#050910]/94 shadow-[0_0_36px_rgba(0,242,255,.14)] backdrop-blur-md">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-pulse bg-cyan-200/80" />
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span>
            <span className="block text-[8px] tracking-[0.34em] text-cyan-200">ARENA QA LINK</span>
            <span className="font-display mt-1 block text-sm tracking-[0.18em]">ENDGAME TEST DECK</span>
          </span>
          <span className="text-[9px] tracking-[0.22em] text-cyan-200">
            {expanded ? "COLLAPSE" : "OPEN"}
          </span>
        </button>
        {expanded ? (
          <div className="border-t border-white/10 px-4 pb-4 pt-3">
            <div className="mb-3 grid grid-cols-3 gap-px bg-white/10 text-center">
              {[
                ["ELAPSED", `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`],
                ["INTEGRITY", `${Math.ceil(health)}/${maxHealth}`],
                ["RELIC", relicClass?.toUpperCase() ?? "NONE"],
              ].map(([label, value]) => (
                <div key={label} className="bg-[#070c15] px-2 py-2">
                  <div className="text-[7px] tracking-[0.18em] text-gray-600">{label}</div>
                  <div className="font-display mt-1 text-[11px] text-cyan-100">{value}</div>
                </div>
              ))}
            </div>

            <div className="text-[7px] tracking-[0.28em] text-gray-500">SIMULATION SPEED</div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {QA_TIME_SCALES.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => session().setTestTimeScale(speed)}
                  className="border py-2 text-[9px] transition-colors"
                  style={{
                    borderColor: testTimeScale === speed ? ARENA_CONFIG.meta.accent : "#263244",
                    color: testTimeScale === speed ? ARENA_CONFIG.meta.accent : "#718096",
                    background: testTimeScale === speed ? "rgba(0,242,255,.08)" : "transparent",
                  }}
                >
                  {speed}×
                </button>
              ))}
            </div>

            <div className="mt-4 text-[7px] tracking-[0.28em] text-gray-500">DIRECT BOSS JUMP</div>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {QA_BOSS_JUMPS.map((boss) => (
                <button
                  key={boss.label}
                  type="button"
                  onClick={() => session().testJumpToElapsed(boss.elapsed)}
                  className="border border-white/15 bg-white/[0.025] py-2 transition-colors hover:border-red-300/60 hover:bg-red-300/[0.06]"
                >
                  <span className="font-display block text-[10px] text-white">{boss.label}</span>
                  <span className="mt-0.5 block text-[7px] text-gray-600">{boss.detail}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => session().setTestInvulnerable(!testInvulnerable)}
                className="border py-2 text-[8px] transition-colors"
                style={{
                  borderColor: testInvulnerable ? "#58ffd4" : "#344154",
                  color: testInvulnerable ? "#58ffd4" : "#8b96a8",
                  background: testInvulnerable ? "rgba(88,255,212,.08)" : "transparent",
                }}
              >
                GOD {testInvulnerable ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                onClick={() => session().healPlayer(Number.MAX_SAFE_INTEGER)}
                className="border border-white/15 py-2 text-[8px] text-gray-300 hover:border-green-300/60"
              >
                FULL HEAL
              </button>
              <button
                type="button"
                onClick={() => {
                  for (const enemy of world.enemies.values()) enemy.hit(Number.MAX_SAFE_INTEGER);
                }}
                className="border border-white/15 py-2 text-[8px] text-gray-300 hover:border-red-300/60"
              >
                PURGE ALL
              </button>
            </div>

            <div className="mt-4 text-[7px] tracking-[0.28em] text-gray-500">FORCE RELIC CLASS</div>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {RELIC_CLASS_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => session().testGrantRelic(option.id)}
                  className="border py-2 text-[8px] transition-colors"
                  style={{
                    borderColor: relicClass === option.id ? option.color : "#263244",
                    color: relicClass === option.id ? option.color : "#718096",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                session().collectBossReward("mythic_core");
                session().setTestInvulnerable(true);
                world.playerBody?.setTranslation({ x: 0, y: 0, z: -10.5 }, true);
                world.playerBody?.setLinvel({ x: 0, y: 0, z: 0 }, true);
              }}
              className="mt-4 w-full border border-emerald-300/35 bg-emerald-300/[0.05] py-2 text-[8px] tracking-[0.22em] text-emerald-200 transition-colors hover:border-emerald-200 hover:bg-emerald-300/[0.1]"
            >
              TEST PORTAL DESCENT
            </button>

            <button
              type="button"
              onClick={onRestart}
              className="mt-4 w-full border border-white/10 py-2 text-[8px] tracking-[0.24em] text-gray-500 transition-colors hover:border-white/35 hover:text-white"
            >
              RESET IDENTICAL ARENA RUN
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ArenaGame() {
  const [runId, setRunId] = useState(0);
  const [runUnlockIds, setRunUnlockIds] = useState<string[]>([]);
  const [controlMode, setControlMode] = useState<ArenaControlMode>("keyboard");
  const [testMode, setTestMode] = useState(false);
  const world = useMemo(() => createArenaWorld(), [runId]); // eslint-disable-line react-hooks/exhaustive-deps
  const phase = useArenaSession((s) => s.phase);
  const storyFocusActive = useArenaSession((s) => s.storyTransmission !== null);
  const rewardsGranted = useArenaSession((s) => s.rewardsGranted);
  const heroArchetype = useGameStore((s) => s.hero?.archetype) ?? "vanguard";
  const pilotBody = useGameStore((s) => s.pilotBody);
  const hero = HEROES[heroArchetype] ?? HEROES.vanguard;
  const heroModel = ARENA_PILOTS[pilotBody].model;
  const heroAnimations = ARENA_PILOTS[pilotBody].animations;
  const operator = ARENA_OPERATORS[heroArchetype] ?? ARENA_OPERATORS.vanguard;

  useEffect(() => {
    // Lokalna Arena je uvijek testabilna. Query ostaje eksplicitan ulaz iz Huba
    // i buduci staging signal, ali dev build vise ne moze "izgubiti" QA deck.
    setTestMode(
      process.env.NODE_ENV === "development" ||
        new URLSearchParams(window.location.search).get("test") === "1"
    );
  }, []);

  useEffect(() => {
    const session = useArenaSession.getState();
    arenaAudio.stop();
    session.reset();
    setRunUnlockIds([]);
    const stats = useGameStore.getState().stats;
    const artifact = stats.artifactWeapons[heroArchetype];
    const progression = computePermanentProgressionEffects(
      stats.skills,
      heroArchetype,
      artifact
    );
    session.setOperatorMods(mergePermanentProgression(operator.stats, progression));
    session.bindClassWeapon(ARENA_CLASSES[heroArchetype].relicClass, artifact.tier);
    const loadout = stats.arenaLoadouts[heroArchetype];
    const equippedGear = Object.values(loadout).filter(
      (id): id is CraftingRecipeId => id !== null
    );
    session.setGearMods(computeGearMods(equippedGear));
    session.setUpgradePool(stats.unlockedArenaUpgrades);
  // Operativac se bira u hubu prije mounta arene; novi run mijenja samo runId.
  }, [runId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return useArenaSession.subscribe((state, previous) => {
      if (state.phase === "running") {
        const progress = 1 - state.timeLeft / ARENA_CONFIG.meta.durationSeconds;
        arenaAudio.setIntensity(progress);
        arenaAudio.setPaused(false);
      } else if (
        state.phase === "upgrade" ||
        state.phase === "evolution" ||
        state.phase === "relic"
      ) {
        arenaAudio.setPaused(true);
      }
      if (
        state.phase !== previous.phase &&
        (state.phase === "victory" || state.phase === "defeat")
      ) {
        arenaAudio.endRun(state.phase);
      }
    });
  }, []);

  useEffect(() => () => arenaAudio.stop(), []);

  // Run nagrade idu u trajni profil i na poraz; pobjeda dodaje bazni bonus i materijale.
  useEffect(() => {
    if ((phase !== "victory" && phase !== "defeat") || rewardsGranted) return;
    const session = useArenaSession.getState();
    const game = useGameStore.getState();
    const rewards = computeRunRewards(phase === "victory", session.score);
    game.addXp(rewards.xp);
    game.addCredits(rewards.credits);
    if (phase === "victory") game.addMaterials(ARENA_CONFIG.rewards.materials);
    setRunUnlockIds(game.completeArenaRun());
    session.markRewardsGranted();
  }, [phase, rewardsGranted]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#05070d]">
      <Canvas
        key={runId}
        shadows
        dpr={[1, 1.5]}
        camera={{ fov: CAMERA.fov, position: [0, CAMERA.height, CAMERA.offsetZ], near: 0.5, far: 160 }}
        onCreated={(state) => {
          if (process.env.NODE_ENV === "development") {
            (window as unknown as Record<string, unknown>).__r3f = state;
          }
        }}
      >
        <Suspense fallback={null}>
          <ArenaWorldContext.Provider value={world}>
            <Physics paused={phase !== "running" || storyFocusActive}>
              <ArenaScene
                heroModel={heroModel}
                heroAnimations={heroAnimations}
                heroAccent={hero.accent}
                operator={operator}
                controlMode={controlMode}
              />
            </Physics>
          </ArenaWorldContext.Provider>
        </Suspense>
      </Canvas>
      <Hud />
      <MinimapHud world={world} runId={runId} />
      <FixerContractHud />
      <ComboMilestoneBanner />
      <BossCataclysmBanner />
      <StoryTransmissionHud />
      <PortalAccessHud />
      {testMode && phase !== "briefing" ? (
        <QaControlDeck
          world={world}
          onRestart={() => {
            arenaAudio.stop();
            setRunId((id) => id + 1);
          }}
        />
      ) : null}
      {phase === "briefing" && (
        <BriefingOverlay
          heroLabel={hero.label}
          heroAccent={hero.accent}
          operator={operator}
          controlMode={controlMode}
          onControlMode={setControlMode}
          onStart={() => {
            void arenaAudio.startRun();
            const session = useArenaSession.getState();
            const game = useGameStore.getState();
            session.start();
            session.queueStoryTransmission(
              game.stats.endgameUnlocked && game.stats.artifactWeapons[heroArchetype].tier >= 3
                ? "endgame_loop"
                : "act1_opening"
            );
          }}
        />
      )}
      {phase === "upgrade" && (
        <UpgradeOverlay
          onPicked={(id) => {
            const upgrade = ARENA_UPGRADES.find((u) => u.id === id);
            if (upgrade) {
              arenaAudio.sfx("ability");
              world.spawnEffect("nova", world.playerPosition.clone().setY(1), upgrade.color, 0.9);
            }
          }}
        />
      )}
      {phase === "evolution" && (
        <EvolutionOverlay
          onContinue={(color) => {
            arenaAudio.sfx("ability");
            world.spawnEffect("nova", world.playerPosition.clone().setY(1), color, 1.35);
            world.triggerScreenShake(0.8, 220);
          }}
        />
      )}
      {phase === "relic" && <RelicChoiceOverlay />}
      {(phase === "victory" || phase === "defeat") && (
        <EndOverlay
          victory={phase === "victory"}
          runUnlockIds={runUnlockIds}
          onRetry={() => {
            arenaAudio.stop();
            setRunId((id) => id + 1);
          }}
          onNewOperative={(classId) => {
            const game = useGameStore.getState();
            if (!game.startOperativeCycle(classId)) return;
            arenaAudio.stop();
            setRunId((id) => id + 1);
          }}
        />
      )}
    </div>
  );
}
