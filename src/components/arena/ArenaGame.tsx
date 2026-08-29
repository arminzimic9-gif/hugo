"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import ARENA_CONFIG from "@/data/arena-config.json";
import ARENA_UPGRADES from "@/data/arena-upgrades.json";
import { HEROES } from "@/data/heroes";
import { useGameStore } from "@/store/gameStore";
import { useArenaSession } from "@/store/arenaSession";
import { ArenaWorldContext, createArenaWorld } from "./world";
import ArenaScene from "./ArenaScene";

const CAMERA = ARENA_CONFIG.camera;

function Hud() {
  const session = useArenaSession();
  const seconds = Math.ceil(session.timeLeft);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 font-mono text-white">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-gray-500">{ARENA_CONFIG.meta.descriptor}</div>
          <div className="font-display text-2xl tracking-[0.2em]">{ARENA_CONFIG.meta.name}</div>
        </div>
        <div
          className="border px-4 py-2 text-3xl tabular-nums"
          style={{ borderColor: seconds <= 10 ? ARENA_CONFIG.meta.danger : "#1f2937" }}
        >
          {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
        </div>
        <div className="text-right">
          <div className="text-[10px] tracking-[0.3em] text-gray-500">SCORE</div>
          <div className="text-2xl tabular-nums" style={{ color: ARENA_CONFIG.meta.accent }}>
            {session.score.toLocaleString()}
          </div>
          <div className="text-[10px] tracking-[0.3em] text-gray-500">KILLS {session.kills}</div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="w-24 text-[10px] tracking-[0.3em] text-gray-500">INTEGRITY</span>
          <div className="h-2 flex-1 border border-gray-800 bg-black/60">
            <div
              className="h-full transition-all duration-150"
              style={{
                width: `${(session.health / session.maxHealth) * 100}%`,
                background: session.health / session.maxHealth > 0.35 ? ARENA_CONFIG.meta.support : ARENA_CONFIG.meta.danger,
              }}
            />
          </div>
          <span className="w-16 text-right text-xs tabular-nums">
            {Math.ceil(session.health)}/{session.maxHealth}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-24 text-[10px] tracking-[0.3em] text-gray-500">LINK LV {session.xpLevel}</span>
          <div className="h-1.5 flex-1 border border-gray-800 bg-black/60">
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, (session.xp / session.xpNeeded) * 100)}%`,
                background: ARENA_CONFIG.meta.accent,
              }}
            />
          </div>
          <span className="w-16 text-right text-[10px] text-gray-500">
            {session.xp}/{session.xpNeeded}
          </span>
        </div>
      </div>
    </div>
  );
}

function OverlayFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl border border-gray-800 bg-[#05070d]/95 p-8 text-center font-mono text-white">
        {children}
      </div>
    </div>
  );
}

function UpgradeOverlay() {
  const options = useArenaSession((s) => s.upgradeOptions);
  const ranks = useArenaSession((s) => s.upgradeRanks);
  const chooseUpgrade = useArenaSession((s) => s.chooseUpgrade);
  return (
    <OverlayFrame>
      <div className="mb-1 text-[10px] tracking-[0.3em] text-gray-500">NEURAL LINK ESTABLISHED</div>
      <div className="font-display mb-6 text-xl tracking-[0.2em]">SELECT SUPPORT LINK</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((id) => {
          const upgrade = ARENA_UPGRADES.find((u) => u.id === id);
          if (!upgrade) return null;
          return (
            <button
              key={id}
              onClick={() => chooseUpgrade(id)}
              className="group border border-gray-800 p-4 text-left transition-colors hover:bg-white/5"
              style={{ borderTopColor: upgrade.color, borderTopWidth: 2 }}
            >
              <div className="text-[9px] tracking-[0.25em]" style={{ color: upgrade.color }}>
                {upgrade.branch}
              </div>
              <div className="font-display mt-1 text-sm tracking-widest">{upgrade.label}</div>
              <div className="mt-2 text-[10px] leading-relaxed text-gray-400">{upgrade.description}</div>
              <div className="mt-2 text-[9px] text-gray-600">RANK {(ranks[id] ?? 0) + 1}</div>
            </button>
          );
        })}
      </div>
    </OverlayFrame>
  );
}

function EndOverlay({ victory, onRetry }: { victory: boolean; onRetry: () => void }) {
  const router = useRouter();
  const session = useArenaSession();
  const rewards = useMemo(() => {
    if (!victory) return null;
    return {
      xp: ARENA_CONFIG.rewards.baseXp + Math.floor(session.score / ARENA_CONFIG.rewards.scoreXpDivisor),
      credits:
        ARENA_CONFIG.rewards.baseCredits + Math.floor(session.score / ARENA_CONFIG.rewards.scoreCreditsDivisor),
    };
  }, [victory, session.score]);

  return (
    <OverlayFrame>
      <div
        className="font-display mb-2 text-3xl tracking-[0.25em]"
        style={{ color: victory ? ARENA_CONFIG.meta.support : ARENA_CONFIG.meta.danger }}
      >
        {victory ? "SECTOR HELD" : "SIGNAL LOST"}
      </div>
      <div className="mb-6 text-[10px] tracking-[0.3em] text-gray-500">
        SCORE {session.score.toLocaleString()} · KILLS {session.kills} · LINK LV {session.xpLevel}
      </div>
      {rewards && (
        <div className="mb-6 text-xs text-gray-300">
          +{rewards.xp} XP · +{rewards.credits} CR · MATERIJALI DODANI
        </div>
      )}
      <div className="flex justify-center gap-4">
        <button
          onClick={onRetry}
          className="border border-gray-700 px-6 py-3 text-xs tracking-[0.25em] transition-colors hover:bg-white hover:text-black"
        >
          RE-DEPLOY
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

function BriefingOverlay({ heroLabel, onStart }: { heroLabel: string; onStart: () => void }) {
  return (
    <OverlayFrame>
      <div className="mb-1 text-[10px] tracking-[0.3em] text-gray-500">{ARENA_CONFIG.meta.levelTag} · {heroLabel}</div>
      <div className="font-display mb-4 text-3xl tracking-[0.25em]">{ARENA_CONFIG.meta.name}</div>
      <div className="mb-6 space-y-1 text-[11px] leading-relaxed text-gray-400">
        <div>Preživi {ARENA_CONFIG.meta.durationSeconds} sekundi.</div>
        <div>WASD / strelice za kretanje. Oružje puca samo.</div>
        <div>Skupljaj data core-ove i biraj support linkove.</div>
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

export default function ArenaGame() {
  const [runId, setRunId] = useState(0);
  const world = useMemo(() => createArenaWorld(), [runId]); // eslint-disable-line react-hooks/exhaustive-deps
  const phase = useArenaSession((s) => s.phase);
  const rewardsGranted = useArenaSession((s) => s.rewardsGranted);
  const heroArchetype = useGameStore((s) => s.hero?.archetype) ?? "vanguard";
  const hero = HEROES[heroArchetype] ?? HEROES.vanguard;
  const heroModel = hero.model ?? HEROES.vanguard.model!;

  useEffect(() => {
    useArenaSession.getState().reset();
  }, [runId]);

  // Nagrade u trajni profil, samo jednom po pobjedi
  useEffect(() => {
    if (phase !== "victory" || rewardsGranted) return;
    const session = useArenaSession.getState();
    const game = useGameStore.getState();
    game.addXp(ARENA_CONFIG.rewards.baseXp + Math.floor(session.score / ARENA_CONFIG.rewards.scoreXpDivisor));
    game.addCredits(
      ARENA_CONFIG.rewards.baseCredits + Math.floor(session.score / ARENA_CONFIG.rewards.scoreCreditsDivisor)
    );
    game.addMaterials(ARENA_CONFIG.rewards.materials);
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
            <Physics paused={phase !== "running"}>
              <ArenaScene heroModel={heroModel} />
            </Physics>
          </ArenaWorldContext.Provider>
        </Suspense>
      </Canvas>
      <Hud />
      {phase === "briefing" && (
        <BriefingOverlay heroLabel={hero.label} onStart={() => useArenaSession.getState().start()} />
      )}
      {phase === "upgrade" && <UpgradeOverlay />}
      {(phase === "victory" || phase === "defeat") && (
        <EndOverlay victory={phase === "victory"} onRetry={() => setRunId((id) => id + 1)} />
      )}
    </div>
  );
}
