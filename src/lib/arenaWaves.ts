import SPAWN_TABLE from "@/data/arena-spawn-tables.json";

export type ArenaWavePhase = (typeof SPAWN_TABLE.phases)[number];
export type ArenaBreak = (typeof SPAWN_TABLE.breaks)[number];

export type ArenaWaveState = {
  breakWindow: ArenaBreak | null;
  elapsed: number;
  index: number;
  nextEliteSecond: number | null;
  phase: ArenaWavePhase;
  phaseProgress: number;
};

export function getArenaWaveState(elapsedSeconds: number): ArenaWaveState {
  const elapsed = Math.max(0, elapsedSeconds);
  let phaseStart = 0;
  let index = SPAWN_TABLE.phases.length - 1;
  let phase = SPAWN_TABLE.phases[index];

  for (let candidateIndex = 0; candidateIndex < SPAWN_TABLE.phases.length; candidateIndex++) {
    const candidate = SPAWN_TABLE.phases[candidateIndex];
    if (elapsed <= candidate.untilSecond) {
      index = candidateIndex;
      phase = candidate;
      break;
    }
    phaseStart = candidate.untilSecond;
  }

  const phaseDuration = Math.max(1, phase.untilSecond - phaseStart);
  const phaseProgress = Math.max(0, Math.min(1, (elapsed - phaseStart) / phaseDuration));
  const breakWindow =
    SPAWN_TABLE.breaks.find(
      (candidate) => elapsed >= candidate.startSecond && elapsed < candidate.endSecond
    ) ?? null;
  const nextEliteSecond =
    SPAWN_TABLE.scripted.find((event) => event.second > elapsed)?.second ?? null;

  return { breakWindow, elapsed, index, nextEliteSecond, phase, phaseProgress };
}
