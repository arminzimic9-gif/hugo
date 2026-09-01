export type ArenaSfx =
  | "deploy"
  | "playerShot"
  | "hit"
  | "kill"
  | "pickup"
  | "levelUp"
  | "hurt"
  | "ability"
  | "eliteSpawn"
  | "victory"
  | "defeat";

export type EnemyShotVoice = "drone" | "heavy" | "hunter" | "elite";

const LOOKAHEAD_SECONDS = 0.18;
const SCHEDULER_INTERVAL_MS = 80;
const MIN_GAIN = 0.0001;

const THROTTLE_MS: Partial<Record<ArenaSfx | "enemyShot", number>> = {
  playerShot: 75,
  hit: 38,
  kill: 55,
  pickup: 45,
  hurt: 150,
  enemyShot: 65,
};

function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

class ArenaAudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private step = 0;
  private intensity = 0;
  private running = false;
  private paused = false;
  private lastPlayed = new Map<string, number>();

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof window === "undefined") return null;
    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;

    const context = new AudioContextConstructor();
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const musicFilter = context.createBiquadFilter();
    const music = context.createGain();
    const sfx = context.createGain();

    compressor.threshold.value = -12;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.22;
    master.gain.value = 0.72;
    music.gain.value = 0.27;
    sfx.gain.value = 0.64;
    musicFilter.type = "lowpass";
    musicFilter.frequency.value = 1500;
    musicFilter.Q.value = 0.65;

    music.connect(musicFilter);
    musicFilter.connect(compressor);
    sfx.connect(compressor);
    compressor.connect(master);
    master.connect(context.destination);

    this.context = context;
    this.masterGain = master;
    this.musicGain = music;
    this.sfxGain = sfx;
    this.musicFilter = musicFilter;
    return context;
  }

  private getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  private canPlay(name: ArenaSfx | "enemyShot"): boolean {
    const now = performance.now();
    const throttle = THROTTLE_MS[name] ?? 0;
    const last = this.lastPlayed.get(name) ?? -Infinity;
    if (now - last < throttle) return false;
    this.lastPlayed.set(name, now);
    return true;
  }

  private tone(
    frequency: number,
    duration: number,
    options: {
      at?: number;
      endFrequency?: number;
      gain?: number;
      type?: OscillatorType;
      destination?: AudioNode | null;
    } = {}
  ): void {
    const context = this.context;
    const destination = options.destination ?? this.sfxGain;
    if (!context || !destination) return;
    const at = options.at ?? context.currentTime;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), at);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, options.endFrequency),
        at + duration
      );
    }
    envelope.gain.setValueAtTime(MIN_GAIN, at);
    envelope.gain.exponentialRampToValueAtTime(options.gain ?? 0.16, at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, at + duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  private noise(
    duration: number,
    options: { at?: number; gain?: number; highpass?: number; destination?: AudioNode | null } = {}
  ): void {
    const context = this.context;
    const destination = options.destination ?? this.sfxGain;
    if (!context || !destination) return;
    const at = options.at ?? context.currentTime;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = this.getNoiseBuffer(context);
    filter.type = "highpass";
    filter.frequency.value = options.highpass ?? 900;
    envelope.gain.setValueAtTime(options.gain ?? 0.08, at);
    envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, at + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(destination);
    source.start(at);
    source.stop(at + duration + 0.02);
  }

  private scheduleMusic(): void {
    const context = this.context;
    if (!context || !this.running) return;
    const bpm = 104 + this.intensity * 28;
    const stepDuration = 60 / bpm / 4;
    while (this.nextStepTime < context.currentTime + LOOKAHEAD_SECONDS) {
      this.scheduleMusicStep(this.step % 16, this.nextStepTime);
      this.nextStepTime += stepDuration;
      this.step += 1;
    }
  }

  private scheduleMusicStep(step: number, at: number): void {
    const destination = this.musicGain;
    if (!destination) return;
    const bassPattern = [36, 36, 43, 36, 46, 43, 36, 31];
    if (step % 2 === 0) {
      const note = bassPattern[Math.floor(step / 2)];
      this.tone(midiToFrequency(note), 0.2, {
        at,
        endFrequency: midiToFrequency(note - 12),
        gain: 0.07 + this.intensity * 0.035,
        type: "sawtooth",
        destination,
      });
    }

    if (step % 4 === 0) {
      this.tone(105, 0.12, {
        at,
        endFrequency: 42,
        gain: 0.2,
        type: "sine",
        destination,
      });
    }
    if (step % 2 === 1 && (this.intensity > 0.16 || step % 4 === 3)) {
      this.noise(0.045, {
        at,
        gain: 0.035 + this.intensity * 0.025,
        highpass: 5200,
        destination,
      });
    }
    if (step === 0) {
      const root = this.intensity > 0.62 ? 48 : 43;
      for (const offset of [0, 7, 12]) {
        this.tone(midiToFrequency(root + offset), 1.35, {
          at,
          gain: 0.018,
          type: "triangle",
          destination,
        });
      }
    }
  }

  async startRun(): Promise<void> {
    const context = this.ensureContext();
    if (!context) return;
    await context.resume();
    this.stopScheduler();
    this.running = true;
    this.paused = false;
    this.intensity = 0;
    this.step = 0;
    this.nextStepTime = context.currentTime + 0.04;
    this.musicGain?.gain.cancelScheduledValues(context.currentTime);
    this.musicGain?.gain.setValueAtTime(MIN_GAIN, context.currentTime);
    this.musicGain?.gain.exponentialRampToValueAtTime(0.27, context.currentTime + 0.45);
    this.musicFilter?.frequency.setTargetAtTime(1500, context.currentTime, 0.2);
    this.sfx("deploy");
    this.scheduleMusic();
    this.scheduler = setInterval(() => this.scheduleMusic(), SCHEDULER_INTERVAL_MS);
  }

  setIntensity(progress: number): void {
    const context = this.context;
    this.intensity = Math.max(0, Math.min(1, progress));
    if (!context || !this.musicFilter) return;
    this.musicFilter.frequency.setTargetAtTime(
      1500 + this.intensity * 3400,
      context.currentTime,
      0.18
    );
  }

  setPaused(paused: boolean): void {
    const context = this.context;
    if (!context || !this.musicGain || this.paused === paused) return;
    this.paused = paused;
    this.musicGain.gain.cancelScheduledValues(context.currentTime);
    this.musicGain.gain.setTargetAtTime(paused ? 0.08 : 0.27, context.currentTime, 0.08);
  }

  endRun(outcome: "victory" | "defeat"): void {
    const context = this.context;
    if (!context) return;
    this.sfx(outcome);
    this.running = false;
    this.stopScheduler();
    this.musicGain?.gain.cancelScheduledValues(context.currentTime);
    this.musicGain?.gain.setTargetAtTime(MIN_GAIN, context.currentTime, 0.16);
  }

  stop(): void {
    this.running = false;
    this.stopScheduler();
    if (this.context && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(MIN_GAIN, this.context.currentTime, 0.04);
    }
  }

  private stopScheduler(): void {
    if (this.scheduler) clearInterval(this.scheduler);
    this.scheduler = null;
  }

  enemyShot(kind: EnemyShotVoice): void {
    if (!this.context || !this.canPlay("enemyShot")) return;
    const voices: Record<EnemyShotVoice, [number, number, OscillatorType, number]> = {
      drone: [430, 210, "square", 0.08],
      heavy: [105, 42, "sawtooth", 0.24],
      hunter: [980, 420, "triangle", 0.11],
      elite: [165, 52, "sawtooth", 0.32],
    };
    const [start, end, type, duration] = voices[kind];
    this.tone(start, duration, { endFrequency: end, gain: kind === "heavy" ? 0.2 : 0.1, type });
    if (kind === "heavy" || kind === "elite") this.noise(0.1, { gain: 0.06, highpass: 240 });
  }

  combo(count: number): void {
    const context = this.context;
    if (!context || count < 3) return;
    const tier = Math.min(12, count);
    const frequency = 360 + tier * 42;
    this.tone(frequency, 0.085, {
      at: context.currentTime,
      endFrequency: frequency * 1.22,
      gain: 0.055 + Math.min(0.05, count * 0.0025),
      type: "triangle",
    });
  }

  milestone(combo: number): void {
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    const tier = Math.max(0, Math.log2(Math.max(50, combo) / 50));
    const root = 110 * 2 ** Math.min(1.5, tier * 0.16);
    this.noise(0.42, { at: now, gain: 0.13, highpass: 180 });
    [1, 1.5, 2, 3].forEach((multiple, index) => {
      this.tone(root * multiple, 0.52 - index * 0.055, {
        at: now + index * 0.055,
        endFrequency: root * multiple * 2.1,
        gain: 0.15 - index * 0.018,
        type: index % 2 === 0 ? "sawtooth" : "triangle",
      });
    });
  }

  sfx(name: ArenaSfx): void {
    const context = this.context;
    if (!context || !this.canPlay(name)) return;
    const now = context.currentTime;
    switch (name) {
      case "deploy":
        this.tone(110, 0.5, { at: now, endFrequency: 880, gain: 0.17, type: "sawtooth" });
        this.tone(220, 0.46, { at: now + 0.06, endFrequency: 1320, gain: 0.09, type: "triangle" });
        break;
      case "playerShot":
        this.tone(720, 0.055, { at: now, endFrequency: 240, gain: 0.075, type: "square" });
        break;
      case "hit":
        this.noise(0.038, { at: now, gain: 0.07, highpass: 1700 });
        this.tone(135, 0.05, { at: now, endFrequency: 72, gain: 0.06, type: "triangle" });
        break;
      case "kill":
        this.noise(0.085, { at: now, gain: 0.09, highpass: 520 });
        this.tone(190, 0.12, { at: now, endFrequency: 510, gain: 0.09, type: "sawtooth" });
        break;
      case "pickup":
        this.tone(820, 0.09, { at: now, endFrequency: 1180, gain: 0.09, type: "sine" });
        this.tone(1230, 0.1, { at: now + 0.055, endFrequency: 1640, gain: 0.06, type: "sine" });
        break;
      case "levelUp":
        [440, 660, 880, 1320].forEach((frequency, index) => {
          this.tone(frequency, 0.16, { at: now + index * 0.075, gain: 0.1, type: "triangle" });
        });
        break;
      case "hurt":
        this.tone(125, 0.24, { at: now, endFrequency: 43, gain: 0.2, type: "sawtooth" });
        this.noise(0.11, { at: now, gain: 0.08, highpass: 180 });
        break;
      case "ability":
        this.tone(180, 0.42, { at: now, endFrequency: 1600, gain: 0.15, type: "sawtooth" });
        this.tone(360, 0.38, { at: now + 0.04, endFrequency: 2200, gain: 0.08, type: "sine" });
        break;
      case "eliteSpawn":
        this.tone(72, 0.65, { at: now, endFrequency: 44, gain: 0.22, type: "sawtooth" });
        this.tone(144, 0.45, { at: now + 0.2, endFrequency: 61, gain: 0.12, type: "square" });
        break;
      case "victory":
        [262, 330, 392, 523].forEach((frequency, index) => {
          this.tone(frequency, 0.5, { at: now + index * 0.11, gain: 0.12, type: "triangle" });
        });
        break;
      case "defeat":
        this.tone(220, 0.8, { at: now, endFrequency: 38, gain: 0.2, type: "sawtooth" });
        this.noise(0.45, { at: now, gain: 0.08, highpass: 130 });
        break;
    }
  }

  debugState(): Record<string, number | boolean | string> {
    return {
      contextState: this.context?.state ?? "uninitialized",
      intensity: Number(this.intensity.toFixed(3)),
      paused: this.paused,
      running: this.running,
      step: this.step,
    };
  }
}

export const arenaAudio = new ArenaAudioEngine();

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as typeof window & { __arenaAudio?: ArenaAudioEngine }).__arenaAudio = arenaAudio;
}
