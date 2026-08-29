"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { LEVELS_PER_SECTOR } from "@/store/gameStore";
import { CURSORS } from "@/data/cursors";
import { ACHIEVEMENT_BY_ID } from "@/data/achievements";
import { getLevelIntel } from "@/data/progression";
import GameHud, { type GameHudSnapshot } from "@/components/game/GameHud";
import {
  MATERIALS_BY_ID,
  createEmptyMaterialInventory,
  rollMaterialForLevel,
  type CraftingRecipeId,
  type MaterialId,
} from "@/data/crafting";

const TESTING_BOSS_SECTOR_ID = 100;
const TESTING_BOSS_LEVEL = (TESTING_BOSS_SECTOR_ID - 1) * LEVELS_PER_SECTOR + 1;

const PLANETS = [
  { id: 1, name: "CYBERIA",      color: "#00f2ff" },
  { id: 2, name: "MAGMA PRIME",  color: "#ff1a24" },
  { id: 3, name: "VOID NEXUS",   color: "#bc13fe" },
  { id: 4, name: "QUANTUM CORE", color: "#00ff88" },
  { id: 5, name: "OMEGA STATION",color: "#ffffff" }
];

const BOSS_PROFILES: Record<number, { name: string; color: string; accent: string; pattern: string }> = {
  1: { name: "CYBER SENTINEL", color: "#00f2ff", accent: "#ffffff", pattern: "laser" },
  2: { name: "MAGMA FORGE", color: "#ff1a24", accent: "#ffcc66", pattern: "meteor" },
  3: { name: "VOID ARCHON", color: "#bc13fe", accent: "#ffffff", pattern: "ring" },
  4: { name: "QUANTUM MIRROR", color: "#00ff88", accent: "#bfffee", pattern: "split" },
  5: { name: "OMEGA FIREWALL", color: "#ffffff", accent: "#ff003c", pattern: "omega" },
  99: { name: "LUDILO CORE", color: "#ff00a2", accent: "#ffffff", pattern: "chaos" },
  100: { name: "EVIL EYE OVERSEER", color: "#ef4444", accent: "#ffb26b", pattern: "chaos" },
};

const EMPTY_HUD: GameHudSnapshot = {
  score: 0,
  combo: 0,
  lives: 1,
  levelLabel: "L01",
  modeLabel: "TACTICAL",
  targetLabel: "0 / 0",
  progress: 0,
  powerLabel: "READY",
  powerProgress: 0,
  sectionLabel: "INTRO GRID",
  modifierLabel: "NONE",
  modifierProgress: 0,
  checkpointLabel: "OFF",
  bestRankLabel: "-",
  objectives: [],
  bossActive: false,
  bossPhase: 1,
  bossHealth: 100,
  bossName: "",
  bossColor: "#ef4444",
  eyeX: 0,
  eyeY: 0,
  eyeScale: 1,
  eyeActive: false,
  lightningActive: false,
  lightningHue: 230,
  lightningIntensity: 1,
  lightningSpeed: 1,
  lightningSize: 1,
  lightningXOffset: 0,
  isTestingBoss: false,
};

type RankTier = "S" | "A" | "B" | "C";
type GdModifierType = "none" | "laserstorm";

const GD_SECTION_LABELS = ["INTRO GRID", "SPEED BURST", "PRECISION ZONE", "CHAOS FINALE"] as const;
const RANK_STORAGE_KEY = "hugo-level-ranks-v1";
const RANK_SCORE: Record<RankTier, number> = { C: 1, B: 2, A: 3, S: 4 };

const POWER_COOLDOWN_FRAMES: Record<string, number> = {
  slow: 380,
  freeze: 420,
  quake: 280,
  whiteout: 320,
  void: 260,
  giant: 360,
};

export default function PlayArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { username, currentCampaignLevel, stats, hero, addScore, addXp, addCredits, addMaterials, completeLevel, setReplayLevel, unlockAchievement } = useGameStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [storeHydrated, setStoreHydrated] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameResult, setGameResult] = useState<{status: string, score: number, title: string, levelStr: string} | null>(null);
  const [currentLevel, setCurrentLevel] = useState(() => currentCampaignLevel ?? 1);
  const [restartKey, setRestartKey] = useState(0);
  const [missionStarted, setMissionStarted] = useState(false);
  const [levelClearBanner, setLevelClearBanner] = useState<string | null>(null);
  const [hud, setHud] = useState<GameHudSnapshot>(EMPTY_HUD);
  const [achievementToast, setAchievementToast] = useState<{ name: string; description: string } | null>(null);
  const [bossIntro, setBossIntro] = useState<string | null>(null);
  // Level select modal (shown after sector boss is beaten)
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [levelSelectSector, setLevelSelectSector] = useState(1);

  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setMounted(true);
    setStoreHydrated(useGameStore.persist.hasHydrated());
    return useGameStore.persist.onFinishHydration(() => setStoreHydrated(true));
  }, []);

  useEffect(() => {
    if (mounted && storeHydrated && !username) router.push("/hub");
  }, [mounted, storeHydrated, username, router]);

  useEffect(() => {
    if (!mounted || !missionStarted || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    let animationFrameId: number;
    let spawnTimeoutId: NodeJS.Timeout;
    let lastTime = 0;
    let lastHudCommit = 0;
    const ULTRA_SMOOTH_MODE = true;
    
    // Derive sector from current level (11 levels per sector: 10 regular + 1 boss)
    const sectorId = Math.ceil(currentLevel / LEVELS_PER_SECTOR);
    const isTestingBossSector = sectorId === TESTING_BOSS_SECTOR_ID;
    const planet = sectorId === 99
      ? { id: 99, name: "LUDILO", color: "#ff00a2" }
      : isTestingBossSector
      ? { id: TESTING_BOSS_SECTOR_ID, name: "BOSS TEST", color: "#ef4444" }
      : PLANETS[(sectorId - 1) % PLANETS.length] || PLANETS[0];
    const bossProfile = BOSS_PROFILES[sectorId] ?? BOSS_PROFILES[1];
    
    // Game State
    let active = true;
    let paused = false;
    let tick = 0;
    let shake = 0;
    let sessionScore = 0;
    let levelType = 'ninja';
    let targetsDestroyed = 0;
    let targetsNeeded = 10;
    let timeRemaining = 0;
    let levelElapsed = 0;
    let combo = 0;
    let levelTookDamage = false;
    let usedTimeMechanic = false;
    let firstJumpTriggered = false;
    let laserContactCount = 0;
    let operativeCheckpoint = 0;
    
    let slowMo = 0;
    let autoSlicer = 0;
    let multiScore = 0;
    let rocketRain = 0;
    let magnetActive = 0;
    let shieldActive = false;
    let giantModeTimer = 0;
    const spellCooldowns: Record<string,number> = { q:0, e:0, r:0, f:0 };
    const SPELL_MAX: Record<string,number> = { q:300, e:250, r:500, f:60 };
    let chaosFrenzyTimer = 0;
    
    // GD platformer state
    let gdPlayer = { x: 0, y: 0, vy: 0, size: 40, grounded: false, gravFlipped: false, dead: false, jumpsUsed: 0 };
    let gdObstacles: any[] = [];
    let gdJumpQueued = false;
    let gdDistanceTravelled = 0;
    let gdRocketTimer = 0;
    let operativeTrackGoal = 9000;
    let gdSectionIndex = 0;
    let gdSectionBanner = "";
    let gdPracticeMode = true;
    let gdCheckpointReady = true;
    let gdInvulnTimer = 0;
    let gdModifierType: GdModifierType = "none";
    let gdModifierTimer = 0;
    let gdModifierCooldown = 180;
    let gdMiniBossTriggered = false;
    let gdMiniBossActive = false;
    let gdMiniBossTimer = 0;
    let gdMiniBossFireTimer = 0;
    let gdMiniBossDroneY = 0;
    let gdBestRank: RankTier | null = null;
    let gdCoreGoalReached = false;

    // Cube shooter state, used by the former Snail Mail levels.
    let snailPlayer = { x: 0, y: 0, targetX: 0, targetY: 0, lane: 1, targetLane: 1, speed: 0, shield: 0, boost: 0, shootCooldown: 0, dead: false };
    let snailObstacles: any[] = [];
    let snailShots: any[] = [];
    let snailDistance = 0;
    let snailTrackLength = 0;
    let snailLaneCount = 3;

    // ── CURSOR FX STATE ──────────────────────────────────────────────────────
    let cursorParticles: any[] = [];
    let cursorTrail: any[] = [];
    let glitchTimer = 0;
    let mercuryMorph = 0;
    const activeId = stats.activeCursorId || 1;
    const activeCursor = CURSORS.find(c => c.id === activeId) || CURSORS[0];

    // ── NEURAL CHESS ──────────────────────────────────────────────────────────
    type ChessPiece = { type: 'core'|'lance'|'blade'|'ghost'; owner: 'player'|'enemy' };
    let chessBoard: (ChessPiece|null)[][] = [];
    let chessTurn: 'player'|'enemy' = 'player';
    let chessSelected: {r:number,c:number}|null = null;
    let chessValidMoves: {r:number,c:number}[] = [];
    let chessAIDelay = 0;
    let chessMsg = '';
    let chessHackUsed = false;
    const CHESS_ROWS = 5, CHESS_COLS = 5;
    const PIECE_SYM: Record<string,string> = { core:'◈', lance:'╋', blade:'◆', ghost:'⟡' };

    const initChess = () => {
      const B: (ChessPiece|null)[][] = Array.from({length:CHESS_ROWS},()=>Array(CHESS_COLS).fill(null));
      B[0] = [{type:'lance',owner:'enemy'},{type:'ghost',owner:'enemy'},{type:'core',owner:'enemy'},{type:'ghost',owner:'enemy'},{type:'lance',owner:'enemy'}];
      B[4] = [{type:'lance',owner:'player'},{type:'ghost',owner:'player'},{type:'core',owner:'player'},{type:'ghost',owner:'player'},{type:'lance',owner:'player'}];
      chessBoard=B; chessTurn='player'; chessSelected=null;
      chessValidMoves=[]; chessAIDelay=0; chessMsg='YOUR MOVE — click a piece';
    };

    const getChessMoves = (board:(ChessPiece|null)[][], r:number, c:number):{r:number,c:number}[] => {
      const piece=board[r][c]; if(!piece) return [];
      const moves:{r:number,c:number}[]=[];
      const inB=(r:number,c:number)=>r>=0&&r<CHESS_ROWS&&c>=0&&c<CHESS_COLS;
      const canLand=(r:number,c:number)=>inB(r,c)&&(!board[r][c]||board[r][c]!.owner!==piece.owner);
      if(piece.type==='core'){
        for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
          if(dr===0&&dc===0)continue; if(canLand(r+dr,c+dc))moves.push({r:r+dr,c:c+dc});
        }
      } else if(piece.type==='lance'){
        for(const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0]]) if(canLand(r+dr,c+dc)) moves.push({r:r+dr,c:c+dc});
      } else if(piece.type==='blade'){
        for(const [dr,dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) if(canLand(r+dr,c+dc)) moves.push({r:r+dr,c:c+dc});
      } else if(piece.type==='ghost'){
        for(const [dr,dc] of [[0,2],[0,-2],[2,0],[-2,0],[2,2],[2,-2],[-2,2],[-2,-2]]) if(canLand(r+dr,c+dc)) moves.push({r:r+dr,c:c+dc});
      }
      return moves;
    };

    const doChessAI = () => {
      const allMoves:{fr:number,fc:number,tr:number,tc:number,score:number}[]=[];
      for(let r=0;r<CHESS_ROWS;r++) for(let c=0;c<CHESS_COLS;c++){
        if(chessBoard[r][c]?.owner!=='enemy')continue;
        for(const m of getChessMoves(chessBoard,r,c)){
          const target=chessBoard[m.r][m.c];
          let score=target?(target.type==='core'?1000:target.type==='lance'?30:target.type==='ghost'?25:10):0;
          const pcR=chessBoard.findIndex(row=>row.some(p=>p?.type==='core'&&p?.owner==='player'));
          score+=Math.max(0,3-Math.abs(m.r-pcR));
          allMoves.push({fr:r,fc:c,tr:m.r,tc:m.c,score});
        }
      }
      if(allMoves.length===0){endLevel('ENEMY STUCK — YOU WIN',true);return;}
      allMoves.sort((a,b)=>b.score-a.score);
      const top=allMoves.filter(m=>m.score===allMoves[0].score);
      const best=top[Math.floor(Math.random()*Math.min(top.length,3))];
      const captured=chessBoard[best.tr][best.tc];
      chessBoard[best.tr][best.tc]=chessBoard[best.fr][best.fc]; chessBoard[best.fr][best.fc]=null;
      if(captured?.type==='core'){
        shake=40; glitchFrames=20; chessMsg='CORE BREACHED!';
        setTimeout(()=>endLevel('NEURAL CHESS: DEFEATED',false),600);
      } else {
        chessTurn='player'; chessMsg='YOUR MOVE — click a piece';
      }
    };

    // Entities
    let cubes: any[] = [];
    let powerUps: any[] = [];
    const particles: any[] = [];
    let rockets: any[] = [];
    let bossRockets: any[] = [];  // boss shoots at player
    let hazardBeams: any[] = []; // GD-style horizontal lasers
    const pixelSparks: any[] = []; // ambient pixel rain
    const floatingTexts: any[] = [];
    const flashes: any[] = [];
    let glitchFrames = 0;
    let randomShakeTimer = 0;
    
    const mouse = { x: -9999, y: -9999, px: 0, py: 0 };
    
    // Hitman Palette & Planet Color
    const COLOR_MINE = '#ff003c';
    const COLOR_GOLD = '#ffffff';
    const BG_COLOR = '#050505';
    
    let bossX = 0;
    let bossY = -200;
    let bossHealth = 100;
    let bossMaxHealth = 100;
    const eyeCore = {
      x: W * 0.5,
      y: H * 0.24,
      tx: W * 0.5,
      ty: H * 0.24,
      radius: 86,
      active: false,
      pulse: 0,
      burst: 0,
      reveal: 0,
    };
    let lightningTimer = 0;
    let lightningHue = 230;
    let lightningXOffset = 0;
    let lightningSpeed = 1.2;
    let lightningIntensity = 1.1;
    let lightningSize = 1;
    let atomicSequenceTimer = 0;
    const spriteSources = {
      dataCore: "/images/game/data-core.webp",
      hazardMine: "/images/game/hazard-mine.webp",
      energyReactor: "/images/game/energy-reactor.webp",
      shieldModule: "/images/game/shield-module.webp",
      timeCrystal: "/images/game/time-crystal.webp",
      enemyDrone: "/images/game/enemy-drone.webp",
      interceptorMissile: "/images/game/interceptor-missile.webp",
      playerCube: "/images/game/player-cube.webp",
      operatorVanguard: "/images/game/operators/vanguard.webp",
      operatorSpectre: "/images/game/operators/spectre.webp",
      operatorVector: "/images/game/operators/vector.webp",
      cyberiaBackdrop: "/images/maps/cyberia/city-run-bg.webp",
      cyberiaPlatform: "/images/maps/cyberia/platform.webp",
    } as const;
    type GameSpriteKey = keyof typeof spriteSources;
    const gameSprites = Object.fromEntries(
      Object.entries(spriteSources).map(([key, src]) => {
        const image = new window.Image();
        image.decoding = "async";
        image.src = src;
        return [key, image];
      })
    ) as Record<GameSpriteKey, HTMLImageElement>;
    const operatorSpriteKey: GameSpriteKey = hero.archetype === "spectre"
      ? "operatorSpectre"
      : hero.archetype === "vector"
        ? "operatorVector"
        : "operatorVanguard";
    let cyberiaBackdropCache: HTMLCanvasElement | null = null;
    let cyberiaBackdropWidth = 0;
    let cyberiaBackdropHeight = 0;
    // levelInSector accessible to all closures (startLevel, endLevel, draw)
    let levelInSector = ((currentLevel - 1) % LEVELS_PER_SECTOR) + 1;
    let isTestingBossLevel = isTestingBossSector;

    const hasSkill = (id: string) => stats.skills.includes(id);
    const skill = {
      precision: hasSkill("precision"),
      blast: hasSkill("blast"),
      auto: hasSkill("auto"),
      critical: hasSkill("critical"),
      ricochet: hasSkill("ricochet"),
      rapidfire: hasSkill("rapidfire"),
      vampire: hasSkill("vampire"),
      cluster: hasSkill("cluster"),
      phantom: hasSkill("phantom"),
      bloodlust: hasSkill("bloodlust"),
      executor: hasSkill("executor"),
      echo: hasSkill("echo"),
      shockwave: hasSkill("shockwave"),
      overdrive2: hasSkill("overdrive2"),
      reflexes: hasSkill("reflexes"),
      shield: hasSkill("shield"),
      timewarp: hasSkill("timewarp"),
      phase: hasSkill("phase"),
      pulsewave: hasSkill("pulsewave"),
      doubleTime: hasSkill("doubleTime"),
      overclock: hasSkill("overclock"),
      timesiphon: hasSkill("timesiphon"),
      timewarp2: hasSkill("timewarp2"),
      phaserush: hasSkill("phaserush"),
      siphon: hasSkill("siphon"),
      hp: hasSkill("hp"),
      magnet2: hasSkill("magnet2"),
      overdrive: hasSkill("overdrive"),
      resurrection: hasSkill("resurrection"),
      guardian: hasSkill("guardian"),
      secondwind: hasSkill("secondwind"),
      fortress: hasSkill("fortress"),
      ironskin: hasSkill("ironskin"),
      ironcurtain: hasSkill("ironcurtain"),
      chaos: hasSkill("chaos"),
      nuclear: hasSkill("nuclear"),
      berserk: hasSkill("berserk"),
      frenzy: hasSkill("frenzy"),
      glass: hasSkill("glass"),
      overload: hasSkill("overload"),
      entropy: hasSkill("entropy"),
      singularity: hasSkill("singularity"),
      quantum: hasSkill("quantum"),
    };
    const hasGear = (id: CraftingRecipeId) => (stats.craftedGear ?? []).includes(id);
    const gear = {
      runnerBoots: hasGear("runner_boots"),
      shadowGloves: hasGear("shadow_gloves"),
      plasmaBelt: hasGear("plasma_belt"),
      titaniumChestplate: hasGear("titanium_chestplate"),
      gravityBoots: hasGear("gravity_boots"),
      neonVisor: hasGear("neon_visor"),
      voidCloak: hasGear("void_cloak"),
      solarRing: hasGear("solar_ring"),
      ancientStabilizer: hasGear("ancient_stabilizer"),
      dragonEngine: hasGear("dragon_engine"),
    };
    const craftedGearSpeedMul = (gear.runnerBoots ? 1.08 : 1) * (gear.dragonEngine ? 1.06 : 1);
    const craftedAirControlMul = (gear.shadowGloves ? 1.06 : 1) * (gear.dragonEngine ? 1.06 : 1);
    const craftedFallMul = gear.gravityBoots ? 0.9 : 1;
    const craftedKnockbackMul = gear.ancientStabilizer ? 0.8 : 1;
    const neonWarningMul = gear.neonVisor ? 1.55 : 1;
    const gearMaterialLedger = createEmptyMaterialInventory();
    const baseHitbox = skill.precision ? 92 : 70;
    let hasShield = skill.shield;
    let dragonEmergencyShieldAvailable = gear.dragonEngine;
    let titaniumGuardCooldown = 0;
    let plasmaImpulseTimer = 0;
    let plasmaImpulseCooldown = 0;
    let voidCloakCooldown = 0;
    let voidCloakTimer = 0;
    let solarRingStacks = 0;
    let solarRingBoostTimer = 0;
    let levelLives = skill.hp ? 3 : 1;
    let mineArmor = skill.ironskin ? 3 : 0;
    let fortressDamage = 0;
    let phaseShiftAvailable = skill.phase;
    let timewarpAvailable = skill.timewarp;
    let resurrectionAvailable = skill.resurrection;
    let secondWindAvailable = skill.secondwind;
    let pulsewaveTimer = 15 * 60;
    let doubleTimeTimer = 30 * 60;
    let guardianTimer = 30 * 60;
    let entropyTimer = 5 * 60;
    let feverCharge = 0;
    let feverTimer = 0;
    let berserkTimer = 0;
    let berserkCrashTimer = 0;
    let frenzyTimer = 0;
    let phaseRushTimer = 0;
    let phaseRushStacks = 0;
    let powerCooldowns: Record<string, number> = {};

    const capArray = (arr: any[], max: number) => {
      if (arr.length > max) arr.splice(0, arr.length - max);
    };

    const drawGameSprite = (
      key: GameSpriteKey,
      x: number,
      y: number,
      size: number,
      rotation = 0,
      glow = "rgba(103, 232, 249, 0.42)",
      alpha = 1,
    ) => {
      const image = gameSprites[key];
      if (!image.complete || image.naturalWidth === 0) return false;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 12;
      ctx.drawImage(image, -size / 2, -size / 2, size, size);
      ctx.restore();
      return true;
    };

    const drawGameSpriteRect = (
      key: GameSpriteKey,
      x: number,
      y: number,
      width: number,
      height: number,
      rotation = 0,
      glow = "rgba(103, 232, 249, 0.42)",
      alpha = 1,
    ) => {
      const image = gameSprites[key];
      if (!image.complete || image.naturalWidth === 0) return false;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 12;
      ctx.drawImage(image, -width / 2, -height / 2, width, height);
      ctx.restore();
      return true;
    };

    const drawOperatorSprite = (
      x: number,
      y: number,
      width: number,
      height: number,
      rotation = 0,
      flipVertical = false,
      glow = hero.accent,
      alpha = 1,
    ) => {
      const image = gameSprites[operatorSpriteKey];
      if (!image.complete || image.naturalWidth === 0) return false;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      if (flipVertical) ctx.scale(1, -1);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 16;
      ctx.drawImage(image, -width / 2, -height / 2, width, height);
      ctx.restore();
      return true;
    };

    const getCyberiaBackdrop = () => {
      const image = gameSprites.cyberiaBackdrop;
      if (!image.complete || image.naturalWidth === 0) return null;
      if (
        cyberiaBackdropCache &&
        cyberiaBackdropWidth === W &&
        cyberiaBackdropHeight === H
      ) {
        return cyberiaBackdropCache;
      }

      const buffer = document.createElement("canvas");
      buffer.width = Math.ceil(W * 1.14);
      buffer.height = H;
      const bufferCtx = buffer.getContext("2d");
      if (!bufferCtx) return null;

      const imageRatio = image.naturalWidth / image.naturalHeight;
      const viewportRatio = buffer.width / H;
      const drawHeight = viewportRatio > imageRatio ? buffer.width / imageRatio : H;
      const drawWidth = viewportRatio > imageRatio ? buffer.width : H * imageRatio;
      bufferCtx.drawImage(image, (buffer.width - drawWidth) / 2, (H - drawHeight) / 2, drawWidth, drawHeight);
      bufferCtx.fillStyle = "rgba(0, 0, 0, 0.2)";
      bufferCtx.fillRect(0, 0, buffer.width, H);

      cyberiaBackdropCache = buffer;
      cyberiaBackdropWidth = W;
      cyberiaBackdropHeight = H;
      return buffer;
    };

    const getSnailBounds = () => ({
      left: 24,
      right: W - 24,
      top: 92,
      bottom: H - 98,
    });

    const awardAchievement = (id: string) => {
      const unlockedNow = unlockAchievement(id);
      if (!unlockedNow) return;
      const meta = ACHIEVEMENT_BY_ID[id];
      if (!meta) return;
      setAchievementToast({ name: meta.name, description: meta.description });
      setTimeout(() => {
        setAchievementToast((prev) => (prev?.name === meta.name ? null : prev));
      }, 2800);
    };

    const getStoredRank = (level: number): RankTier | null => {
      try {
        const raw = window.localStorage.getItem(RANK_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Record<string, RankTier>;
        const rank = parsed[String(level)];
        if (rank === "S" || rank === "A" || rank === "B" || rank === "C") return rank;
      } catch {}
      return null;
    };

    const saveStoredRank = (level: number, rank: RankTier): RankTier => {
      const key = String(level);
      const existing = getStoredRank(level);
      if (existing && RANK_SCORE[existing] >= RANK_SCORE[rank]) return existing;
      try {
        const raw = window.localStorage.getItem(RANK_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Record<string, RankTier>) : {};
        parsed[key] = rank;
        window.localStorage.setItem(RANK_STORAGE_KEY, JSON.stringify(parsed));
      } catch {}
      return rank;
    };

    const initAudio = () => {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    };

    const sfx = {
      hit: () => playSound(800, 'sine', 0.1, 0.1),
      mine: () => playSound(100, 'sawtooth', 0.5, 0.4),
      shield: () => playSound(600, 'square', 0.3, 0.3),
      powerup: () => { playSound(600, 'square', 0.1, 0.2); setTimeout(()=>playSound(800,'square',0.2,0.2), 100); },
      rocket: () => playSound(150, 'square', 0.4, 0.1),
      explosion: () => playSound(50, 'sawtooth', 0.8, 0.3),
      bossHit: () => playSound(200, 'square', 0.2, 0.3),
      levelClear: () => { playSound(400, 'sawtooth', 0.3, 0.15); setTimeout(()=>playSound(600,'sawtooth',0.3,0.15), 100); }
    };

    const playSound = (freq: number, type: OscillatorType, duration: number, vol = 0.1) => {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'suspended') return;
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq / 2, audioCtxRef.current.currentTime + duration);
      gain.gain.setValueAtTime(vol, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + duration);
    };

    const spawnText = (text: string, x: number, y: number, color: string, size = 20) => {
      floatingTexts.push({ text, x, y, life: 1, color, size, vy: -2 });
    };

    const grantMaterial = (materialId: MaterialId, amount = 1, source = "MATERIAL") => {
      const gain = Math.max(1, Math.floor(amount));
      addMaterials({ [materialId]: gain } as Partial<Record<MaterialId, number>>);
      gearMaterialLedger[materialId] = (gearMaterialLedger[materialId] ?? 0) + gain;
      const meta = MATERIALS_BY_ID[materialId];
      spawnText(`${source}: ${meta.name.toUpperCase()} +${gain}`, W / 2, H / 2 - 24, meta.color, 18);
      registerSolarPickup(W / 2, H / 2 - 24);
    };

    const grantRandomMaterial = (source: string, amount = 1) => {
      const picked = rollMaterialForLevel(Math.max(1, currentLevel));
      grantMaterial(picked, amount, source);
    };

    const triggerLightning = (opts: { duration?: number; hue?: number; speed?: number; intensity?: number; size?: number } = {}) => {
      lightningTimer = Math.max(lightningTimer, opts.duration ?? 72);
      lightningHue = opts.hue ?? lightningHue;
      lightningSpeed = opts.speed ?? lightningSpeed;
      lightningIntensity = opts.intensity ?? lightningIntensity;
      lightningSize = opts.size ?? lightningSize;
      awardAchievement("storm_rider");
    };

    const triggerEyeBurst = (amount = 1.2, withLightning = true) => {
      eyeCore.active = true;
      eyeCore.burst = Math.max(eyeCore.burst, amount);
      eyeCore.pulse = Math.max(eyeCore.pulse, amount * 0.6);
      shake = Math.max(shake, 26);
      glitchFrames = Math.max(glitchFrames, 10);
      createParticles(eyeCore.x, eyeCore.y, "#ff4d4d", 54);
      if (withLightning) triggerLightning({ duration: 94, hue: 350, speed: 1.45, intensity: 1.2, size: 0.95 });
      awardAchievement("eye_breaker");
    };

    const getTrackProgress = () => Math.min(1, gdDistanceTravelled / Math.max(1, operativeTrackGoal));
    const getGdSection = () => Math.max(0, Math.min(3, Math.floor(getTrackProgress() * 4)));

    const clearGdModifier = () => {
      gdModifierType = "none";
      gdModifierTimer = 0;
      gdModifierCooldown = 220;
    };

    const triggerGdModifier = (forced?: GdModifierType) => {
      const options: GdModifierType[] = ["laserstorm"];
      const picked = forced ?? options[Math.floor(Math.random() * options.length)];
      gdModifierType = picked;
      gdModifierTimer = picked === "laserstorm" ? 200 : 230;
      gdModifierCooldown = 360;
      const label =
        "MOD: LASER STORM";
      spawnText(label, W / 2, 146, "#ffcc66", 20);
      flashes.push({ life: 0.45, color: "#223a66", intensity: 0.35 });
    };

    const updateGdSectionState = () => {
      const section = getGdSection();
      if (section === gdSectionIndex && gdSectionBanner) return;
      if (section !== gdSectionIndex || !gdSectionBanner) {
        gdSectionIndex = section;
        gdSectionBanner = GD_SECTION_LABELS[section];
        gdCheckpointReady = true;
        gdInvulnTimer = Math.max(gdInvulnTimer, 18);
        spawnText(`SECTION ${section + 1}: ${gdSectionBanner}`, W / 2, 112, "#9ed3ff", 24);
        if (section > 0 && Math.random() < 0.72) triggerGdModifier();
      }
    };

    const tryGdPracticeRespawn = (reason: string, x: number, y: number, color: string) => {
      if (!(levelType === "gd" || levelType === "operative")) return false;
      if (!gdPracticeMode || !gdCheckpointReady) return false;
      gdCheckpointReady = false;
      levelTookDamage = true;
      combo = 0;
      gdPlayer.dead = false;
      gdPlayer.vy = 0;
      gdPlayer.y = Math.max(H * 0.2, Math.min(H * 0.7, y));
      gdPlayer.gravFlipped = false;
      gdInvulnTimer = 90;
      gdJumpQueued = false;
      if (levelType === "operative") timeRemaining = Math.max(0, timeRemaining - 4);
      gdObstacles = gdObstacles.filter(ob => ob.type === "finish" || ob.type === "platform" || ob.x > gdPlayer.x - 80);
      createParticles(x, y, color, 38);
      shake = Math.max(shake, 25);
      glitchFrames = Math.max(glitchFrames, 14);
      spawnText(`PRACTICE RETRY · ${reason}`, W / 2, H / 2 - 18, "#ffcc66", 24);
      return true;
    };

    const computeLevelRank = (): RankTier => {
      const completion = Math.min(1, targetsDestroyed / Math.max(1, targetsNeeded));
      const expectedTime =
        levelType === "operative" ? 60 :
        levelType === "gd" ? 52 :
        levelType === "snail" ? 58 :
        levelType === "boss" ? 75 :
        42;
      const elapsedScore = Math.max(0, 1 - Math.max(0, levelElapsed - expectedTime) / Math.max(10, expectedTime));
      let points = completion * 58 + elapsedScore * 24;
      if (!levelTookDamage) points += 14;
      if (combo >= 20) points += 4;
      if (laserContactCount === 0 && (levelType === "gd" || levelType === "operative")) points += 5;

      if (points >= 90) return "S";
      if (points >= 74) return "A";
      if (points >= 58) return "B";
      return "C";
    };

    // Spawn pattern — rotates every few seconds within a level for variety
    let currentPattern = (() => {
      const patterns = ['bottom','left','right','diagonal_left','diagonal_right','zigzag','rain','bottom'];
      return patterns[currentLevel % patterns.length];
    })();
    let patternTimer = 0; // ticks until pattern change
    let bossPhase = 1;
    let bossVx = 0;
    let bossLaserTimer = 0;
    let bossLaserActive = false;
    let bossLaserAngle = 0;

    const createCube = (isMine = false, type = 'ninja', gridX = 0, gridY = 0, isGold = false, fromSide = '') => {
      let sx = Math.random() * (W - 200) + 100;
      let sy = H + 100;
      let svx = (Math.random() - 0.5) * 6;
      let svy = -Math.random() * 8 - 14;
      let sgrav = 0.25;

      if (type === 'ninja') {
        const side = fromSide || currentPattern;
        // Always mix: 50% chance to override with bottom spawn for variety
        const effectiveSide = (fromSide === '' && Math.random() < 0.45) ? 'bottom' : side;
        if (effectiveSide === 'left' || effectiveSide === 'diagonal_left') {
          sx = -120; sy = H * 0.15 + Math.random() * H * 0.7;
          svx = 9 + Math.random() * 7;
          svy = effectiveSide === 'diagonal_left' ? -2 - Math.random() * 3 : (Math.random()-0.5)*4;
          sgrav = effectiveSide === 'diagonal_left' ? 0.08 : 0;
        } else if (effectiveSide === 'right' || effectiveSide === 'diagonal_right') {
          sx = W + 120; sy = H * 0.15 + Math.random() * H * 0.7;
          svx = -9 - Math.random() * 7;
          svy = effectiveSide === 'diagonal_right' ? -2 - Math.random() * 3 : (Math.random()-0.5)*4;
          sgrav = effectiveSide === 'diagonal_right' ? 0.08 : 0;
        } else if (effectiveSide === 'zigzag') {
          sx = Math.random() < 0.5 ? -100 : W + 100;
          sy = Math.random() * H * 0.8;
          svx = sx < 0 ? 7 + Math.random()*5 : -7 - Math.random()*5;
          svy = Math.sin(tick * 3) * 6;
          sgrav = 0;
        } else if (effectiveSide === 'rain') {
          sx = Math.random() * W;
          sy = -120;
          svx = (Math.random()-0.5) * 5;
          svy = 8 + Math.random() * 6;
          sgrav = 0.04;
        } else {
          // bottom (default) — classic from below
          sx = Math.random() * (W - 200) + 100;
          sy = H + 120;
          svx = (Math.random()-0.5)*7;
          svy = -Math.random()*10 - 14;
          sgrav = 0.25;
        }
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        x: type === 'ninja' ? sx : gridX,
        y: type === 'ninja' ? sy : gridY,
        vx: type === 'ninja' ? svx : 0,
        vy: type === 'ninja' ? svy : 0,
        gravity: type === 'ninja' ? sgrav : 0,
        isMine, isGold, destroyed: false, explodeT: 0,
        color: isMine ? COLOR_MINE : (isGold ? COLOR_GOLD : planet.color),
        type
      };
    };

    const buildStaticGrid = () => {
      cubes = [];
      const cols = 6; const rows = 4;
      const spacingX = W / (cols + 1); const spacingY = H / (rows + 1);
      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          const isMine = Math.random() < 0.15;
          cubes.push(createCube(isMine, 'static', c * spacingX, r * spacingY, false));
        }
      }
    };

    const startLevel = () => {
      active = true;
      paused = false;
      setIsPaused(false);
      setIsGameOver(false);
      setBossIntro(null);
      targetsDestroyed = 0;
      combo = 0;
      levelElapsed = 0;
      levelTookDamage = false;
      usedTimeMechanic = false;
      laserContactCount = 0;
      operativeCheckpoint = 0;
      cubes = [];
      powerUps = [];
      rockets = [];
      bossRockets = [];
      hazardBeams = [];
      snailShots = [];
      feverCharge = 0;
      feverTimer = 0;
      berserkTimer = 0;
      berserkCrashTimer = 0;
      frenzyTimer = 0;
      phaseRushTimer = 0;
      phaseRushStacks = 0;
      slowMo = 0;
      autoSlicer = 0;
      multiScore = 0;
      rocketRain = 0;
      magnetActive = 0;
      shieldActive = false;
      chaosFrenzyTimer = 0;
      giantModeTimer = 0;
      gdSectionIndex = 0;
      gdSectionBanner = "";
      gdPracticeMode = true;
      gdCheckpointReady = true;
      gdInvulnTimer = 0;
      clearGdModifier();
      gdMiniBossTriggered = false;
      gdMiniBossActive = false;
      gdMiniBossTimer = 0;
      gdMiniBossFireTimer = 0;
      gdMiniBossDroneY = H * 0.45;
      gdBestRank = getStoredRank(currentLevel);
      gdCoreGoalReached = false;
      powerCooldowns = {};
      (Object.keys(gearMaterialLedger) as MaterialId[]).forEach((id) => {
        gearMaterialLedger[id] = 0;
      });
      levelLives = skill.hp ? 3 : 1;
      dragonEmergencyShieldAvailable = gear.dragonEngine;
      titaniumGuardCooldown = 0;
      plasmaImpulseTimer = 0;
      plasmaImpulseCooldown = 0;
      voidCloakCooldown = 0;
      voidCloakTimer = 0;
      solarRingStacks = 0;
      solarRingBoostTimer = 0;
      mineArmor = skill.ironskin ? 3 : 0;
      fortressDamage = 0;
      phaseShiftAvailable = skill.phase;
      timewarpAvailable = skill.timewarp;
      resurrectionAvailable = skill.resurrection;
      secondWindAvailable = skill.secondwind;
      pulsewaveTimer = 15 * 60;
      doubleTimeTimer = 30 * 60;
      guardianTimer = 30 * 60;
      entropyTimer = 5 * 60;
      bossMaxHealth = 100;
      eyeCore.x = W * 0.5;
      eyeCore.y = H * 0.24;
      eyeCore.tx = eyeCore.x;
      eyeCore.ty = eyeCore.y;
      eyeCore.active = false;
      eyeCore.pulse = 0;
      eyeCore.burst = 0;
      eyeCore.reveal = 0;
      lightningTimer = 0;
      lightningHue = 230;
      lightningXOffset = 0;
      lightningSpeed = 1.2;
      lightningIntensity = 1.1;
      lightningSize = 1;
      atomicSequenceTimer = 0;
      
    levelInSector = ((currentLevel - 1) % LEVELS_PER_SECTOR) + 1;
    const sectorNum = Math.ceil(currentLevel / LEVELS_PER_SECTOR);
    isTestingBossLevel = sectorNum === TESTING_BOSS_SECTOR_ID || currentLevel === TESTING_BOSS_LEVEL;

    if (isTestingBossLevel) {
        levelType = 'boss';
        targetsNeeded = 75;
        bossX = W / 2;
        bossY = -260;
        bossMaxHealth = 150;
        bossHealth = bossMaxHealth;
        bossPhase = 1;
        bossVx = 0;
        bossLaserTimer = 900;
        bossLaserActive = false;
        bossLaserAngle = 0;
        eyeCore.x = W * 0.5;
        eyeCore.y = H * 0.24;
        eyeCore.tx = eyeCore.x;
        eyeCore.ty = eyeCore.y;
        eyeCore.active = true;
        eyeCore.reveal = 0;
        awardAchievement("boss_tester");
        setBossIntro("BOSS TEST LEVEL");
        setTimeout(() => {
          setBossIntro((prev) => (prev === "BOSS TEST LEVEL" ? null : prev));
        }, 1400);
    } else if (currentLevel === 1) {
        levelType = 'chaos_intro';
        targetsNeeded = 18;
        timeRemaining = 38;
      } else if (sectorNum === 99) {
        levelType = levelInSector % 2 === 0 ? 'snail' : 'gd';
        targetsNeeded = 10 + levelInSector * 2;
        if (levelType === 'snail') initSnailRace();
        else {
          gdPlayer = { x: W * 0.18, y: H * 0.65, vy: 0, size: 36, grounded: true, gravFlipped: false, dead: false, jumpsUsed: 0 };
          gdObstacles = []; gdDistanceTravelled = 0; gdJumpQueued = false; gdRocketTimer = 1400;
          spawnGDObstacles();
        }
      } else if (levelInSector === 11) {
        levelType = 'boss'; targetsNeeded = 50;
        bossX = W/2; bossY = -200; bossMaxHealth = 100; bossHealth = 100; bossPhase = 1; bossVx = 0;
      } else if (levelInSector === 1 && sectorNum > 1) {
        // CHAOS BONUS — the first level of every new sector (i.e. right after clearing a boss)
        levelType = 'chaos_bonus';
        targetsNeeded = 30 + currentLevel * 2;
        timeRemaining = skill.singularity ? 40 : 60; // singularity: shorter, denser chaos run
      } else if (levelInSector % 3 === 0) {
        levelType = 'gd';
        targetsNeeded = Math.max(8, 6 + levelInSector);
        gdPlayer = { x: W * 0.18, y: H * 0.65, vy: 0, size: 36, grounded: true, gravFlipped: false, dead: false, jumpsUsed: 0 };
        gdObstacles = []; gdDistanceTravelled = 0; gdJumpQueued = false; gdRocketTimer = 1500;
        spawnGDObstacles();
      } else if (levelInSector === 5) {
        if (currentLevel === 5) {
          levelType = 'operative';
          targetsNeeded = 5;
          timeRemaining = 60;
          gdPlayer = { x: W * 0.18, y: H * 0.65, vy: 0, size: 36, grounded: true, gravFlipped: false, dead: false, jumpsUsed: 0 };
          gdObstacles = []; gdDistanceTravelled = 0; gdJumpQueued = false; gdRocketTimer = 1200;
          spawnGDObstacles();
        } else {
          // Keep classic mode for later sectors, while Level 5 stays the special operative mission.
          levelType = 'chess';
          targetsNeeded = 1;
          initChess();
        }
      } else if (levelInSector === 7 || levelInSector === 10) {
        // Cube shooter levels
        levelType = 'snail';
        targetsNeeded = 6 + sectorNum + Math.floor(levelInSector / 2);
        initSnailRace();
      } else if (currentLevel % 2 === 0) {
        levelType = 'static'; buildStaticGrid(); timeRemaining = 20;
      } else {
        levelType = 'ninja'; targetsNeeded = 10 + currentLevel * 2;
      }
      
      spawnText(`PHASE ${currentLevel} INIT`, W/2, H/2, planet.color, 40);
      spawnLogic();
    };

    const spawnGDObstacles = () => {
      gdObstacles = [];
      const floorY = H * 0.75;
      const ceilY = H * 0.1;
      let ox = W + 200;
      let cubesPlaced = 0;
      let giantOrbsPlaced = 0;
      let bonusRoutePlaced = 0;
      const totalCubesNeeded = targetsNeeded;
      
      const sector = Math.ceil(currentLevel / LEVELS_PER_SECTOR);
      if (sector === 99) {
        // --- CUSTOM LUDILO LEVEL GENERATOR ---
        // 1. Intro: Simple jumps, wide platforms
        ox += 300;
        gdObstacles.push({x:ox, y:floorY-120, w:300, h:14, type:'platform', isMine:false});
        gdObstacles.push({x:ox+150, y:floorY-170, w:40, h:40, type:'cube', isMine:false, collected:false}); cubesPlaced++;
        ox += 500;
        gdObstacles.push({x:ox, y:floorY-80, w:200, h:14, type:'platform', isMine:false});
        gdObstacles.push({x:ox+100, y:floorY-130, w:40, h:40, type:'cube', isMine:false, collected:false}); cubesPlaced++;
        gdObstacles.push({x:ox+250, y:floorY-210, w:36, h:36, type:'giant_orb', collected:false}); giantOrbsPlaced++;
        ox += 600;
        
        // 2. Build-up: Spikes and gaps
        gdObstacles.push({x:ox, y:floorY, w:30, h:50, type:'spike', isMine:true});
        gdObstacles.push({x:ox+200, y:floorY-90, w:40, h:40, type:'cube', isMine:false, collected:false}); cubesPlaced++;
        gdObstacles.push({x:ox+400, y:floorY, w:30, h:50, type:'spike', isMine:true});
        gdObstacles.push({x:ox+430, y:floorY, w:30, h:50, type:'spike', isMine:true});
        gdObstacles.push({x:ox+600, y:floorY-130, w:150, h:14, type:'platform', isMine:false});
        gdObstacles.push({x:ox+650, y:floorY-180, w:40, h:40, type:'cube', isMine:false, collected:false}); cubesPlaced++;
        ox += 1100;

        // 3. Challenge: Spikes + Moving platforms
        gdObstacles.push({x:ox, y:floorY, w:30, h:50, type:'spike', isMine:true});
        gdObstacles.push({x:ox+250, y:floorY-100, w:100, h:14, type:'platform', isMine:false, vx:-2});
        gdObstacles.push({x:ox+280, y:floorY-150, w:40, h:40, type:'cube', isMine:false, collected:false}); cubesPlaced++;
        gdObstacles.push({x:ox+500, y:floorY, w:30, h:50, type:'spike', isMine:true});
        gdObstacles.push({x:ox+530, y:floorY, w:30, h:50, type:'spike', isMine:true});
        gdObstacles.push({x:ox+560, y:floorY, w:30, h:50, type:'spike', isMine:true});
        gdObstacles.push({x:ox+750, y:floorY-150, w:80, h:14, type:'platform', isMine:false, vy:2, startY:floorY-250, endY:floorY-50});
        gdObstacles.push({x:ox+770, y:floorY-200, w:40, h:40, type:'cube', isMine:false, collected:false}); cubesPlaced++;
        gdObstacles.push({x:ox+920, y:floorY-245, w:36, h:36, type:'giant_orb', collected:false}); giantOrbsPlaced++;
        ox += 1200;

        // 4. Release: Short easier section
        gdObstacles.push({x:ox, y:floorY-90, w:40, h:40, type:'cube', isMine:false, collected:false}); cubesPlaced++;
        gdObstacles.push({x:ox+300, y:floorY-110, w:40, h:40, type:'cube', isMine:false, collected:false}); cubesPlaced++;
        gdObstacles.push({x:ox+600, y:floorY-90, w:40, h:40, type:'cube', isMine:false, collected:false}); cubesPlaced++;
        ox += 1000;

        // 5. Final: Fast-paced precise sequence
        gdObstacles.push({x:ox, y:floorY, w:30, h:50, type:'spike', isMine:true});
        gdObstacles.push({x:ox+300, y:floorY, w:30, h:50, type:'spike', isMine:true});
        gdObstacles.push({x:ox+450, y:floorY-120, w:80, h:14, type:'platform', isMine:false});
        gdObstacles.push({x:ox+600, y:floorY, w:30, h:50, type:'spike', isMine:true});
        gdObstacles.push({x:ox+630, y:floorY, w:30, h:50, type:'spike', isMine:true});
        gdObstacles.push({x:ox+750, y:floorY-150, w:80, h:14, type:'platform', isMine:false});
        gdObstacles.push({x:ox+770, y:floorY-200, w:40, h:40, type:'cube', isMine:false, collected:false}); cubesPlaced++;
        gdObstacles.push({x:ox+860, y:floorY-250, w:36, h:36, type:'giant_orb', collected:false}); giantOrbsPlaced++;
        gdObstacles.push({x:ox+950, y:floorY, w:30, h:50, type:'spike', isMine:true});
        gdObstacles.push({x:ox+980, y:floorY, w:30, h:50, type:'spike', isMine:true});
        gdObstacles.push({x:ox+1010, y:floorY, w:30, h:50, type:'spike', isMine:true});
        
        // Ensure we meet target
        while(cubesPlaced < totalCubesNeeded) {
          ox += 300;
          gdObstacles.push({x:ox, y:floorY-90, w:40, h:40, type:'cube', isMine:false, collected:false});
          cubesPlaced++;
        }
        
        operativeTrackGoal = Math.max(1800, ox + 600);
        gdObstacles.push({ x: ox + 600, y: 0, w: 12, h: H, type:'finish', isMine:false });
        return;
      }
      
      // Build a fixed-length track with exactly targetsNeeded score cubes
      for (let i = 0; i < 70 + currentLevel && cubesPlaced < totalCubesNeeded + 15; i++) {
        const type = Math.random();
        const cubesLeft = totalCubesNeeded - cubesPlaced;
        const shouldForceCube = cubesLeft > 0 && i > (70 + currentLevel - cubesLeft * 2);

        // Insert floating platform every 4-6 objects
        if (i % 5 === 2 && !shouldForceCube) {
          const platY = floorY - 130 - Math.random() * (H * 0.35);
          const platW = 100 + Math.random() * 120;
          gdObstacles.push({ x: ox, y: platY, w: platW, h: 14, type:'platform', isMine:false });
          // Optionally put a cube on the platform
          if (Math.random() < 0.6) {
            gdObstacles.push({ x: ox + platW/2, y: platY - 50, w: 40, h: 40, type:'cube', isMine:false, collected:false });
            cubesPlaced++;
          }
          ox += platW + 80 + Math.random() * 120;
          continue;
        }

        if (type < 0.22 && !shouldForceCube) {
          gdObstacles.push({ x: ox, y: floorY, w: 30, h: 50, type:'spike', isMine:true });
          ox += 130 + Math.random()*180;
        } else if (type < 0.38 && !shouldForceCube) {
          gdObstacles.push({ x: ox, y: floorY - 110 - Math.random()*140, w: 40, h: 40, type:'mine', isMine:true });
          ox += 200 + Math.random()*140;
        } else if (type < 0.50 && !shouldForceCube) {
          // Moving laser — vertical beam that sweeps up and down
          const laserH = 100 + Math.random() * 150;
          const laserMinY = ceilY + 20;
          const laserMaxY = floorY - laserH - 20;
          const startY = laserMinY + Math.random() * (laserMaxY - laserMinY);
          gdObstacles.push({
            x: ox, y: startY, w: 8, h: laserH,
            type: 'laser', isMine: true,
            laserMinY, laserMaxY,
            laserVy: (Math.random() < 0.5 ? 1 : -1) * (1.5 + Math.random() * 2),
          });
          ox += 180 + Math.random()*160;
        } else if (type < 0.58 && !shouldForceCube && currentLevel >= 3 && giantOrbsPlaced < 3) {
          gdObstacles.push({ x: ox, y: floorY - 120 - Math.random() * 120, w: 36, h: 36, type: 'giant_orb', collected: false });
          giantOrbsPlaced++;
          ox += 170 + Math.random() * 140;
        } else if (type < 0.76 || shouldForceCube) {
          gdObstacles.push({ x: ox, y: floorY - 90 - Math.random()*130, w: 40, h: 40, type:'cube', isMine:false, collected:false });
          cubesPlaced++;
          ox += 110 + Math.random()*110;
        } else {
          gdObstacles.push({ x: ox, y: floorY, w: 25, h: 45, type:'spike', isMine:true });
          gdObstacles.push({ x: ox+45, y: floorY, w: 25, h: 45, type:'spike', isMine:true });
          ox += 220 + Math.random()*180;
        }

        if (i > 6 && Math.random() < 0.2 && bonusRoutePlaced < 18) {
          const riskX = ox + 30 + Math.random() * 120;
          const riskY = ceilY + 48 + Math.random() * 88;
          gdObstacles.push({ x: riskX, y: riskY, w: 42, h: 42, type: 'reward_cube', collected: false });
          gdObstacles.push({ x: riskX + 46, y: Math.min(floorY - 12, riskY + 34), w: 30, h: 50, type: 'spike', isMine: true });
          bonusRoutePlaced++;
        } else if (i > 6 && Math.random() < 0.15) {
          const safeX = ox + 20 + Math.random() * 90;
          const safeY = floorY - 64 - Math.random() * 48;
          gdObstacles.push({ x: safeX, y: safeY, w: 34, h: 34, type: 'safe_cube', collected: false });
        }

      }
      // FINISH LINE at end of track
      operativeTrackGoal = Math.max(2200, ox + 200);
      gdObstacles.push({ x: ox + 200, y: 0, w: 12, h: H, type:'finish', isMine:false });
    };

    const initSnailRace = () => {
      snailLaneCount = 3;
      const { left: trackLeft, right: trackRight, bottom: trackBottom } = getSnailBounds();
      const startX = (trackLeft + trackRight) / 2;
      const startY = trackBottom - 58;
      snailPlayer = {
        x: startX,
        y: startY,
        targetX: startX,
        targetY: startY,
        lane: 1,
        targetLane: 1,
        speed: 4.8 + Math.min(3.5, levelInSector * 0.35),
        shield: skill.guardian ? 1 : 0,
        boost: 0,
        shootCooldown: 0,
        dead: false,
      };
      snailDistance = 0;
      snailTrackLength = W * (4.2 + currentLevel * 0.12);
      snailObstacles = [];
      snailShots = [];

      let oy = -500;
      let cubesPlaced = 0;
      const totalCubes = targetsNeeded + 5;
      const obstacleCount = 44 + levelInSector * 4;
      for (let i = 0; i < obstacleCount; i++) {
        const x = trackLeft + 46 + Math.random() * Math.max(1, trackRight - trackLeft - 92);
        const roll = Math.random();
        const forceCube = cubesPlaced < totalCubes && i > obstacleCount - cubesPlaced - 4;

        if (i < 5) {
          const introX = Math.max(trackLeft + 46, Math.min(trackRight - 46, startX + (i - 2) * 42));
          snailObstacles.push({ x: introX, y: oy, w: 36, h: 36, type: 'cube', collected: false });
          cubesPlaced++;
          oy -= 170;
          continue;
        }

        if (roll < 0.44 || forceCube) {
          snailObstacles.push({ x, y: oy, w: 36, h: 36, type: 'cube', collected: false });
          cubesPlaced++;
          oy -= 110 + Math.random() * 90;
        } else if (roll < 0.68) {
          snailObstacles.push({ x, y: oy, w: 46, h: 46, type: 'mine', isMine: true });
          oy -= 150 + Math.random() * 130;
        } else if (roll < 0.84) {
          snailObstacles.push({ x, y: oy, w: 108, h: 26, type: 'wall', isMine: true });
          oy -= 180 + Math.random() * 150;
        } else {
          snailObstacles.push({ x, y: oy, w: 42, h: 42, type: 'boost', collected: false });
          oy -= 160 + Math.random() * 140;
        }
      }

      snailTrackLength = Math.abs(oy) + H * 0.7;
      snailObstacles.push({ x: startX, y: oy - H * 0.8, w: trackRight - trackLeft, h: 18, type: 'finish' });
    };

    let ghostTrail: {x:number, y:number, life:number}[] = [];

    const spawnLogic = () => {
      if (!active) return;
      
      let spawnRate = 600 - (currentLevel * 10);
      
      if (levelType === 'boss') {
        const maxBossCubes = isTestingBossLevel ? 7 : ULTRA_SMOOTH_MODE ? 10 : 15;
        if (cubes.length < maxBossCubes) cubes.push(createCube(Math.random() < 0.28));
        spawnRate = ULTRA_SMOOTH_MODE ? 360 : 300;
      } else if (levelType === 'gd' || levelType === 'operative' || levelType === 'chess' || levelType === 'snail') {
        // GD, cube shooter, and Chess modes handled in draw loop
        spawnRate = 9999;
      } else if (levelType === 'chaos_intro') {
        if (cubes.length < 18) {
          const sides = ['bottom', 'left', 'right', 'rain', 'diagonal_left', 'diagonal_right', 'zigzag'];
          cubes.push(createCube(Math.random() < 0.16, 'ninja', 0, 0, Math.random() < 0.25, sides[Math.floor(Math.random() * sides.length)]));
        }
        spawnRate = 170;
      } else if (levelType === 'ninja') {
        if (cubes.length < 5 + currentLevel) {
          const rand = Math.random();
          if (rand < 0.2) cubes.push(createCube(true));
          else if (rand < 0.3) cubes.push(createCube(false, 'ninja', 0, 0, true));
          else cubes.push(createCube(false));
        }
      }
      
      // Regular power-ups (added chaos)
      if (Math.random() < 0.005 && levelType !== 'static' && levelType !== 'boss' && powerUps.length < 2) {
        const types = ['slow', 'freeze', 'multi', 'auto', 'rocket', 'magnet', 'shield', 'quake', 'whiteout', 'void'];
        if (levelType === 'gd' || levelType === 'operative') types.push('giant', 'giant');
        if (skill.chaos) types.push('chaos');
        powerUps.push({
          x: Math.random() * (W - 200) + 100,
          y: H + 100,
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 12 - 15,
          gravity: 0.2,
          type: types[Math.floor(Math.random() * types.length)],
          destroyed: false
        });
      }
      if (Math.random() < 0.0045 && levelType !== 'boss' && levelType !== 'static' && powerUps.length < 4) {
        powerUps.push({
          x: Math.random() * (W - 220) + 110,
          y: H + 90,
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 9 - 11,
          gravity: 0.16,
          type: 'material',
          materialId: rollMaterialForLevel(Math.max(1, currentLevel)),
          destroyed: false,
        });
      }
      // Atomic Bomb — 1% per spawn cycle (~5% chance over level)
      const bombChance = skill.nuclear ? 0.03 : 0.01;
      if (Math.random() < bombChance && levelType !== 'static' && levelType !== 'boss' && !powerUps.find((p: any) => p.type === 'bomb')) {
        powerUps.push({
          x: Math.random() * (W - 300) + 150,
          y: H + 100,
          vx: (Math.random() - 0.5) * 5,
          vy: -Math.random() * 10 - 12,
          gravity: 0.15,
          type: 'bomb',
          destroyed: false
        });
      }
      
      spawnTimeoutId = setTimeout(spawnLogic, Math.max(150, spawnRate));
    };

    // Pattern intro text
    const patternLabels: Record<string,string> = {
      left:'<<< LEFT ASSAULT',right:'RIGHT ASSAULT >>>',diagonal_left:'DIAGONAL STRIKE',
      diagonal_right:'DIAGONAL STRIKE',formation:'FORMATION WAVE',zigzag:'ZIG-ZAG BLITZ',
      rain:'RAIN MODE',top:'TOP DROP'
    };
    spawnText(patternLabels[currentPattern] || 'PHASE INIT', W/2, H/2 + 40, planet.color, 20);

    const createParticles = (x: number, y: number, color: string, count = 20) => {
      const fxScale = isTestingBossLevel ? 0.28 : ULTRA_SMOOTH_MODE ? 0.46 : 1;
      const particleCount = Math.max(4, Math.floor(count * fxScale));
      for (let i = 0; i < particleCount; i++) {
        particles.push({ x, y, vx: (Math.random()-0.5)*30, vy: (Math.random()-0.5)*30, life: 1, color, size: Math.random()*4+1 });
      }
      const sparkCount = Math.max(2, Math.floor(8 * fxScale));
      for (let i = 0; i < sparkCount; i++) {
        pixelSparks.push({ x, y, vx: (Math.random()-0.5)*80, vy: -Math.random()*60-20, life: 1, color, size: Math.random()*3+1 });
      }
    };

    const getSlowDuration = () => (skill.overclock ? 220 : skill.reflexes ? 180 : 140);
    const getAutoDuration = () => skill.auto ? 800 : 400;
    const getMagnetDuration = () => skill.magnet2 ? 900 : 300;
    const getGiantDuration = () => (skill.quantum ? 260 : 210);

    const isPowerOnCooldown = (type: string) => (powerCooldowns[type] ?? 0) > 0;
    const startPowerCooldown = (type: string) => {
      const duration = POWER_COOLDOWN_FRAMES[type];
      if (duration) powerCooldowns[type] = duration;
    };

    const getScoreMultiplier = () => {
      let multiplier = 1;
      if (multiScore > 0) multiplier *= 2;
      if (feverTimer > 0) multiplier *= 2;
      if (skill.overdrive && levelType === 'boss') multiplier *= 4;
      if (skill.bloodlust && combo >= 30) multiplier *= 5;
      if (skill.glass) multiplier *= 3;
      if (skill.berserk && berserkTimer > 0) multiplier *= 10;
      if (skill.overload) multiplier *= 5;
      if (slowMo > 0 && skill.timesiphon) multiplier *= 2;
      if (berserkCrashTimer > 0) multiplier = 0;
      return multiplier;
    };

    const awardPoints = (basePoints: number) => {
      const points = Math.floor(basePoints * getScoreMultiplier());
      sessionScore += points;
      return points;
    };

    const triggerPhaseRush = () => {
      if (!skill.phaserush) return;
      phaseRushTimer = 180;
      phaseRushStacks = Math.min(5, phaseRushStacks + 1);
    };

    const addFever = (amount: number) => {
      if (feverTimer > 0) return;
      feverCharge = Math.min(100, feverCharge + amount);
      if (feverCharge >= 100) {
        feverCharge = 0;
        feverTimer = 600;
        shake = Math.max(shake, 25);
        glitchFrames = Math.max(glitchFrames, 14);
        spawnText('NEURAL OVERLOAD!', W/2, H/2, '#ffd700', 68);
        flashes.push({ life: 0.8, color: '#ffd700' });
      }
    };

    const registerSolarPickup = (x: number, y: number) => {
      if (!gear.solarRing) return;
      solarRingStacks++;
      if (solarRingStacks >= 5) {
        solarRingStacks = 0;
        solarRingBoostTimer = Math.max(solarRingBoostTimer, 90);
        spawnText("SOLAR BOOST", x, y - 24, "#ffd36b", 20);
        flashes.push({ life: 0.35, color: "#ffd36b", intensity: 0.45 });
      }
    };

    const absorbHazard = (reason: string, x: number, y: number, options: { mine?: boolean; boss?: boolean; racing?: boolean } = {}) => {
      if (options.mine && skill.glass) return false;
      if (voidCloakTimer > 0) return true;
      if (reason.includes("LASER") || reason.includes("BEAM")) laserContactCount++;

      const block = (label: string, color: string) => {
        sfx.shield();
        shake = Math.max(shake, 18 * craftedKnockbackMul);
        glitchFrames = Math.max(glitchFrames, 8);
        createParticles(x, y, color, 35);
        spawnText(label, x, y - 30, color, 26);
      };

      if (shieldActive) {
        shieldActive = false;
        block('SHIELD BLOCKED!', '#00aaff');
        return true;
      }
      if (hasShield) {
        hasShield = false;
        block('BARRIER SAVED YOU!', '#88ccff');
        return true;
      }
      if (options.mine && phaseShiftAvailable) {
        phaseShiftAvailable = false;
        block('PHASE SHIFT!', '#bc13fe');
        return true;
      }
      if (options.mine && mineArmor > 0) {
        mineArmor--;
        block(`IRON SKIN ${mineArmor}/3`, '#cccccc');
        return true;
      }
      if (options.mine && timewarpAvailable) {
        timewarpAvailable = false;
        slowMo = Math.max(slowMo, getSlowDuration());
        usedTimeMechanic = true;
        startPowerCooldown("slow");
        block('TIME WARP!', '#00f2ff');
        return true;
      }
      if (options.mine && skill.fortress) {
        fortressDamage++;
        if (fortressDamage < 2) {
          block('FORTRESS ABSORBED HALF!', '#00ff88');
          return true;
        }
        fortressDamage = 0;
      }
      if (options.mine && skill.ironcurtain) {
        timeRemaining = Math.max(0, timeRemaining - 5);
        combo = 0;
        block('IRON CURTAIN: -5s', '#ff8800');
        return true;
      }
      if (gear.voidCloak && voidCloakCooldown <= 0) {
        voidCloakCooldown = 8 * 60;
        voidCloakTimer = 15;
        block("VOID CLOAK DODGE", "#b27cff");
        return true;
      }
      if (gear.titaniumChestplate && titaniumGuardCooldown <= 0) {
        titaniumGuardCooldown = 7 * 60;
        block("TITANIUM PLATE SAVE", "#d9dee6");
        return true;
      }
      if (dragonEmergencyShieldAvailable) {
        dragonEmergencyShieldAvailable = false;
        block("DRAGON EMERGENCY SHIELD", "#ffd36b");
        return true;
      }
      if (options.boss && resurrectionAvailable) {
        resurrectionAvailable = false;
        levelLives = Math.max(levelLives, 1);
        block('RESURRECTION!', '#ffd700');
        return true;
      }
      if (options.racing && secondWindAvailable) {
        secondWindAvailable = false;
        gdPlayer.dead = false;
        gdPlayer.vy = 0;
        gdPlayer.y = H * 0.55;
        snailPlayer.dead = false;
        snailPlayer.x = W * 0.5;
        snailPlayer.targetX = W * 0.5;
        snailPlayer.y = H * 0.78;
        snailPlayer.targetY = H * 0.78;
        snailPlayer.targetLane = 1;
        snailPlayer.lane = 1;
        snailPlayer.shootCooldown = 0;
        block('SECOND WIND!', '#00ff88');
        return true;
      }
      if (levelLives > 1) {
        levelLives--;
        levelTookDamage = true;
        block(`EXTRA HP: ${levelLives} LEFT`, '#ffffff');
        return true;
      }

      levelTookDamage = true;
      spawnText(reason, W/2, H/2, COLOR_MINE, 56);
      return false;
    };

    const fireShockwave = (x: number, y: number, radius = 260, label = 'SHOCKWAVE') => {
      shake = Math.max(shake, 18);
      glitchFrames = Math.max(glitchFrames, 6);
      createParticles(x, y, planet.color, 45);
      spawnText(label, x, y - 35, planet.color, 34);
      cubes.forEach(c => {
        if (!c.destroyed && !c.isMine && Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2) < radius) hitCube(c, 'shockwave');
      });
      if (levelType === 'boss' && Math.sqrt((x - bossX) ** 2 + (y - bossY) ** 2) < radius + 140) {
        bossHealth -= 4;
        if (bossHealth <= 0) endLevel("BOSS ELIMINATED", true);
      }
    };

    const endLevel = (reason: string, success = false) => {
      active = false;
      paused = false;
      setIsPaused(false);
      
      if (success) {
        sfx.levelClear();
        setBossIntro(null);
        const levelRank = computeLevelRank();
        gdBestRank = saveStoredRank(currentLevel, levelRank);
        const earnedXp = sessionScore / 10;
        const testingBossRun = isTestingBossLevel;
        let creditMultiplier = skill.siphon ? 1.2 : 1;
        if (skill.chaos && levelType === 'chaos_bonus') creditMultiplier += 0.25;
        if (feverTimer > 0) creditMultiplier += 0.25;
        const earnedCredits = Math.floor((sessionScore / 100) * creditMultiplier);
        addScore(sessionScore);
        addXp(earnedXp);
        addCredits(earnedCredits);

        const guaranteedDrops = testingBossRun ? 2 : 1;
        for (let i = 0; i < guaranteedDrops; i++) {
          grantRandomMaterial("MISSION REWARD");
        }
        if (!levelTookDamage) {
          grantRandomMaterial("PERFECT BONUS");
        }
        if ((levelType === "gd" || levelType === "operative") && laserContactCount === 0) {
          grantRandomMaterial("LASER BONUS");
        }

        if (!testingBossRun) {
          completeLevel(currentLevel);
        } else {
          setReplayLevel(TESTING_BOSS_LEVEL);
        }

        if (!testingBossRun) {
          if (!levelTookDamage) awardAchievement("no_hit_run");
          if (levelElapsed <= 35) awardAchievement("speed_demon");
          if ((levelType === "gd" || levelType === "operative") && laserContactCount === 0) {
            awardAchievement("laser_survivor");
          }
          if (usedTimeMechanic) awardAchievement("time_master");
          if (levelType === "chaos_intro") awardAchievement("chaos_survived");
          if (currentLevel >= 4) awardAchievement("operative_ready");
        } else {
          awardAchievement("boss_destroyed");
        }

        // Always auto-advance — no modal during play.
        // Level select is accessible via MAP [M] or in the Hub.
        const isBoss = levelInSector === 11 || testingBossRun;
        const title = testingBossRun ? 'BOSS SIM CLEAR' : isBoss ? 'SECTOR SECURED' : 'PHASE CLEAR';
        setLevelClearBanner(`${title} · ${levelRank}`);
        spawnText(`${levelRank} RANK`, W / 2, H / 2 + 66, "#ffd700", 46);
        setTimeout(() => {
          setLevelClearBanner(null);
          setMissionStarted(false);
          setCurrentLevel(prev => {
            if (testingBossRun) return TESTING_BOSS_LEVEL;
            const prevSector = Math.ceil(prev / LEVELS_PER_SECTOR);
            if (prevSector !== 99) return prev + 1;
            const firstBonusLevel = (99 - 1) * LEVELS_PER_SECTOR + 1;
            const lastBonusLevel = firstBonusLevel + LEVELS_PER_SECTOR - 1;
            return prev >= lastBonusLevel ? firstBonusLevel : prev + 1;
          });
          setRestartKey(k => k + 1);
        }, isBoss ? 2500 : 1500);
      } else {
        setBossIntro(null);
        sfx.explosion();
        shake = 50;
        setGameResult({
          status: "FAILED",
          title: "SYSTEM COLLAPSE",
          score: sessionScore,
          levelStr: reason
        });
        setIsGameOver(true);
      }
    };


    const activatePower = (p: any) => {
      startPowerCooldown(p.type);
      sfx.powerup();
      glitchFrames = 12;
      shake = 20;
      if (p.type === 'rocket') { rocketRain = 300; spawnText('ROCKET RAIN!', W/2, H/2, '#ff1a24', 70); flashes.push({life:1, color:'#ff1a24'}); }
      else if (p.type === 'slow') { slowMo = Math.max(slowMo, getSlowDuration()); usedTimeMechanic = true; spawnText('TIME FREEZE!', W/2, H/2, '#00f2ff', 70); flashes.push({life:1, color:'#00f2ff'}); }
      else if (p.type === 'freeze') { slowMo = Math.max(slowMo, getSlowDuration() + 40); usedTimeMechanic = true; spawnText('DEEP FREEZE!', W/2, H/2, '#bff7ff', 76); flashes.push({life:1.2, color:'#ffffff', intensity:0.75}); shake = Math.max(shake, 28); }
      else if (p.type === 'auto') { autoSlicer = getAutoDuration(); spawnText('AUTO SLICER!', W/2, H/2, '#00ff88', 70); flashes.push({life:1, color:'#00ff88'}); }
      else if (p.type === 'multi') { multiScore = 400; spawnText('SCORE x2!', W/2, H/2, '#ffd700', 70); flashes.push({life:1, color:'#ffd700'}); }
      else if (p.type === 'magnet') { magnetActive = getMagnetDuration(); spawnText('MAGNET!', W/2, H/2, '#ff88ff', 70); flashes.push({life:1, color:'#ff88ff'}); }
      else if (p.type === 'shield') { shieldActive = true; spawnText('SHIELD UP!', W/2, H/2, '#00aaff', 70); flashes.push({life:1, color:'#00aaff'}); }
      else if (p.type === 'chaos') { chaosFrenzyTimer = 600; spawnText('CHAOS FRENZY!', W/2, H/2, '#ff00ff', 80); flashes.push({life:1, color:'#ff00ff'}); shake=30; glitchFrames=20; }
      else if (p.type === 'giant') {
        giantModeTimer = Math.max(giantModeTimer, getGiantDuration());
        spawnText('TITAN FORM!', W/2, H/2, '#ffcf66', 72);
        flashes.push({life:1, color:'#ffcf66'});
        shake = Math.max(shake, 34);
      }
      else if (p.type === 'quake') {
        spawnText('SCREEN QUAKE!', W/2, H/2, '#ffffff', 76);
        flashes.push({life:0.9, color:'#ffffff', intensity:0.8});
        shake = 95; glitchFrames = 34;
        gdObstacles = gdObstacles.filter(ob => ob.type !== 'rocket' && ob.type !== 'mine');
        bossRockets = [];
        hazardBeams = [];
      }
      else if (p.type === 'whiteout') {
        spawnText('WHITEOUT!', W/2, H/2, '#ffffff', 82);
        flashes.push({life:1.4, color:'#ffffff', intensity:1});
        shake = 70; glitchFrames = 38;
        fireShockwave(mouse.x > 0 ? mouse.x : W/2, mouse.y > 0 ? mouse.y : H/2, 420, 'WHITEOUT WAVE');
      }
      else if (p.type === 'void') {
        magnetActive = Math.max(magnetActive, getMagnetDuration() * 1.4);
        chaosFrenzyTimer = Math.max(chaosFrenzyTimer, 240);
        spawnText('VOID PULL!', W/2, H/2, '#bc13fe', 76);
        flashes.push({life:1, color:'#bc13fe'});
        shake = Math.max(shake, 36);
      }
      else if (p.type === 'bomb') {
        // ATOMIC BOMB — short cinematic burst, then cleanup.
        awardAchievement("atomic_trigger");
        atomicSequenceTimer = Math.max(atomicSequenceTimer, 100);
        slowMo = Math.max(slowMo, 58);
        eyeCore.active = true;
        triggerEyeBurst(1.7, true);
        triggerLightning({ duration: 110, hue: 14, speed: 1.65, intensity: 1.35, size: 1.08 });
        spawnText('ATOMIC BOMB', W/2, H/2, '#ffd700', 80);
        flashes.push({life:1, color:'#ffd700'});
        flashes.push({life:0.8, color:'#ff4400'});
        flashes.push({life:0.5, color:'#ffffff', intensity:0.8});
        shake = 80;
        glitchFrames = 40;
        sfx.explosion();
        sfx.explosion();

        if (levelType === "boss") {
          const splash = isTestingBossLevel ? 30 : 22;
          bossHealth -= splash;
          bossRockets = [];
          hazardBeams = [];
          spawnText(`ATOMIC HIT -${splash}`, W/2, H * 0.22, '#ffd700', 34);
          if (bossHealth <= 0) {
            endLevel("BOSS ELIMINATED", true);
            return;
          }
        }

        // Nuke every cube on screen with particle explosion
        if (levelType === 'chess') {
          for(let r=0;r<CHESS_ROWS;r++) {
            for(let c=0;c<CHESS_COLS;c++) {
              const p = chessBoard[r][c];
              if (p && p.owner === 'enemy' && p.type !== 'core') {
                chessBoard[r][c] = null;
                for(let i=0;i<20;i++) pixelSparks.push({x:W/2,y:H/2,vx:(Math.random()-0.5)*200,vy:(Math.random()-0.5)*200,life:1,color:'#ffd700',size:3});
              }
            }
          }
          chessMsg = 'ATOMIC BOMB WIPED OUT ENEMY FORCES!';
        } else {
          cubes.forEach(c => {
            if (!c.destroyed && !c.isMine) {
              c.destroyed = true;
              awardPoints(c.isGold ? 500 : 150);
              targetsDestroyed++;
              for(let i=0;i<20;i++) pixelSparks.push({x:c.x,y:c.y,vx:(Math.random()-0.5)*200,vy:(Math.random()-0.5)*200,life:1,color:'#ffd700',size:3});
              particles.push({ x:c.x, y:c.y, vx:(Math.random()-0.5)*50, vy:(Math.random()-0.5)*50, life:1, color:c.color, size:6 });
            }
          });
        }
        // Massive pixel storm
        for(let i=0;i<200;i++) pixelSparks.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-0.5)*400,vy:(Math.random()-0.5)*400,life:1,color:`hsl(${Math.random()*60+30},100%,70%)`,size:Math.random()*5+2});
        spawnText(`+${sessionScore}`, W/2, H/2+80, '#ffd700', 40);
        if (targetsDestroyed >= targetsNeeded) endLevel('NUKE COMPLETE', true);
      }
      // Big pixel burst on powerup
      for(let i=0;i<60;i++) pixelSparks.push({x:W/2,y:H/2,vx:(Math.random()-0.5)*250,vy:(Math.random()-0.5)*250,life:1,color:flashes[flashes.length-1]?.color||'#fff',size:Math.random()*4+1});
    };

    const hitCube = (c: any, source = 'direct') => {
      if (c.destroyed) return;
      c.destroyed = true;
      
      if (c.isMine) {
        if (!absorbHazard("MINE DETONATED!", c.x, c.y, { mine: true })) {
          // MINE HIT = restart this level only, not full game over
          sfx.mine();
          shake = 60;
          glitchFrames = 30;
          flashes.push({ life: 1, color: '#ff003c' });
          active = false;
          spawnText("MINE DETONATED!", W/2, H/2, COLOR_MINE, 60);
          setTimeout(() => {
            // restart same level
            setIsGameOver(true);
            setGameResult({
              status: "FAILED",
              title: "MINE DETONATED",
              score: sessionScore,
              levelStr: "Level restarting..."
            });
          }, 800);
        }
        return;
      }
      
      sfx.hit();
      combo++;
      hitCount++;
      targetsDestroyed++;
      registerSolarPickup(c.x, c.y);
      triggerPhaseRush();
      addFever(c.isGold ? 8 : 4);

      const isCritical = hasCritical && hitCount % 5 === 0;
      shake = Math.max(shake, Math.min(12, combo * 0.5));
      let basePts = (c.isGold ? 500 : 100) * (isCritical ? 3 : 1);
      basePts += Math.floor(combo / 5) * 50;
      if (skill.executor && targetsDestroyed >= targetsNeeded) basePts *= 3;
      const pts = awardPoints(basePts);

      createParticles(c.x, c.y, c.color, isCritical ? 50 : 25);
      if (skill.vampire && (levelType === 'static' || levelType === 'chaos_bonus')) {
        timeRemaining += 0.5;
      }

      if (isCritical) {
        spawnText('CRITICAL x3!', c.x, c.y - 30, '#ffd700', 36);
        shake = Math.max(shake, 20); glitchFrames = 8;
        flashes.push({life:0.5, color:'#ffd700'});
      } else if (combo >= 50) {
        spawnText(`ULTRA x${combo}!`, W/2, H/2, '#ffd700', 70);
        shake = Math.max(shake, 25);
      } else if (combo > 0 && combo % 10 === 0) {
        spawnText(`COMBO x${combo}!`, W/2, H/2 + 50, planet.color, 60);
        shake = Math.max(shake, 15);
      } else if (combo > 0 && combo % 5 === 0) {
        spawnText('CRITICAL STRIKE!', c.x, c.y + 20, COLOR_MINE, 28); shake = 8;
      } else {
        spawnText(`+${pts}`, c.x, c.y - 20, c.color, 22);
      }

      if (skill.ricochet && source === 'direct') {
        const next = cubes
          .filter(target => !target.destroyed && !target.isMine && target !== c)
          .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
        if (next && Math.hypot(next.x - c.x, next.y - c.y) < 240) {
          hitCube(next, 'ricochet');
          spawnText('RICOCHET', next.x, next.y - 35, '#ffd700', 20);
        }
      }

      if (skill.echo && source !== 'echo') {
        setTimeout(() => {
          if (!active) return;
          cubes.forEach(target => {
            if (!target.destroyed && !target.isMine && Math.hypot(target.x - c.x, target.y - c.y) < 150) {
              hitCube(target, 'echo');
            }
          });
        }, 200);
      }

      if (skill.shockwave && combo % 10 === 0) fireShockwave(c.x, c.y, 300, 'COMBO SHOCKWAVE');
      if (skill.overdrive2 && combo % 50 === 0) {
        spawnText('OVERDRIVE II!', W/2, H/2, '#ffd700', 70);
        cubes.forEach(target => {
          if (!target.destroyed && !target.isMine) hitCube(target, 'overdrive2');
        });
      }

      if (skill.frenzy && combo >= 20 && frenzyTimer <= 0) {
        frenzyTimer = 600;
        spawnText('FRENZY SPEED!', W/2, H/2 + 90, '#ff8800', 32);
      }
      if (skill.berserk && combo > 0 && combo % 25 === 0 && berserkTimer <= 0 && berserkCrashTimer <= 0) {
        berserkTimer = 300;
        spawnText('BERSERK x10!', W/2, H/2 - 90, '#ff003c', 46);
      }

      if (levelType === 'static') {
        const remainingTargets = cubes.filter(cb => !cb.destroyed && !cb.isMine).length;
        if (remainingTargets === 0) endLevel('GRID CLEARED', true);
      } else if (targetsDestroyed >= targetsNeeded) {
        endLevel('PHASE COMPLETE', true);
      }
    };


    // Skills wired up
    const hasBlast    = skill.blast;
    const hasRapid    = skill.rapidfire;
    const hasCluster  = skill.cluster;
    const hasCritical = skill.critical;
    let blastCooldown = 0; // frames
    let hitCount = 0; // for critical tracking

    const fireBlast = (x: number, y: number) => {
      if (!hasBlast || blastCooldown > 0 || !active) return;
      blastCooldown = hasRapid ? 20 : 60;
      shake = 20; glitchFrames = 8;
      sfx.explosion();
      createParticles(x, y, planet.color, 40);
      flashes.push({life:0.5, color: planet.color});
      // Big pixel burst
      for(let i=0;i<60;i++) pixelSparks.push({x,y,vx:(Math.random()-0.5)*300,vy:(Math.random()-0.5)*300,life:1,color:planet.color,size:Math.random()*4+2});
      
      if (levelType === 'gd' || levelType === 'operative') {
        const hitIdx = gdObstacles.findIndex(o => (o.type==='spike'||o.type==='mine'||o.type==='laser') && o.x > gdPlayer.x && o.x < gdPlayer.x + W/2);
        if (hitIdx !== -1) {
          const ob = gdObstacles[hitIdx];
          createParticles(ob.x + ob.w/2, ob.y + ob.h/2, '#ff0066', 50);
          gdObstacles.splice(hitIdx, 1);
          sfx.explosion();
        }
        return;
      }
      
      if (levelType === 'chess') {
        const CELL = Math.min(W, H * 0.8) / CHESS_COLS;
        const BOARD_W = CELL * CHESS_COLS, BOARD_H = CELL * CHESS_ROWS;
        const bx = (W - BOARD_W) / 2, by = (H - BOARD_H) / 2 - 20;
        const col = Math.floor((x - bx) / CELL);
        const row = Math.floor((y - by) / CELL);
        if (row >= 0 && row < CHESS_ROWS && col >= 0 && col < CHESS_COLS) {
          const piece = chessBoard[row][col];
          if (piece && piece.owner === 'enemy' && piece.type !== 'core') {
            chessBoard[row][col] = null;
            chessMsg = 'BLAST DESTROYED ENEMY PIECE!';
          }
        }
        return;
      }
      // Destroy all non-mine cubes in 200px radius (cluster: 6 mini blasts too)
      const blastR = 200;
      cubes.forEach(c => {
        if (!c.destroyed && Math.sqrt((x-c.x)**2+(y-c.y)**2) < blastR) {
          if (!c.isMine) hitCube(c);
        }
      });
      if (hasCluster) {
        // 6 mini blasts around the click
        for(let i=0;i<6;i++) {
          const a=(i/6)*Math.PI*2;
          const mx=x+Math.cos(a)*120; const my=y+Math.sin(a)*120;
          cubes.forEach(c => {
            if (!c.destroyed && !c.isMine && Math.sqrt((mx-c.x)**2+(my-c.y)**2) < 80) hitCube(c);
          });
          createParticles(mx, my, planet.color, 10);
        }
      }
      if (skill.phantom) {
        setTimeout(() => {
          if (!active) return;
          createParticles(x, y, '#ffffff', 30);
          cubes.forEach(c => {
            if (!c.destroyed && !c.isMine && Math.sqrt((x-c.x)**2+(y-c.y)**2) < 180) hitCube(c, 'phantom');
          });
          spawnText('PHANTOM BLAST', x, y - 70, '#ffffff', 28);
        }, 2000);
      }
      spawnText('BLAST!', x, y-40, planet.color, 40);
    };

    const fireSnailShot = () => {
      if (!active || snailPlayer.dead || snailPlayer.shootCooldown > 0) return;
      initAudio();
      snailShots.push({
        x: snailPlayer.x,
        y: snailPlayer.y - 30,
        vy: -(18 + (snailPlayer.boost > 0 ? 6 : 0)),
        life: 70,
      });
      snailPlayer.shootCooldown = skill.rapidfire ? 5 : 9;
      playSound(920, 'square', 0.06, 0.05);
    };

    const checkCollisions = (x: number, y: number) => {
      if (!active) return;
      initAudio();

      const rushBonus = skill.phaserush ? 1 + phaseRushStacks * 0.1 : 1;
      const r = (autoSlicer > 0 ? 150 : baseHitbox) * rushBonus;

      const hitsBoss =
        levelType === 'boss' &&
        bossY > 0 &&
        (Math.abs(x - bossX) < 200 && Math.abs(y - bossY) < 100);
      if (hitsBoss) {
         bossHealth -= autoSlicer > 0 ? 2 : 1;
         sfx.bossHit();
         createParticles(x, y, COLOR_MINE);
         shake = 5;
         awardPoints(50);
         spawnText("-1", x, y, COLOR_MINE);
         if (bossHealth <= 0) {
           endLevel("BOSS ELIMINATED", true);
           return;
         }
      }

      cubes.forEach(c => {
        if (!c.destroyed && Math.sqrt((x - c.x)**2 + (y - c.y)**2) < r) hitCube(c);
      });
      
      powerUps.forEach(p => {
        if (!p.destroyed && Math.sqrt((x - p.x)**2 + (y - p.y)**2) < 60) {
          if (p.type === "material") {
            p.destroyed = true;
            const picked = (p.materialId as MaterialId | undefined) ?? rollMaterialForLevel(Math.max(1, currentLevel));
            grantMaterial(picked, 1, "PICKUP");
            sfx.powerup();
            return;
          }
          if (isPowerOnCooldown(p.type)) {
            spawnText(`${p.type.toUpperCase()} CD`, x, y - 26, "#888", 16);
            return;
          }
          p.destroyed = true;
          activatePower(p);
        }
      });
    };

    const poly = (pts: {x:number,y:number}[], fill: string, strokeCol: string) => {
      ctx.beginPath();
      pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (strokeCol) { ctx.strokeStyle = strokeCol; ctx.lineWidth = 1; ctx.stroke(); }
    };

    const draw = (time: number) => {
      animationFrameId = requestAnimationFrame(draw);
      // Keep physics stable after tab stalls without fighting the display refresh rate.
      const deltaTime = Math.min(33.4, Math.max(0, time - lastTime));
      lastTime = time;
      
      tick += deltaTime / 1000;
      let speedMultiplier = skill.overload ? 2 : 1;
      if (frenzyTimer > 0) speedMultiplier *= 2;
      if (solarRingBoostTimer > 0) speedMultiplier *= 1.12;
      speedMultiplier *= craftedGearSpeedMul;
      const dt = (slowMo > 0 ? 0.3 : 1) * speedMultiplier;
      
      if (slowMo > 0) slowMo -= deltaTime/16;
      if (autoSlicer > 0) autoSlicer -= deltaTime/16;
      if (multiScore > 0) multiScore -= deltaTime/16;
      if (solarRingBoostTimer > 0) solarRingBoostTimer -= deltaTime / 16;
      if (voidCloakTimer > 0) voidCloakTimer -= deltaTime / 16;
      if (voidCloakCooldown > 0) voidCloakCooldown -= deltaTime / 16;
      if (plasmaImpulseTimer > 0) plasmaImpulseTimer -= deltaTime / 16;
      if (plasmaImpulseCooldown > 0) plasmaImpulseCooldown -= deltaTime / 16;
      if (titaniumGuardCooldown > 0) titaniumGuardCooldown -= deltaTime / 16;
      if (feverTimer > 0) feverTimer -= deltaTime/16;
      if (berserkTimer > 0) {
        berserkTimer -= deltaTime/16;
        if (berserkTimer <= 0) berserkCrashTimer = 180;
      }
      if (berserkCrashTimer > 0) berserkCrashTimer -= deltaTime/16;
      if (frenzyTimer > 0) frenzyTimer -= deltaTime/16;
      if (phaseRushTimer > 0) {
        phaseRushTimer -= deltaTime/16;
        if (phaseRushTimer <= 0) phaseRushStacks = 0;
      }
      if (glitchFrames > 0) glitchFrames--;

      if (lightningTimer > 0) {
        lightningTimer -= deltaTime / 16;
        lightningHue = (lightningHue + 3.6 * (deltaTime / 16)) % 360;
        lightningXOffset = Math.sin(tick * 1.7) * 0.14;
        lightningIntensity = Math.max(0.8, lightningIntensity * 0.995);
      } else {
        lightningIntensity = 1.1;
      }
      if (atomicSequenceTimer > 0) atomicSequenceTimer -= deltaTime / 16;
      eyeCore.pulse = Math.max(0, eyeCore.pulse - 0.025 * (deltaTime / 16));
      eyeCore.burst = Math.max(0, eyeCore.burst - 0.045 * (deltaTime / 16));
      eyeCore.reveal += ((eyeCore.active ? 1 : 0) - eyeCore.reveal) * 0.11;
      eyeCore.x += (eyeCore.tx - eyeCore.x) * 0.15;
      eyeCore.y += (eyeCore.ty - eyeCore.y) * 0.15;
      
      // Random ambient shakes — intense and frequent
      randomShakeTimer -= deltaTime;
        if (randomShakeTimer <= 0) {
          if (levelType === 'chaos_bonus' || levelType === 'chaos_intro') {
            shake = Math.max(shake, (3 + Math.random() * 6) * craftedKnockbackMul);
            glitchFrames = Math.max(glitchFrames, 2 + Math.floor(Math.random() * 4));
            for (let i = 0; i < 4; i++) {
            pixelSparks.push({
              x: Math.random() * W,
              y: Math.random() * H,
              vx: (Math.random() - 0.5) * 24,
              vy: (Math.random() - 0.5) * 24,
              life: 0.45,
              color: `hsl(${Math.floor(tick * 80) % 360},100%,70%)`,
              size: Math.random() * 2 + 1,
            });
          }
        }
        randomShakeTimer = 2200 + Math.random() * 2600;
      }

      ctx.save();
      
      // Glitch offset: chromatic aberration style
      if (glitchFrames > 0 && glitchFrames % 2 === 0) {
        ctx.translate((Math.random()-0.5)*glitchFrames*1.5, (Math.random()-0.5)*glitchFrames*0.5);
      }
      
      if (shake > 0) {
        ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
        shake *= 0.88;
        if (shake < 0.5) shake = 0;
      }

      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, W, H);

      if (sectorId === 1) {
        const cyberiaBackdrop = getCyberiaBackdrop();
        if (cyberiaBackdrop) {
          ctx.save();
          const overflow = cyberiaBackdrop.width - W;
          const driftX = -overflow * 0.5 + Math.sin(tick * 0.12) * overflow * 0.32;
          ctx.globalAlpha = levelType === "gd" || levelType === "operative" ? 0.88 : 0.78;
          ctx.drawImage(cyberiaBackdrop, driftX, 0);
          ctx.restore();

          // Lightweight traffic layer gives the city motion without another canvas loop.
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          ctx.lineCap = "round";
          const trafficColors = ["rgba(90,235,255,0.34)", "rgba(255,76,142,0.28)", "rgba(255,185,74,0.24)"];
          for (let lane = 0; lane < 7; lane++) {
            const direction = lane % 2 === 0 ? 1 : -1;
            const travel = (tick * (120 + lane * 17) + lane * 241) % (W + 300);
            const x = direction > 0 ? travel - 150 : W + 150 - travel;
            const y = H * (0.2 + lane * 0.073) + Math.sin(tick * 0.9 + lane) * 5;
            ctx.strokeStyle = trafficColors[lane % trafficColors.length];
            ctx.lineWidth = lane % 3 === 0 ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - direction * (44 + lane * 7), y + direction * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
      
      // Grid — color shifts during glitch
      ctx.strokeStyle = glitchFrames > 0 ? `rgba(${glitchFrames*8},50,255,0.12)` : sectorId === 1 ? 'rgba(90,220,255,0.055)' : 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for(let i=0; i<W; i+=100) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
      for(let i=0; i<H; i+=100) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }

      if (paused && active) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        return;
      }


      if (active) {
        levelElapsed += deltaTime / 1000;
        if (blastCooldown > 0) blastCooldown--;
        // Decay spell cooldowns
        Object.keys(spellCooldowns).forEach(k => { if (spellCooldowns[k] > 0) spellCooldowns[k]--; });
        Object.keys(powerCooldowns).forEach(k => {
          if (powerCooldowns[k] > 0) powerCooldowns[k] -= deltaTime / 16;
        });

        if (skill.pulsewave) {
          pulsewaveTimer -= deltaTime/16;
          if (pulsewaveTimer <= 0) {
            pulsewaveTimer = 15 * 60;
            fireShockwave(mouse.x > 0 ? mouse.x : W/2, mouse.y > 0 ? mouse.y : H/2, 280, 'PULSE WAVE');
          }
        }
        if (skill.doubleTime) {
          doubleTimeTimer -= deltaTime/16;
          if (doubleTimeTimer <= 0) {
            doubleTimeTimer = 30 * 60;
            slowMo = Math.max(slowMo, getSlowDuration());
            spawnText('DOUBLE SLOW AUTO', W/2, H/2 + 60, '#00f2ff', 28);
          }
        }
        if (skill.guardian) {
          guardianTimer -= deltaTime/16;
          if (guardianTimer <= 0) {
            guardianTimer = 30 * 60;
            shieldActive = true;
            spawnText('GUARDIAN SHIELD', W/2, H/2 + 30, '#00aaff', 28);
          }
        }
        if (skill.entropy) {
          entropyTimer -= deltaTime/16;
          if (entropyTimer <= 0) {
            entropyTimer = 5 * 60;
            const types = ['slow','freeze','multi','auto','rocket','magnet','shield','quake','whiteout','void','bomb','giant'];
            powerUps.push({ x: Math.random()*W, y: H+60, vx:(Math.random()-0.5)*8, vy:-Math.random()*14-10, gravity:0.2, type:types[Math.floor(Math.random()*types.length)], destroyed:false });
            spawnText('ENTROPY DROP', W/2, H - 80, '#ff8800', 20);
          }
        }

        if (giantModeTimer > 0) {
          giantModeTimer -= deltaTime / 16;
          if (giantModeTimer <= 0) giantModeTimer = 0;
        }
        
        // Rotate spawn pattern every ~4 seconds
        patternTimer++;
        if (patternTimer > 240 && levelType === 'ninja') {
          patternTimer = 0;
          const patterns = ['bottom','left','right','diagonal_left','diagonal_right','zigzag','rain','bottom','bottom'];
          currentPattern = patterns[Math.floor(Math.random() * patterns.length)];
          const labels: Record<string,string> = {left:'<< LEFT',right:'RIGHT >>',diagonal_left:'DIAGONAL',diagonal_right:'DIAGONAL',zigzag:'ZIGZAG',rain:'RAIN',bottom:'DROP'};
          spawnText(labels[currentPattern]||'', W - 150, 50, planet.color, 14);
        }
        
        // GD Platformer level
        if (levelType === 'gd' || levelType === 'operative') {
          const floorY = H * 0.75;
          const ceilY  = H * 0.1;
          const sector = Math.ceil(currentLevel / LEVELS_PER_SECTOR);
          let baseSpeed = 5 + currentLevel * 0.4;
          if (sector === 99) {
             // Momentum: start slow, build up as player travels
             baseSpeed = 4 + Math.min(6.5, gdDistanceTravelled / 1500); 
          }
          updateGdSectionState();
          const sectionSpeedMul = gdSectionIndex === 0 ? 0.95 : gdSectionIndex === 1 ? 1.24 : gdSectionIndex === 2 ? 1.05 : 1.34;
          const gdImpulseMul = plasmaImpulseTimer > 0 ? 1.22 : 1;
          const gdSpd  = baseSpeed * sectionSpeedMul * dt * gdImpulseMul;
          const gravityBase = gdPlayer.gravFlipped ? -0.5 : 0.5;
          const gravity = gravityBase * craftedFallMul;
          const titanIntensity = giantModeTimer > 0 ? 2.1 : 1;

          if (gdModifierCooldown > 0) gdModifierCooldown -= deltaTime / 16;
          if (gdModifierTimer > 0) {
            gdModifierTimer -= deltaTime / 16;
            if (gdModifierTimer <= 0) clearGdModifier();
          } else if (gdModifierCooldown <= 0 && Math.random() < 0.008) {
            triggerGdModifier();
          }

          const progressNow = getTrackProgress();
          if (!gdMiniBossTriggered && progressNow >= 0.52) {
            gdMiniBossTriggered = true;
            gdMiniBossActive = true;
            gdMiniBossTimer = 11.5 * 60;
            gdMiniBossFireTimer = 0;
            gdMiniBossDroneY = Math.max(ceilY + 70, Math.min(floorY - 70, gdPlayer.y));
            spawnText("MINI-BOSS: STRIKE DRONE", W / 2, 88, "#ff4466", 28);
          }

          if (gdMiniBossActive) {
            gdMiniBossTimer -= deltaTime / 16;
            gdMiniBossFireTimer -= deltaTime / 16;
            gdMiniBossDroneY += Math.sin(tick * 2.2) * 1.6;
            if (gdMiniBossFireTimer <= 0) {
              gdMiniBossFireTimer = 24 + Math.random() * 16;
              const pattern = Math.floor(Math.random() * 3);
              if (pattern === 0) {
                for (let s = -1; s <= 1; s++) {
                  gdObstacles.push({
                    x: W + 170,
                    y: Math.max(ceilY + 45, Math.min(floorY - 45, gdMiniBossDroneY + s * 48)),
                    w: 74,
                    h: 22,
                    type: "rocket",
                    isMine: true,
                    vx: -(9.2 + Math.random() * 1.4),
                    warn: 50 * neonWarningMul,
                  });
                }
              } else if (pattern === 1) {
                const beamY = ceilY + 30 + Math.random() * Math.max(40, floorY - ceilY - 60);
                hazardBeams.push({ y: beamY, life: 105, maxLife: 105, mini: true });
              } else {
                gdObstacles.push({ x: W + 110, y: floorY, w: 25, h: 45, type: "spike", isMine: true, telegraph: 30 * neonWarningMul });
                gdObstacles.push({ x: W + 155, y: floorY, w: 25, h: 45, type: "spike", isMine: true, telegraph: 30 * neonWarningMul });
              }
            }
            if (gdMiniBossTimer <= 0) {
              gdMiniBossActive = false;
              spawnText("MINI-BOSS CLEARED", W / 2, 88, "#00ff88", 24);
              grantRandomMaterial("MINI DROP");
              powerUps.push({
                x: Math.min(W - 120, gdPlayer.x + 240),
                y: Math.max(ceilY + 60, gdPlayer.y - 50),
                vx: -2.4,
                vy: -2.2,
                gravity: 0.1,
                    type: Math.random() < 0.65 ? "giant" : "shield",
                    destroyed: false,
                  });
                }
              }

          ctx.save();
          const laneGradient = ctx.createLinearGradient(0, ceilY, 0, floorY);
          laneGradient.addColorStop(0, 'rgba(6, 12, 26, 0.62)');
          laneGradient.addColorStop(0.5, 'rgba(10, 22, 42, 0.28)');
          laneGradient.addColorStop(1, 'rgba(6, 8, 18, 0.55)');
          ctx.fillStyle = laneGradient;
          ctx.fillRect(0, ceilY, W, floorY - ceilY);

          const streakCount = giantModeTimer > 0 ? 36 : 22;
          ctx.lineWidth = 1.15;
          for (let s = 0; s < streakCount; s++) {
            const seed = s * 97.13;
            const x = ((tick * (155 + titanIntensity * 65) + seed) % (W + 320)) - 160;
            const yBase = ceilY + ((s * 41) % Math.max(1, floorY - ceilY));
            const y = yBase + Math.sin(tick * 2.4 + s * 0.75) * (6 + titanIntensity * 5);
            const len = 32 + ((s * 29) % 96);
            const alpha = giantModeTimer > 0 ? 0.28 : 0.12;
            ctx.strokeStyle = giantModeTimer > 0 ? `rgba(255, 200, 110, ${alpha})` : `rgba(125, 155, 255, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + len, y + Math.sin(tick * 3.1 + s) * 5);
            ctx.stroke();
          }

          for (let y = ceilY + ((tick * (28 + titanIntensity * 12)) % 34); y < floorY; y += 34) {
            ctx.strokeStyle = giantModeTimer > 0 ? 'rgba(255, 190, 120, 0.2)' : 'rgba(90, 130, 255, 0.08)';
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y + Math.sin(tick * 2.2 + y * 0.02) * 10);
            ctx.stroke();
          }
          ctx.restore();

          gdRocketTimer -= deltaTime;
          if (!gdPlayer.dead && gdRocketTimer <= 0 && currentLevel > 2) {
            const warningY = Math.max(ceilY + 45, Math.min(floorY - 45, gdPlayer.y + (Math.random() - 0.5) * H * 0.45));
            gdObstacles.push({
              x: W + 160,
              y: warningY,
              w: 74,
              h: 22,
              type: 'rocket',
              isMine: true,
              vx: -(7 + Math.min(6, levelInSector * 0.55)),
              warn: 42 * neonWarningMul,
            });
            gdRocketTimer = Math.max(620, 1650 - levelInSector * 90);
            spawnText('MISSILE LOCK', W - 130, warningY - 18, COLOR_MINE, 18);
          }
          
          // Unlimited air jumps (restored behavior)
          if (gdJumpQueued && !gdPlayer.dead) {
            gdJumpQueued = false;
            const jumpStability = gear.gravityBoots ? 1.05 : 1;
            const jumpPower = (gdPlayer.gravFlipped ? 11 : -11) * jumpStability;
            gdPlayer.vy = jumpPower;
            gdPlayer.jumpsUsed++;
            if (gear.plasmaBelt && plasmaImpulseCooldown <= 0) {
              plasmaImpulseTimer = 24;
              plasmaImpulseCooldown = 180 * 0.88;
              spawnText("PLASMA BOOST", gdPlayer.x + 64, gdPlayer.y - 24, "#ff5e4f", 16);
            }
            if (!firstJumpTriggered) {
              firstJumpTriggered = true;
              awardAchievement("first_jump");
            }
            sfx.hit();
            for (let i = 0; i < 10; i++) {
              pixelSparks.push({
                x: gdPlayer.x,
                y: gdPlayer.y + (gdPlayer.gravFlipped ? -20 : 20),
                vx: (Math.random() - 0.5) * 85,
                vy: (gdPlayer.gravFlipped ? -42 : 42),
                life: 0.5,
                color: planet.color,
                size: Math.random() * 3 + 1,
              });
            }
          }
          
          if (!gdPlayer.dead) {
            if (gdInvulnTimer > 0) gdInvulnTimer -= deltaTime / 16;
            gdPlayer.size = 36;
            gdPlayer.vy += gravity * (deltaTime/16);
            if (!gdPlayer.grounded && craftedAirControlMul > 1) {
              const damping = 1 - (craftedAirControlMul - 1) * 0.09;
              gdPlayer.vy *= Math.max(0.9, damping);
            }
            const maxV = gear.gravityBoots ? 18 : 20;
            gdPlayer.vy = Math.max(-maxV, Math.min(maxV, gdPlayer.vy));
            
            // Ghost trail logic (GD)
            if (tick % 3 === 0) {
              ghostTrail.push({x: gdPlayer.x, y: gdPlayer.y, life: 1.0});
            }
            ghostTrail = ghostTrail.filter(g => {
              g.life -= 0.05;
              return g.life > 0;
            });

            // Draw ghosts
            ghostTrail.forEach(g => {
              ctx.save();
              ctx.globalAlpha = g.life * 0.3;
              ctx.strokeStyle = planet.color;
              ctx.lineWidth = 1;
              ctx.strokeRect(g.x - gdPlayer.size/2, g.y - gdPlayer.size/2, gdPlayer.size, gdPlayer.size);
              if (Math.random() < 0.1) {
                ctx.strokeRect(g.x - gdPlayer.size/2 + (Math.random()-0.5)*10, g.y - gdPlayer.size/2, gdPlayer.size, gdPlayer.size);
              }
              ctx.restore();
            });

            gdPlayer.y += gdPlayer.vy * (deltaTime/16);
            gdDistanceTravelled += gdSpd * (deltaTime/16);

            if (levelType === "operative") {
              timeRemaining = Math.max(0, timeRemaining - deltaTime / 1000);
              const progress = Math.min(1, gdDistanceTravelled / Math.max(1, operativeTrackGoal));
              const checkpointMarks = [0.25, 0.5, 0.75];
              if (operativeCheckpoint < checkpointMarks.length && progress >= checkpointMarks[operativeCheckpoint]) {
                operativeCheckpoint++;
                spawnText(`CHECKPOINT ${operativeCheckpoint}`, W / 2, 120, "#00ff88", 26);
              }
            }

            const upperBound = ceilY + gdPlayer.size / 2;
            const lowerBound = floorY - gdPlayer.size / 2;
            gdPlayer.y = Math.max(upperBound, Math.min(lowerBound, gdPlayer.y));

            // ── Reset grounded every frame, then re-check all surfaces ──
            gdPlayer.grounded = false;

            // Floor
            if (!gdPlayer.gravFlipped && gdPlayer.y + gdPlayer.size/2 >= floorY) {
              gdPlayer.y = floorY - gdPlayer.size/2;
              gdPlayer.vy = 0; gdPlayer.grounded = true; gdPlayer.jumpsUsed = 0;
            }
            // Ceiling
            if (gdPlayer.gravFlipped && gdPlayer.y - gdPlayer.size/2 <= ceilY) {
              gdPlayer.y = ceilY + gdPlayer.size/2;
              gdPlayer.vy = 0; gdPlayer.grounded = true; gdPlayer.jumpsUsed = 0;
            }
            // Platforms — improved collision to prevent falling through
            if (!gdPlayer.gravFlipped && gdPlayer.vy >= 0) {
              for (const ob of gdObstacles) {
                if (ob.type !== 'platform') continue;
                const pL = ob.x - 10, pR = ob.x + ob.w + 10;
                const pTop = ob.y;
                const playerL = gdPlayer.x - gdPlayer.size/2;
                const playerR = gdPlayer.x + gdPlayer.size/2;
                const playerBot = gdPlayer.y + gdPlayer.size/2;
                const prevBot = playerBot - gdPlayer.vy * (deltaTime/16);

                // If falling onto platform or already standing on it
                if (playerR > pL && playerL < pR && prevBot <= pTop + 10 && playerBot >= pTop - 2) {
                  gdPlayer.y = pTop - gdPlayer.size/2;
                  gdPlayer.vy = 0;
                  gdPlayer.grounded = true;
                  gdPlayer.jumpsUsed = 0;
                  break;
                }
              }
            }
          }

          
          // Draw floor & ceiling
          ctx.fillStyle = 'rgba(3, 7, 10, 0.88)';
          ctx.fillRect(0, floorY, W, H - floorY);
          ctx.fillRect(0, 0, W, ceilY);
          ctx.strokeStyle = planet.color;
          ctx.lineWidth = 3;
          ctx.shadowColor = planet.color; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(W, floorY); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, ceilY); ctx.lineTo(W, ceilY); ctx.stroke();
          ctx.shadowBlur = 0;

          if (gdMiniBossActive) {
            ctx.save();
            ctx.shadowColor = "#ff4d7f";
            ctx.shadowBlur = 20;
            ctx.strokeStyle = "#ff4d7f";
            ctx.lineWidth = 2;
            ctx.fillStyle = "rgba(255,77,127,0.2)";
            if (!drawGameSprite("enemyDrone", W - 120, gdMiniBossDroneY, 64, tick * 0.35, "#ff4d7f")) {
              ctx.beginPath();
              ctx.arc(W - 120, gdMiniBossDroneY, 22, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(W - 120, gdMiniBossDroneY);
            ctx.lineTo(W - 160, gdPlayer.y);
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.font = "9px Rajdhani";
            ctx.fillText(`DRONE ${(gdMiniBossTimer / 60).toFixed(1)}s`, W - 172, gdMiniBossDroneY - 30);
            ctx.restore();
          }
          
          // Scroll + draw obstacles
          gdObstacles.forEach((ob, i) => {
            ob.x -= gdSpd * (deltaTime/16);
            if (ob.telegraph && ob.telegraph > 0) {
              ob.telegraph -= deltaTime / 16;
            }
            const telegraphActive = (ob.telegraph ?? 0) > 0;
            
            if (ob.type === 'platform') {
              // Moving platform logic
              if (ob.vx) ob.x += ob.vx * (deltaTime/16);
              if (ob.vy) {
                ob.y += ob.vy * (deltaTime/16);
                if (ob.startY && ob.endY) {
                  if (ob.vy < 0 && ob.y <= ob.startY) { ob.y = ob.startY; ob.vy *= -1; }
                  if (ob.vy > 0 && ob.y >= ob.endY) { ob.y = ob.endY; ob.vy *= -1; }
                }
              }
              // Floating platform — modular Cyberia deck with a neon fallback.
              ctx.save();
              const platformSprite = gameSprites.cyberiaPlatform;
              const hasCyberiaPlatform = sectorId === 1 && platformSprite.complete && platformSprite.naturalWidth > 0;
              if (hasCyberiaPlatform) {
                ctx.shadowColor = planet.color;
                ctx.shadowBlur = 12;
                ctx.drawImage(platformSprite, ob.x - 12, ob.y - 8, ob.w + 24, Math.max(38, ob.h * 3.6));
              } else {
                const grad = ctx.createLinearGradient(ob.x, ob.y, ob.x + ob.w, ob.y);
                grad.addColorStop(0, planet.color + '00');
                grad.addColorStop(0.2, planet.color + 'dd');
                grad.addColorStop(0.8, planet.color + 'dd');
                grad.addColorStop(1, planet.color + '00');
                ctx.fillStyle = grad;
                ctx.shadowColor = planet.color; ctx.shadowBlur = 15;
                ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
              }
              // Top edge glow line
              ctx.strokeStyle = planet.color; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(ob.x, ob.y); ctx.lineTo(ob.x + ob.w, ob.y); ctx.stroke();
              // Tick marks
              ctx.lineWidth = 1; ctx.strokeStyle = planet.color + '66';
              for(let tx = ob.x; tx < ob.x + ob.w; tx += 18) {
                ctx.beginPath(); ctx.moveTo(tx, ob.y); ctx.lineTo(tx, ob.y + ob.h); ctx.stroke();
              }
              ctx.restore();
              if (ob.x < -300) gdObstacles.splice(i, 1);
              return; // next obstacle
            }

            if (ob.type === 'laser') {
              // Move laser up/down with oscillating speed
              const sinMove = Math.sin(tick * 0.05 + i) * 3;
              ob.y += (ob.laserVy + sinMove) * (deltaTime/16);
              if (ob.y <= ob.laserMinY || ob.y >= ob.laserMaxY) {
                ob.laserVy *= -1;
                // Spark effect on bounce
                for(let j=0; j<5; j++) pixelSparks.push({x:ob.x, y:ob.y+(ob.laserVy>0?0:ob.h), vx:(Math.random()-0.5)*50, vy:(Math.random()-0.5)*50, life:0.5, color:'#ff0066', size:2});
              }

              // Draw: animated beam with hazard glow
              const pulse = 0.7 + 0.3 * Math.sin(tick * 0.2);
              ctx.save();
              ctx.shadowColor = '#ff0066'; ctx.shadowBlur = 40 * pulse;
              // Hazard background
              ctx.fillStyle = `rgba(255, 0, 50, ${0.1 * pulse})`;
              ctx.fillRect(ob.x - 15, ob.y, 40, ob.h);
              
              const laserGrad = ctx.createLinearGradient(ob.x, ob.y, ob.x, ob.y + ob.h);
              laserGrad.addColorStop(0, 'transparent');
              laserGrad.addColorStop(0.5, `rgba(255, 20, 100, ${pulse})`);
              laserGrad.addColorStop(1, 'transparent');
              ctx.fillStyle = laserGrad;
              ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
              
              // White core
              ctx.fillStyle = '#fff';
              ctx.fillRect(ob.x + ob.w/2 - 1, ob.y + 10, 2, ob.h - 20);
              ctx.restore();

              // Kill logic (already handle contact)
              if (!gdPlayer.dead) {
                const px = gdPlayer.x, py = gdPlayer.y, hs = gdPlayer.size/2;
                if (px + hs > ob.x && px - hs < ob.x + ob.w && py + hs > ob.y && py - hs < ob.y + ob.h) {
                  if (giantModeTimer > 0) {
                    const smash = awardPoints(180);
                    createParticles(ob.x + ob.w / 2, ob.y + ob.h / 2, "#ffcf66", 28);
                    spawnText(`SMASH +${smash}`, ob.x, ob.y - 12, "#ffcf66", 18);
                    gdObstacles.splice(i, 1);
                    return;
                  }
                  if (gdInvulnTimer > 0 || telegraphActive) return;
                  if (absorbHazard('LASER DISINTEGRATION', px, py, { racing: true })) {
                    gdObstacles.splice(i, 1);
                    return;
                  }
                  if (tryGdPracticeRespawn("LASER HIT", px, py, "#ff0066")) {
                    gdObstacles.splice(i, 1);
                    return;
                  }
                  gdPlayer.dead = true; shake = 60; glitchFrames = 40;
                  sfx.explosion();
                  createParticles(px, py, '#ff0066', 80);
                  endLevel('LASER DISINTEGRATION', false);
                }
              }
              if (ob.x < -300) gdObstacles.splice(i, 1);
              return;
            }

            if (ob.type === 'rocket') {
              ob.warn = Math.max(0, (ob.warn ?? 0) - deltaTime / 16);
              ob.x += ob.vx * (deltaTime/16);

              ctx.save();
              if (ob.warn > 0) {
                ctx.strokeStyle = COLOR_MINE;
                ctx.globalAlpha = 0.35 + Math.sin(tick * 20) * 0.2;
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 8]);
                ctx.beginPath();
                ctx.moveTo(W - 95, ob.y);
                ctx.lineTo(W - 20, ob.y);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;
              }
              ctx.translate(ob.x, ob.y);
              const missileSprite = gameSprites.interceptorMissile;
              if (missileSprite.complete && missileSprite.naturalWidth > 0) {
                const rocketAngle = Math.atan2(ob.vy ?? 0, ob.vx ?? -1) - Math.PI;
                const drawW = ob.w * 1.85;
                const drawH = ob.h * 2.15;
                ctx.rotate(rocketAngle);
                ctx.shadowColor = "rgba(255, 50, 80, 0.4)";
                ctx.shadowBlur = 12;
                ctx.drawImage(missileSprite, -drawW / 2, -drawH / 2, drawW, drawH);
              } else {
                const fallbackW = ob.w * 2.0;
                const fallbackH = ob.h * 2.0;
                ctx.scale(-1, 1);
                ctx.shadowColor = COLOR_MINE;
                ctx.shadowBlur = 18;
                ctx.fillStyle = '#ff1a24';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-fallbackW / 2, -fallbackH / 2);
                ctx.lineTo(fallbackW / 2 - 12, -fallbackH / 2);
                ctx.lineTo(fallbackW / 2, 0);
                ctx.lineTo(fallbackW / 2 - 12, fallbackH / 2);
                ctx.lineTo(-fallbackW / 2, fallbackH / 2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#ffcc66';
                ctx.fillRect(-fallbackW / 2 - 16, -6, 16, 12);
              }
              ctx.restore();

              if (!gdPlayer.dead) {
                const hit = Math.abs(gdPlayer.x - ob.x) < gdPlayer.size/2 + ob.w/2 &&
                  Math.abs(gdPlayer.y - ob.y) < gdPlayer.size/2 + ob.h/2;
                if (hit) {
                  if (giantModeTimer > 0 && ob.warn <= 0) {
                    const smash = awardPoints(210);
                    createParticles(ob.x, ob.y, "#ffcf66", 32);
                    spawnText(`CRUSH +${smash}`, ob.x, ob.y - 12, "#ffcf66", 18);
                    gdObstacles.splice(i, 1);
                    return;
                  }
                  if (ob.warn > 0 || telegraphActive || gdInvulnTimer > 0) return;
                  if (absorbHazard('MISSILE HIT', gdPlayer.x, gdPlayer.y, { racing: true })) {
                    gdObstacles.splice(i, 1);
                    return;
                  }
                  if (tryGdPracticeRespawn("MISSILE HIT", gdPlayer.x, gdPlayer.y, COLOR_MINE)) {
                    gdObstacles.splice(i, 1);
                    return;
                  }
                  gdPlayer.dead = true;
                  shake = 55;
                  glitchFrames = 32;
                  createParticles(gdPlayer.x, gdPlayer.y, COLOR_MINE, 70);
                  endLevel('MISSILE HIT', false);
                }
              }
              if (ob.x < -240) gdObstacles.splice(i, 1);
              return;
            }

            if (ob.type === 'spike' || ob.type === 'mine') {
              if (ob.x > gdPlayer.x + 60 && ob.x < gdPlayer.x + 340) {
                const warnAlpha = 0.18 + (Math.sin(tick * 10 + ob.x * 0.01) + 1) * 0.08;
                ctx.save();
                ctx.fillStyle = `rgba(255, 40, 90, ${warnAlpha})`;
                if (ob.type === "spike") {
                  ctx.fillRect(ob.x - 10, floorY - 12, Math.max(24, ob.w + 20), 8);
                } else {
                  ctx.fillRect(ob.x - (ob.w / 2) - 12, ob.y - (ob.h / 2) - 12, ob.w + 24, ob.h + 24);
                }
                ctx.restore();
              }
              // Draw danger obstacle
              ctx.save();
              ctx.fillStyle = '#1a0000';
              ctx.strokeStyle = COLOR_MINE;
              ctx.lineWidth = 2;
              ctx.shadowColor = COLOR_MINE; ctx.shadowBlur = 10;
              if (ob.type === 'spike') {
                ctx.beginPath();
                ctx.moveTo(ob.x, ob.y);
                ctx.lineTo(ob.x + ob.w/2, ob.y - ob.h);
                ctx.lineTo(ob.x + ob.w, ob.y);
                ctx.closePath(); ctx.fill(); ctx.stroke();
              } else {
                const spriteDrawn = drawGameSprite("hazardMine", ob.x, ob.y, Math.max(66, ob.w * 1.8), tick * 0.18, COLOR_MINE);
                if (!spriteDrawn) {
                  ctx.fillRect(ob.x - ob.w/2, ob.y - ob.h/2, ob.w, ob.h);
                  ctx.strokeRect(ob.x - ob.w/2, ob.y - ob.h/2, ob.w, ob.h);
                }
              }
              ctx.restore();
              // Collision
              if (!gdPlayer.dead) {
                const px=gdPlayer.x; const py=gdPlayer.y;
                const hit = ob.type==='spike'
                  ? (px+gdPlayer.size/2 > ob.x && px-gdPlayer.size/2 < ob.x+ob.w && py+gdPlayer.size/2 > ob.y-ob.h && py < ob.y)
                  : (Math.abs(px-ob.x)<gdPlayer.size/2+ob.w/2 && Math.abs(py-ob.y)<gdPlayer.size/2+ob.h/2);
                if (hit) {
                  if (giantModeTimer > 0) {
                    const smash = awardPoints(ob.type === "mine" ? 220 : 160);
                    createParticles(ob.type === "mine" ? ob.x : ob.x + ob.w / 2, ob.y, "#ffcf66", 30);
                    spawnText(`SMASH +${smash}`, px + 28, py - 20, "#ffcf66", 18);
                    gdObstacles.splice(i, 1);
                    return;
                  }
                  if (telegraphActive || gdInvulnTimer > 0) return;
                  if (absorbHazard('GD FAILED', px, py, { mine: ob.type === 'mine', racing: true })) {
                    gdObstacles.splice(i, 1);
                    return;
                  }
                  if (tryGdPracticeRespawn("CRASH", px, py, COLOR_MINE)) {
                    gdObstacles.splice(i, 1);
                    return;
                  }
                  gdPlayer.dead = true; shake = 40; glitchFrames = 25;
                  createParticles(px, py, COLOR_MINE, 50);
                  endLevel('GD FAILED', false);
                }
              }
            } else if (ob.type === 'cube' && !ob.collected) {
              const s = 40;
              if (!drawGameSprite("dataCore", ob.x, ob.y, 64, tick * 0.24 + ob.x * 0.001, planet.color)) {
                ctx.save();
                ctx.strokeStyle = planet.color; ctx.lineWidth = 2;
                ctx.shadowColor = planet.color; ctx.shadowBlur = 15;
                ctx.strokeRect(ob.x - s/2, ob.y - s/2, s, s);
                ctx.fillStyle = planet.color + '22'; ctx.fillRect(ob.x - s/2, ob.y - s/2, s, s);
                ctx.restore();
              }
              // Collect if player touches
              if (!gdPlayer.dead && Math.abs(gdPlayer.x - ob.x) < gdPlayer.size/2 + s/2 && Math.abs(gdPlayer.y - ob.y) < gdPlayer.size/2 + s/2) {
                ob.collected = true;
                awardPoints(200); targetsDestroyed++;
                registerSolarPickup(ob.x, ob.y);
                triggerPhaseRush();
                addFever(3);
                createParticles(ob.x, ob.y, planet.color, 20);
                spawnText('+200', ob.x, ob.y - 30, planet.color, 24);
                if (targetsDestroyed >= targetsNeeded && !gdCoreGoalReached) {
                  gdCoreGoalReached = true;
                  spawnText("CORE QUOTA REACHED · PUSH TO FINISH", W / 2, 150, "#9ef6ff", 22);
                }
              }
            } else if ((ob.type === 'reward_cube' || ob.type === 'safe_cube') && !ob.collected) {
              const isRisk = ob.type === "reward_cube";
              const s = isRisk ? 42 : 34;
              const rewardColor = isRisk ? "#ffde7a" : "#8cc9ff";
              if (!drawGameSprite(isRisk ? "energyReactor" : "shieldModule", ob.x, ob.y, isRisk ? 70 : 58, Math.sin(tick * 0.8) * 0.05, rewardColor)) {
                ctx.save();
                ctx.strokeStyle = rewardColor;
                ctx.lineWidth = 2;
                ctx.shadowColor = rewardColor;
                ctx.shadowBlur = isRisk ? 18 : 12;
                ctx.strokeRect(ob.x - s/2, ob.y - s/2, s, s);
                ctx.restore();
              }

              if (!gdPlayer.dead && Math.abs(gdPlayer.x - ob.x) < gdPlayer.size/2 + s/2 && Math.abs(gdPlayer.y - ob.y) < gdPlayer.size/2 + s/2) {
                ob.collected = true;
                const bonus = isRisk ? 450 : 140;
                const got = awardPoints(bonus);
                registerSolarPickup(ob.x, ob.y);
                addFever(isRisk ? 5 : 2);
                createParticles(ob.x, ob.y, isRisk ? "#ffde7a" : "#8cc9ff", 20);
                spawnText(`+${got}`, ob.x, ob.y - 28, isRisk ? "#ffde7a" : "#8cc9ff", 22);
              }
            } else if (ob.type === 'giant_orb' && !ob.collected) {
              const orbSize = ob.w ?? 36;
              const pulse = 0.7 + Math.sin(tick * 8 + ob.x * 0.01) * 0.3;
              ctx.save();
              ctx.shadowColor = '#ffcf66';
              ctx.shadowBlur = 26 * pulse;
              ctx.strokeStyle = '#ffcf66';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(ob.x, ob.y, orbSize / 2, 0, Math.PI * 2);
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(ob.x, ob.y, orbSize * 0.3, 0, Math.PI * 2);
              ctx.stroke();
              ctx.fillStyle = 'rgba(255, 207, 102, 0.32)';
              ctx.beginPath();
              ctx.arc(ob.x, ob.y, orbSize * 0.22, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#ff5a3a';
              ctx.fillRect(ob.x - 12, ob.y - 2, 24, 4);
              ctx.fillRect(ob.x - 2, ob.y - 12, 4, 24);
              ctx.restore();

              if (!gdPlayer.dead && Math.abs(gdPlayer.x - ob.x) < gdPlayer.size/2 + orbSize/2 && Math.abs(gdPlayer.y - ob.y) < gdPlayer.size/2 + orbSize/2) {
                ob.collected = true;
                if (isPowerOnCooldown('giant')) {
                  spawnText('TITAN CD', ob.x, ob.y - 26, '#888', 14);
                } else {
                  activatePower({ type: 'giant' });
                }
              }
            } else if (ob.type === 'finish') {
              // FINISH LINE
              ctx.save();
              ctx.strokeStyle = '#ffd700'; ctx.lineWidth = ob.w;
              ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 30;
              ctx.beginPath(); ctx.moveTo(ob.x, H*0.1); ctx.lineTo(ob.x, H*0.75); ctx.stroke();
              ctx.restore();
              ctx.fillStyle = '#ffd700'; ctx.font = 'bold 16px Orbitron'; ctx.textAlign = 'center';
              ctx.fillText('FINISH', ob.x, H*0.1 - 10);
              if (!gdPlayer.dead && gdPlayer.x + gdPlayer.size/2 > ob.x) {
                shake = 30; glitchFrames = 15;
                for(let i=0;i<80;i++) pixelSparks.push({x:ob.x,y:H*0.4+Math.random()*H*0.3,vx:(Math.random()-0.5)*200,vy:(Math.random()-0.5)*200,life:1,color:'#ffd700',size:4});
                if (levelType === "operative") {
                  const survived = timeRemaining <= 0;
                  const collectedCores = targetsDestroyed >= targetsNeeded;
                  const laserClean = laserContactCount === 0;
                  if (survived && collectedCores && laserClean) {
                    endLevel('EXTRACTION COMPLETE', true);
                  } else {
                    ob.x += 1200;
                    spawnText('OBJECTIVES INCOMPLETE', W / 2, H / 2 - 30, '#ff1a24', 30);
                    if (!survived) spawnText('SURVIVE TIMER', W / 2, H / 2 + 10, '#ffffff', 20);
                    if (!collectedCores) spawnText('COLLECT CORES', W / 2, H / 2 + 40, '#ffffff', 20);
                    if (!laserClean) spawnText('LASER CLEAN RUN FAILED', W / 2, H / 2 + 70, '#ffffff', 18);
                  }
                } else {
                  if (targetsDestroyed >= targetsNeeded) {
                    endLevel('GD TRACK COMPLETE', true);
                  } else {
                    ob.x += 900;
                    spawnText('COLLECT MORE CORES', W / 2, H / 2 - 20, '#ffcc66', 30);
                  }
                }
              }
            }
            if (ob.x < -300) gdObstacles.splice(i, 1);
          });

          
          // The selected Hub operative is the physical runner; collision stays compact.
          if (!gdPlayer.dead) {
            ctx.save();
            const titanOn = giantModeTimer > 0;
            ctx.shadowColor = titanOn ? '#ffcf66' : planet.color;
            ctx.shadowBlur = titanOn ? 30 : 20;
            const renderHeight = titanOn ? gdPlayer.size * 4.05 : gdPlayer.size * 3.15;
            const renderWidth = renderHeight * 0.76;
            const spriteY = gdPlayer.gravFlipped
              ? gdPlayer.y - gdPlayer.size / 2 + renderHeight / 2
              : gdPlayer.y + gdPlayer.size / 2 - renderHeight / 2;
            const tilt = Math.max(-0.24, Math.min(0.24, gdPlayer.vy * 0.018));
            if (!drawOperatorSprite(
              gdPlayer.x,
              spriteY,
              renderWidth,
              renderHeight,
              tilt,
              gdPlayer.gravFlipped,
              titanOn ? '#ffcf66' : hero.accent,
            )) {
              const renderSize = titanOn ? gdPlayer.size * 1.86 : gdPlayer.size * 1.48;
              const playerSprite = gameSprites.playerCube;
              ctx.translate(gdPlayer.x, gdPlayer.y);
              ctx.rotate(tilt);
              if (playerSprite.complete && playerSprite.naturalWidth > 0) {
                ctx.drawImage(playerSprite, -renderSize / 2, -renderSize / 2, renderSize, renderSize);
              } else {
                ctx.fillStyle = titanOn ? 'rgba(255, 180, 90, 0.35)' : (planet.color + '33');
                ctx.strokeStyle = titanOn ? '#ffcf66' : planet.color;
                ctx.lineWidth = titanOn ? 3.5 : 3;
                ctx.fillRect(-renderSize / 2, -renderSize / 2, renderSize, renderSize);
                ctx.strokeRect(-renderSize / 2, -renderSize / 2, renderSize, renderSize);
              }
              ctx.rotate(-tilt);
              ctx.translate(-gdPlayer.x, -gdPlayer.y);
            }
            if (titanOn) {
              ctx.strokeStyle = 'rgba(255, 225, 130, 0.85)';
              ctx.lineWidth = 2.2;
              ctx.beginPath();
              ctx.arc(gdPlayer.x, gdPlayer.y, gdPlayer.size * 1.05, 0, Math.PI * 2);
              ctx.stroke();
            }
            if (gdInvulnTimer > 0) {
              ctx.strokeStyle = "#ffd36a";
              ctx.lineWidth = 2;
              ctx.setLineDash([5, 4]);
              ctx.beginPath();
              ctx.arc(gdPlayer.x, gdPlayer.y, gdPlayer.size * 0.76, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);
            }
            ctx.restore();
            // Trail particles
            if (Math.random() < 0.5) pixelSparks.push({x:gdPlayer.x-gdPlayer.size/2,y:gdPlayer.y,vx:-2-Math.random()*3,vy:(Math.random()-0.5)*4,life:0.6,color:planet.color,size:3});
          }
          
          // Progress bar (based on cubes collected)
          const progress = Math.min(1, targetsDestroyed / targetsNeeded);
          ctx.fillStyle = '#111'; ctx.fillRect(W*0.2, H - 30, W*0.6, 6);
          ctx.fillStyle = planet.color; ctx.fillRect(W*0.2, H - 30, W*0.6*progress, 6);
          // Track ends naturally — no regen, finish line handles end
        }

        // ─ CUBE SHOOTER LEVEL ─
        if (levelType === 'snail') {
          const { top: trackTop, bottom: trackBottom, left: trackLeft, right: trackRight } = getSnailBounds();
          const trackHeight = trackBottom - trackTop;
          const trackWidth = trackRight - trackLeft;

          if (mouse.x >= trackLeft && mouse.x <= trackRight && mouse.y > 0) {
            snailPlayer.targetX = mouse.x;
          }

          snailPlayer.targetX = Math.max(trackLeft + 28, Math.min(trackRight - 28, snailPlayer.targetX));
          snailPlayer.targetY = Math.max(trackTop + 28, Math.min(trackBottom - 28, snailPlayer.targetY));
          snailPlayer.x += (snailPlayer.targetX - snailPlayer.x) * 0.3;
          snailPlayer.y += (snailPlayer.targetY - snailPlayer.y) * 0.12;
          snailPlayer.lane = Math.max(0, Math.min(snailLaneCount - 1, Math.floor(((snailPlayer.x - trackLeft) / trackWidth) * snailLaneCount)));
          snailPlayer.targetLane = snailPlayer.lane;
          if (snailPlayer.boost > 0) snailPlayer.boost -= deltaTime/16;
          if (snailPlayer.shield > 0) snailPlayer.shield -= deltaTime/16;
          if (snailPlayer.shootCooldown > 0) snailPlayer.shootCooldown -= deltaTime/16;

          const boostMult = snailPlayer.boost > 0 ? 1.6 : 1;
          const scroll = snailPlayer.speed * boostMult * dt * (deltaTime/16);
          snailDistance += scroll;

          const collectCube = (ob: any) => {
            if (ob.collected) return;
            ob.collected = true;
            targetsDestroyed++;
            registerSolarPickup(ob.x, ob.y);
            const pts = awardPoints(250);
            triggerPhaseRush();
            addFever(4);
            createParticles(ob.x, ob.y, planet.color, 24);
            spawnText(`CUBE +${pts}`, ob.x, ob.y - 28, planet.color, 22);
            if (targetsDestroyed === targetsNeeded) {
              snailPlayer.boost = Math.max(snailPlayer.boost, 180);
              spawnText('CUBE ROUTE CLEAR', W/2, H/2, planet.color, 38);
            }
          };

          const playerHits = (ob: any) =>
            Math.abs(ob.x - snailPlayer.x) < (ob.w / 2 + 22) &&
            Math.abs(ob.y - snailPlayer.y) < (ob.h / 2 + 22);

          const shotHits = (shot: any, ob: any) =>
            Math.abs(ob.x - shot.x) < (ob.w / 2 + 8) &&
            Math.abs(ob.y - shot.y) < (ob.h / 2 + 8);

          // Track shell: vertical combat shaft
          ctx.save();
          const tunnel = ctx.createLinearGradient(trackLeft, trackBottom, trackRight, trackTop);
          tunnel.addColorStop(0, planet.color + '05');
          tunnel.addColorStop(0.5, planet.color + '18');
          tunnel.addColorStop(1, '#00000000');
          ctx.fillStyle = tunnel;
          ctx.fillRect(trackLeft, trackTop, trackRight - trackLeft, trackBottom - trackTop);
          ctx.strokeStyle = planet.color + 'aa';
          ctx.lineWidth = 3;
          ctx.strokeRect(trackLeft, trackTop, trackRight - trackLeft, trackHeight);
          for (let x = trackLeft + 70; x < trackRight; x += 70) {
            ctx.strokeStyle = planet.color + '24';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, trackTop);
            ctx.lineTo(x, trackBottom);
            ctx.stroke();
          }
          for (let y = trackTop + (snailDistance % 80); y < trackBottom; y += 80) {
            ctx.strokeStyle = planet.color + '22';
            ctx.beginPath();
            ctx.moveTo(trackLeft, y);
            ctx.lineTo(trackRight, y - 40);
            ctx.stroke();
          }
          ctx.restore();

          for (let i = snailObstacles.length - 1; i >= 0; i--) {
            const ob = snailObstacles[i];
            ob.y += scroll;
          }

          for (let s = snailShots.length - 1; s >= 0; s--) {
            const shot = snailShots[s];
            shot.y += shot.vy * dt * (deltaTime/16);
            shot.life -= deltaTime/16;
            let consumed = false;

            for (const ob of snailObstacles) {
              if (ob.type === 'finish' || ob.collected || ob.hit || !shotHits(shot, ob)) continue;
              consumed = true;
              if (ob.type === 'cube') {
                collectCube(ob);
              } else if (ob.type === 'boost') {
                ob.collected = true;
                snailPlayer.boost = 240;
                shieldActive = shieldActive || skill.guardian;
                createParticles(ob.x, ob.y, '#00ff88', 24);
                spawnText('BOOST', ob.x, ob.y - 26, '#00ff88', 22);
              } else {
                ob.hit = true;
                createParticles(ob.x, ob.y, COLOR_MINE, 24);
                awardPoints(75);
                spawnText('CLEARED', ob.x, ob.y - 24, '#ff8800', 16);
              }
              break;
            }

            if (consumed || shot.life <= 0 || shot.y < trackTop - 120) {
              snailShots.splice(s, 1);
              continue;
            }

            ctx.save();
            ctx.shadowColor = planet.color;
            ctx.shadowBlur = 16;
            ctx.strokeStyle = planet.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(shot.x, shot.y + 16);
            ctx.lineTo(shot.x, shot.y - 18);
            ctx.stroke();
            ctx.restore();
          }

          for (let i = snailObstacles.length - 1; i >= 0; i--) {
            const ob = snailObstacles[i];

            if (ob.type === 'cube' && !ob.collected) {
              if (!drawGameSprite("dataCore", ob.x, ob.y, 62, Math.sin(tick + ob.x * 0.01) * 0.12, planet.color)) {
                ctx.save();
                ctx.translate(ob.x, ob.y);
                ctx.rotate(Math.sin(tick + ob.x * 0.01) * 0.12);
                ctx.shadowColor = planet.color; ctx.shadowBlur = 18;
                ctx.strokeStyle = planet.color;
                ctx.lineWidth = 2;
                ctx.strokeRect(-18, -18, 36, 36);
                ctx.restore();
              }
            } else if (ob.type === 'mine' && !ob.hit) {
              if (!drawGameSprite("hazardMine", ob.x, ob.y, 68, tick * 0.22, COLOR_MINE)) {
                ctx.save();
                ctx.strokeStyle = COLOR_MINE;
                ctx.lineWidth = 2;
                ctx.strokeRect(ob.x - 20, ob.y - 20, 40, 40);
                ctx.restore();
              }
            } else if (ob.type === 'wall' && !ob.hit) {
              ctx.save();
              ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 16;
              ctx.strokeStyle = '#ff8800';
              ctx.lineWidth = 5;
              ctx.beginPath();
              ctx.moveTo(ob.x - ob.w / 2, ob.y);
              ctx.lineTo(ob.x + ob.w / 2, ob.y);
              ctx.stroke();
              ctx.lineWidth = 1;
              ctx.strokeRect(ob.x - ob.w / 2, ob.y - 12, ob.w, 24);
              ctx.restore();
            } else if (ob.type === 'boost' && !ob.collected) {
              if (!drawGameSprite("energyReactor", ob.x, ob.y, 68, Math.sin(tick) * 0.04, '#00ff88')) {
                ctx.save();
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(ob.x, ob.y, 18, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
              }
            } else if (ob.type === 'finish') {
              ctx.save();
              ctx.strokeStyle = planet.color;
              ctx.lineWidth = 10;
              ctx.shadowColor = planet.color;
              ctx.shadowBlur = 30;
              ctx.beginPath();
              ctx.moveTo(trackLeft, ob.y);
              ctx.lineTo(trackRight, ob.y);
              ctx.stroke();
              ctx.fillStyle = planet.color;
              ctx.font = 'bold 14px Orbitron';
              ctx.textAlign = 'center';
              ctx.fillText('EXIT', ob.x, ob.y - 16);
              ctx.restore();
            }

            if (!snailPlayer.dead && playerHits(ob)) {
              if (ob.type === 'cube' && !ob.collected) {
                collectCube(ob);
              } else if (ob.type === 'boost' && !ob.collected) {
                ob.collected = true;
                snailPlayer.boost = 240;
                shieldActive = shieldActive || skill.guardian;
                createParticles(ob.x, ob.y, '#00ff88', 24);
                spawnText('BOOST', ob.x, ob.y - 26, '#00ff88', 22);
              } else if ((ob.type === 'mine' || ob.type === 'wall') && !ob.hit) {
                ob.hit = true;
                if (!absorbHazard('CUBE RUN CRASH', snailPlayer.x, snailPlayer.y, { mine: ob.type === 'mine', racing: true })) {
                  snailPlayer.dead = true;
                  createParticles(snailPlayer.x, snailPlayer.y, COLOR_MINE, 70);
                  endLevel('CUBE RUN CRASH', false);
                }
              } else if (ob.type === 'finish') {
                if (targetsDestroyed >= targetsNeeded) {
                  endLevel('CUBES SECURED', true);
                } else {
                  spawnText('MISSING CUBES!', W/2, H/2, COLOR_MINE, 42);
                  endLevel('CUBE ROUTE INCOMPLETE', false);
                }
              }
            }

            if (ob.y > H + 140) snailObstacles.splice(i, 1);
          }

          // The selected operative also pilots the full-screen vertical routes.
          ctx.save();
          ctx.translate(snailPlayer.x, snailPlayer.y);
          if (snailPlayer.boost > 0) {
            ctx.shadowColor = '#00ff88';
            ctx.shadowBlur = 24;
          } else {
            ctx.shadowColor = planet.color;
            ctx.shadowBlur = 18;
          }
          const flightTilt = Math.sin(tick * 2) * 0.045;
          const robotHeight = snailPlayer.boost > 0 ? 112 : 104;
          const robotWidth = robotHeight * 0.76;
          const operatorDrawn = drawOperatorSprite(
            0,
            -8 + Math.sin(tick * 3.2) * 2,
            robotWidth,
            robotHeight,
            flightTilt,
            false,
            snailPlayer.boost > 0 ? '#00ff88' : hero.accent,
          );
          if (!operatorDrawn) {
            ctx.strokeStyle = snailPlayer.boost > 0 ? '#00ff88' : planet.color;
            ctx.lineWidth = 3;
            ctx.strokeRect(-22, -22, 44, 44);
          }
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.strokeStyle = snailPlayer.boost > 0 ? '#a8ffce' : hero.accent;
          ctx.lineWidth = snailPlayer.boost > 0 ? 7 : 4;
          ctx.beginPath();
          ctx.moveTo(-10, 30);
          ctx.lineTo(-10, 48 + Math.sin(tick * 8) * 5);
          ctx.moveTo(10, 30);
          ctx.lineTo(10, 48 + Math.cos(tick * 8) * 5);
          ctx.stroke();
          ctx.restore();
          ctx.strokeStyle = snailPlayer.shootCooldown > 0 ? '#555' : '#ffffff';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(0, -42);
          ctx.lineTo(0, -60);
          ctx.stroke();
          if (shieldActive || snailPlayer.shield > 0) {
            ctx.strokeStyle = '#00aaff';
            ctx.beginPath();
            ctx.arc(0, 0, 48, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();

          const routeProgress = Math.min(1, snailDistance / Math.max(1, snailTrackLength));
          ctx.fillStyle = '#111';
          ctx.fillRect(W * 0.2, H - 34, W * 0.6, 6);
          ctx.fillStyle = planet.color;
          ctx.fillRect(W * 0.2, H - 34, W * 0.6 * routeProgress, 6);
        }

        // ─ CHAOS LEVELS ─
        if (levelType === 'chaos_bonus' || levelType === 'chaos_intro') {
          timeRemaining -= deltaTime / 1000;
          const isIntroChaos = levelType === "chaos_intro";
          if (Math.random() < (isIntroChaos ? 0.55 : 0.8)) {
            const sides = ['bottom','left','right','rain','diagonal_left','diagonal_right','zigzag'];
            const bursts = isIntroChaos ? 1 : (skill.singularity ? 2 : 1);
            for (let burst = 0; burst < bursts; burst++) {
              const randomSide = sides[Math.floor(Math.random() * sides.length)];
              const mineChance = isIntroChaos ? 0.18 : 0;
              cubes.push(createCube(Math.random() < mineChance, 'ninja', 0, 0, Math.random() < 0.3, randomSide));
            }
          }
          if (Math.random() < 0.08) {
            glitchFrames = Math.max(glitchFrames, 3);
            shake = Math.max(shake, 2);
          }
          if (Math.random() < 0.006) {
            const types = ['slow','freeze','multi','magnet','shield','quake','whiteout','void','bomb','giant'];
            powerUps.push({ x: Math.random()*W, y: H+60, vx:(Math.random()-0.5)*8, vy:-Math.random()*14-10, gravity:0.2, type:types[Math.floor(Math.random()*types.length)], destroyed:false });
          }
          if (timeRemaining <= 0) endLevel(isIntroChaos ? 'CHAOS INTRO COMPLETE' : 'CHAOS SURVIVED', true);
          if (targetsDestroyed >= targetsNeeded) endLevel(isIntroChaos ? 'CHAOS INTRO COMPLETE' : 'CHAOS MASTERED', true);

        }

        // ─ NEURAL CHESS LEVEL ─
        if (levelType === 'chess') {
          // AI move delay
          if (chessTurn === 'enemy') {
            chessAIDelay--;
            if (chessAIDelay <= 0) doChessAI();
          }

          const CELL = Math.min(W, H * 0.8) / CHESS_COLS;
          const BOARD_W = CELL * CHESS_COLS;
          const BOARD_H = CELL * CHESS_ROWS;
          const bx = (W - BOARD_W) / 2;
          const by = (H - BOARD_H) / 2 - 20;

          // Board background
          ctx.fillStyle = '#0a0a0a';
          ctx.fillRect(bx - 4, by - 4, BOARD_W + 8, BOARD_H + 8);

          for (let r=0; r<CHESS_ROWS; r++) for (let c=0; c<CHESS_COLS; c++) {
            const cx2 = bx + c*CELL, cy2 = by + r*CELL;
            const isLight = (r+c)%2===0;
            const isSelected = chessSelected?.r===r && chessSelected?.c===c;
            const isValidMove = chessValidMoves.some(m=>m.r===r&&m.c===c);

            // Cell background
            ctx.fillStyle = isSelected ? planet.color+'44'
              : isValidMove ? '#ffffff18'
              : isLight ? '#111' : '#080808';
            ctx.fillRect(cx2, cy2, CELL, CELL);

            // Valid move dot
            if (isValidMove) {
              const hasEnemy = chessBoard[r][c]?.owner==='enemy';
              ctx.fillStyle = hasEnemy ? '#ff003caa' : planet.color+'77';
              ctx.beginPath();
              ctx.arc(cx2+CELL/2, cy2+CELL/2, hasEnemy ? CELL*0.4 : CELL*0.15, 0, Math.PI*2);
              ctx.fill();
            }

            // Grid lines
            ctx.strokeStyle = isSelected ? planet.color : '#333'; 
            ctx.lineWidth = isSelected ? 3 : 1;
            ctx.strokeRect(cx2, cy2, CELL, CELL);

            // Piece
            const piece = chessBoard[r][c];
            if (piece) {
              const isEnemy = piece.owner==='enemy';
              const pColor = isEnemy ? '#ff003c' : planet.color;
              
              ctx.save();
              ctx.fillStyle = pColor + (isEnemy?'22':'22');
              ctx.shadowColor = pColor; 
              ctx.shadowBlur = piece.type === 'core' ? 25 : 12;
              
              ctx.beginPath();
              ctx.arc(cx2+CELL/2, cy2+CELL/2, CELL*0.38, 0, Math.PI*2);
              ctx.fill();
              
              // Border circle
              ctx.strokeStyle = pColor; ctx.lineWidth = isSelected ? 2.5 : 1.5;
              ctx.stroke();
              
              // Symbol
              ctx.fillStyle = pColor;
              ctx.font = `bold ${Math.round(CELL*0.35)}px Orbitron`;
              ctx.textAlign='center'; ctx.textBaseline='middle';
              ctx.fillText(PIECE_SYM[piece.type]??'?', cx2+CELL/2, cy2+CELL/2);
              
              // Type label
              ctx.font = `${Math.round(CELL*0.14)}px monospace`;
              ctx.fillStyle = pColor+'99';
              ctx.fillText(piece.type.toUpperCase(), cx2+CELL/2, cy2+CELL*0.82);
              ctx.restore();
            }
          }

          // Column letters & row numbers
          ctx.fillStyle = '#333'; ctx.font = `${Math.round(CELL*0.18)}px monospace`;
          ctx.textBaseline='middle'; ctx.textAlign='center';
          for(let c=0;c<CHESS_COLS;c++) ctx.fillText(String.fromCharCode(65+c), bx+c*CELL+CELL/2, by+BOARD_H+14);
          ctx.textAlign='right';
          for(let r=0;r<CHESS_ROWS;r++) ctx.fillText(`${CHESS_ROWS-r}`, bx-6, by+r*CELL+CELL/2);

          // Status bar
          ctx.save();
          ctx.textAlign='center'; ctx.textBaseline='alphabetic';
          ctx.font='13px Orbitron';
          ctx.fillStyle = chessTurn==='enemy' ? '#ff1a24' : planet.color;
          ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
          ctx.fillText(chessMsg, W/2, by - 20);
          // Legend
          ctx.fillStyle='#444'; ctx.font='9px monospace'; ctx.shadowBlur=0;
          ctx.fillText('◈=CORE  ╋=LANCE(rook)  ◆=BLADE(diag 2)  ⟡=GHOST(L-jump)', W/2, by + BOARD_H + 32);
          // Turn indicator
          ctx.fillStyle = chessTurn==='player' ? planet.color : '#ff1a24';
          ctx.font='bold 10px monospace'; ctx.textAlign='left';
          ctx.fillText(chessTurn==='player'?'YOUR TURN':'ENEMY TURN', bx, by - 36);
          // Hack button
          ctx.textAlign='right';
          ctx.fillStyle = chessHackUsed?'#333':'#ffd700';
          ctx.fillText('H = HACK (convert adjacent enemy)', bx+BOARD_W, by - 36);
          ctx.restore();
        }

        if (levelType === 'static') {
          timeRemaining -= deltaTime/1000;
          if (timeRemaining <= 0) endLevel("TIME EXPIRED", false);
        }

        if (rocketRain > 0) {
          rocketRain -= deltaTime/16;
          // Rockets fall FROM TOP (rain style)
          if (tick % 0.1 < 0.02) {
            rockets.push({ x: Math.random()*W, y: -60, vy: 12, vx: (Math.random()-0.5)*4, fromTop: true });
            sfx.rocket();
          }
        }

        // Player rockets — skip mines, fall from top
        rockets.forEach((r, i) => {
          r.y += r.vy * (deltaTime/16);
          if (r.vx) r.x += r.vx * (deltaTime/16);
          // The same missile chassis, rotated down for the player strike.
          if (!drawGameSpriteRect("interceptorMissile", r.x, r.y + 14, 72, 32, -Math.PI / 2, "#ff003c")) {
            ctx.save();
            ctx.shadowColor = '#ff003c'; ctx.shadowBlur = 15;
            ctx.fillStyle = '#ff1a24';
            ctx.fillRect(r.x-3, r.y, 6, 30);
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(r.x-2, r.y-8, 4, 8);
            ctx.restore();
          }
          
          let hit = false;
          if (levelType === 'chess') {
            const CELL = Math.min(W, H * 0.8) / CHESS_COLS;
            const BOARD_W = CELL * CHESS_COLS, BOARD_H = CELL * CHESS_ROWS;
            const bx = (W - BOARD_W) / 2, by = (H - BOARD_H) / 2 - 20;
            const col = Math.floor((r.x - bx) / CELL);
            const row = Math.floor((r.y - by) / CELL);
            if (row >= 0 && row < CHESS_ROWS && col >= 0 && col < CHESS_COLS) {
              const piece = chessBoard[row][col];
              if (piece && piece.owner === 'enemy' && piece.type !== 'core') {
                chessBoard[row][col] = null;
                hit = true;
                chessMsg = 'ROCKET HIT ENEMY PIECE!';
              }
            }
          } else {
            cubes.forEach(c => {
              if (!c.destroyed && !c.isMine && Math.sqrt((r.x-c.x)**2 + (r.y-c.y)**2) < 100) {
                hitCube(c); hit = true;
              }
            });
          }
          if (hit) { createParticles(r.x, r.y, '#ff1a24'); rockets.splice(i, 1); shake = Math.max(shake, 8); return; }
          if (levelType === 'boss' && Math.sqrt((r.x-bossX)**2 + (r.y-bossY)**2) < 200) {
            bossHealth -= 5; shake = 15; glitchFrames = 5; createParticles(r.x, r.y, COLOR_MINE); rockets.splice(i, 1);
            if (bossHealth <= 0) endLevel("BOSS ELIMINATED", true);
          }
          if (r.y > H) rockets.splice(i, 1);
        });

        // Pixel Sparks — keep this very light in smooth mode.
        const ambientSparkChance = isTestingBossLevel ? 0.05 : ULTRA_SMOOTH_MODE ? 0.12 : 0.24;
        const sideSparkChance = isTestingBossLevel ? 0.02 : ULTRA_SMOOTH_MODE ? 0.05 : 0.1;
        if (Math.random() < ambientSparkChance) {
          pixelSparks.push({x:Math.random()*W,y:H+5,vx:(Math.random()-0.5)*6,vy:-Math.random()*7-2,life:Math.random()*0.6+0.3,color:`hsl(${Math.floor(tick*60)%360},100%,70%)`,size:Math.random()*2.5+0.5});
        }
        if (Math.random() < sideSparkChance) {
          const side = Math.random()<0.5 ? 0 : W;
          pixelSparks.push({x:side,y:Math.random()*H,vx:(side===0?1:-1)*Math.random()*6,vy:(Math.random()-0.5)*4,life:Math.random()*0.4+0.2,color:`hsl(${Math.floor(tick*40)%360},100%,60%)`,size:Math.random()*2+1});
        }
        pixelSparks.forEach((s, i) => {
          s.x += s.vx * (deltaTime/16);
          s.y += s.vy * (deltaTime/16);
          s.vy -= 0.05 * (deltaTime/16); // slight upward drift
          s.life -= 0.02 * (deltaTime/16);
          if (s.life <= 0 || s.y < -10) { pixelSparks.splice(i, 1); return; }
          ctx.fillStyle = s.color;
          ctx.globalAlpha = s.life;
          ctx.fillRect(s.x, s.y, s.size, s.size);
          ctx.globalAlpha = 1;
        });

        // Particles (cube explosions)
        particles.forEach((p, i) => {
          p.x += p.vx * (deltaTime/16); p.y += p.vy * (deltaTime/16); p.life -= 0.03 * (deltaTime/16);
          if (p.life <= 0) particles.splice(i, 1);
          else {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillRect(p.x, p.y, 3, 3);
            ctx.globalAlpha = 1;
          }
        });

        // ── BOSS PHASE SYSTEM ──
        if (levelType === 'boss') {
           // Phase transitions based on health
           const bossHealthRatio = bossHealth / Math.max(1, bossMaxHealth);
           const newPhase = bossHealthRatio > 0.66 ? 1 : bossHealthRatio > 0.33 ? 2 : 3;
           if (newPhase > bossPhase) {
             bossPhase = newPhase;
             shake = 30; glitchFrames = 20;
             spawnText(bossPhase === 2 ? `${bossProfile.name}: PHASE 2` : `${bossProfile.name}: PHASE 3`, W/2, H/2, bossProfile.color, 50);
             flashes.push({life:1, color:bossProfile.color});
             const phaseBurstSparks = isTestingBossLevel ? 18 : ULTRA_SMOOTH_MODE ? 32 : 60;
             for (let i = 0; i < phaseBurstSparks; i++) pixelSparks.push({x:bossX,y:bossY,vx:(Math.random()-0.5)*200,vy:(Math.random()-0.5)*200,life:1,color:bossProfile.color,size:4});
           }

           if (bossY < 150) bossY += 2 * (deltaTime/16);
           if (bossPhase >= 2) {
             bossVx += Math.sin(tick * 1.5) * 0.4;
             bossVx *= 0.95;
             bossX += bossVx * (deltaTime/16);
             bossX = Math.max(W*0.25, Math.min(W*0.75, bossX));
           }
           if (bossPhase === 3 && Math.floor(tick*30) % 90 === 0 && mouse.x > 0) {
             bossVx += (mouse.x > bossX ? 1 : -1) * 5;
             spawnText('DASH!', bossX, bossY + 60, COLOR_MINE, 24);
             shake = 15;
           }

           const usesLaser = ['laser', 'split', 'omega', 'chaos'].includes(bossProfile.pattern);

           // Boss laser sweep (profile-specific)
           bossLaserTimer -= deltaTime;
           if (bossLaserTimer <= 0 && bossPhase >= 2 && usesLaser) {
             bossLaserTimer = bossPhase === 3 ? 3000 : 5000;
             bossLaserActive = true;
             bossLaserAngle = -0.5;
             spawnText('LASER SWEEP!', bossX, bossY + 80, bossProfile.accent, 30);
             shake = 10;
           }
           if (bossLaserActive) {
             bossLaserAngle += 0.015 * (deltaTime/16) * (bossPhase === 3 ? 1.8 : 1);
             const lx2 = bossX + Math.cos(bossLaserAngle) * W;
             const ly2 = bossY + Math.sin(bossLaserAngle) * H;
             ctx.save();
             ctx.strokeStyle = bossProfile.accent; ctx.lineWidth = 4;
             ctx.shadowColor = bossProfile.accent; ctx.shadowBlur = 20;
             ctx.beginPath(); ctx.moveTo(bossX, bossY); ctx.lineTo(lx2, ly2); ctx.stroke();
             ctx.restore();
             // Pixel sparks along laser
             const laserSparkCount = isTestingBossLevel ? 1 : 3;
             for (let i = 0; i < laserSparkCount; i++) {
               const t=Math.random(); pixelSparks.push({x:bossX+Math.cos(bossLaserAngle)*t*W*0.8,y:bossY+Math.sin(bossLaserAngle)*t*H*0.8,vx:(Math.random()-0.5)*20,vy:(Math.random()-0.5)*20,life:0.4,color:bossProfile.accent,size:3});
             }
             if (mouse.x > 0) {
               const dx=mouse.x-bossX; const dy=mouse.y-bossY;
               const mouseAngle=Math.atan2(dy,dx);
               if (Math.abs(bossLaserAngle-mouseAngle)<0.08) {
                 if (!absorbHazard('LASER HIT', mouse.x, mouse.y, { boss: true })) endLevel('LASER HIT',false);
               }
             }
             if (bossLaserAngle > 0.5) bossLaserActive = false;
           }

           const bossClock = Math.floor(tick * 30);
           if (bossY > 50 && mouse.x > 0) {
             if ((bossProfile.pattern === 'meteor' || bossProfile.pattern === 'omega' || bossProfile.pattern === 'chaos') && bossClock % (bossPhase === 3 ? 38 : 58) === 0) {
               const meteorCount = isTestingBossLevel ? Math.min(2, bossPhase + 1) : bossPhase + 2;
               for (let i = 0; i < meteorCount; i++) {
                 const sx = Math.random() * W;
                 bossRockets.push({ x: sx, y: -50, vx: (mouse.x - sx) * 0.012, vy: 7 + bossPhase * 1.3, life: 1.8, color: bossProfile.color, kind: 'meteor' });
               }
               spawnText('METEOR RAIN', W/2, 110, bossProfile.color, 24);
             }

             if ((bossProfile.pattern === 'ring' || bossProfile.pattern === 'omega' || bossProfile.pattern === 'chaos') && bossClock % (bossPhase === 3 ? 82 : 118) === 0) {
               const count = isTestingBossLevel ? (bossPhase === 3 ? 8 : 6) : (bossPhase === 3 ? 14 : 9);
               for (let i = 0; i < count; i++) {
                 const a = (Math.PI * 2 * i) / count;
                 const spd = 4.2 + bossPhase;
                 bossRockets.push({ x: bossX, y: bossY + 45, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 1.2, color: bossProfile.color, kind: 'ring' });
               }
               spawnText('VOID RING', bossX, bossY + 92, bossProfile.color, 24);
             }

             if ((bossProfile.pattern === 'split' || bossProfile.pattern === 'omega' || bossProfile.pattern === 'chaos') && bossClock % (bossPhase === 3 ? 64 : 92) === 0) {
               const y = Math.max(80, Math.min(H - 80, mouse.y));
               bossRockets.push({ x: -60, y, vx: 7 + bossPhase, vy: 0, life: 1.2, color: bossProfile.color, kind: 'mirror' });
               bossRockets.push({ x: W + 60, y: H - y, vx: -(7 + bossPhase), vy: 0, life: 1.2, color: bossProfile.accent, kind: 'mirror' });
               spawnText('MIRROR SHOT', W/2, H/2 + 90, bossProfile.accent, 22);
             }
           }

           // Boss fires — more rockets in higher phases
           const fireInterval = bossPhase === 3 ? 35 : bossPhase === 2 ? 50 : 60;
           if (Math.floor(tick * 30) % fireInterval === 0 && bossY > 50 && mouse.x > 0) {
             const angle = Math.atan2(mouse.y - bossY, mouse.x - bossX);
             const spd = 5 + bossPhase * 2 + levelInSector * 0.5;
             const spread = isTestingBossLevel
               ? (bossProfile.pattern === 'laser' ? 2 : bossPhase === 3 ? 3 : 2)
               : (bossProfile.pattern === 'laser' ? 2 + bossPhase : bossPhase === 3 ? 5 : bossPhase === 2 ? 3 : 3);
             for(let i=0;i<spread;i++) {
               const a = angle + (i - Math.floor(spread/2)) * 0.25;
               bossRockets.push({ x: bossX+(Math.random()-0.5)*200, y: bossY+100, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, life: 1.5, color: bossProfile.color });
             }
           }

           const hpRatio = Math.max(0, Math.min(1, bossHealth / Math.max(1, bossMaxHealth)));
           const hpColor = hpRatio > 0.66 ? bossProfile.color : hpRatio > 0.33 ? bossProfile.accent : COLOR_MINE;

           // Draw classic boss body.
           ctx.save();
           const bossGlow = 20 + bossPhase * 15 + Math.sin(tick * 4) * 10;
           ctx.shadowColor = bossProfile.color; ctx.shadowBlur = bossGlow;
           ctx.fillStyle = '#0a0a0a';
           ctx.strokeStyle = bossPhase === 3 ? bossProfile.accent : bossProfile.color;
           ctx.lineWidth = bossPhase >= 2 ? 3 : 2;
           ctx.fillRect(bossX - 200, bossY - 100, 400, 200);
           ctx.strokeRect(bossX - 200, bossY - 100, 400, 200);
           if (bossPhase === 3) {
             ctx.strokeStyle = bossProfile.accent + '88';
             ctx.strokeRect(bossX-180, bossY-80, 360, 160);
           }
           ctx.shadowBlur = 0;
           ctx.restore();

           const gridAlpha = 0.1 + Math.sin(tick*(4+bossPhase))*0.05;
           ctx.strokeStyle = bossProfile.color + Math.floor(gridAlpha * 255).toString(16).padStart(2, '0');
           for(let i=bossX-200;i<bossX+200;i+=20) {
             ctx.beginPath();ctx.moveTo(i,bossY-100);ctx.lineTo(i,bossY+100);ctx.stroke();
           }

           ctx.fillStyle='#1a0000';ctx.fillRect(bossX-180,bossY+110,360,8);
           ctx.fillStyle=hpColor;ctx.shadowColor=hpColor;ctx.shadowBlur=10;
           ctx.fillRect(bossX-180,bossY+110,360 * hpRatio,8);
           ctx.shadowBlur=0;

           ctx.fillStyle='#fff';ctx.font='22px Orbitron';ctx.textAlign='center';
           ctx.fillText(bossProfile.name,bossX,bossY+10);
           ctx.font='11px Rajdhani';ctx.fillStyle=hpColor;
           ctx.fillText(`PHASE ${bossPhase} · HP ${Math.ceil(bossHealth)}`,bossX,bossY+32);
        }

        // Boss rockets — dodge these!
        bossRockets.forEach((br, i) => {
          const projectileDt = slowMo > 0 && skill.timewarp2 ? 0 : dt;
          br.x += br.vx * projectileDt * (deltaTime/16);
          br.y += br.vy * projectileDt * (deltaTime/16);
          br.life -= 0.005 * (deltaTime/16);
          
          const rocketColor = br.color || '#ff003c';
          const ang = Math.atan2(br.vy, br.vx);
          if (!drawGameSpriteRect("interceptorMissile", br.x, br.y, 64, 26, ang - Math.PI, rocketColor)) {
            ctx.save();
            ctx.shadowColor = rocketColor; ctx.shadowBlur = 20;
            ctx.fillStyle = rocketColor;
            ctx.translate(br.x, br.y);
            ctx.rotate(ang);
            ctx.fillRect(-15, -3, 30, 6);
            ctx.fillStyle = '#ff8800';
            ctx.fillRect(15, -3, 8, 6);
            ctx.restore();
          }
          
          if (!ULTRA_SMOOTH_MODE || !isTestingBossLevel || Math.random() < 0.3) {
            pixelSparks.push({x:br.x,y:br.y,vx:(Math.random()-0.5)*5,vy:(Math.random()-0.5)*5,life:0.5,color:rocketColor,size:2});
          }
          
          // Hit player cursor (danger zone around mouse)
          const distToPlayer = Math.sqrt((br.x - mouse.x)**2 + (br.y - mouse.y)**2);
          if (distToPlayer < 30 && mouse.x > 0) {
            if (!absorbHazard('BOSS ROCKET HIT', mouse.x, mouse.y, { boss: true })) {
              endLevel('BOSS ROCKET HIT', false);
            }
            bossRockets.splice(i, 1);
            return;
          }
          if (br.life <= 0 || br.x < -100 || br.x > W+100 || br.y > H+100) bossRockets.splice(i, 1);
        });

        // GD-style hazard beams
        const inRunnerMode = levelType === "gd" || levelType === "operative";
        const beamCap = (gdModifierType === "laserstorm" || gdMiniBossActive) ? 3 : 1;
        const beamCadence = gdModifierType === "laserstorm" ? 68 : 280;
        if (levelType !== 'boss' && hazardBeams.length < beamCap && Math.floor(tick * 30) % beamCadence === 0 && currentLevel > 3) {
          const gdTop = H * 0.1 + 28;
          const gdBottom = H * 0.75 - 28;
          const minY = inRunnerMode ? gdTop : 80;
          const maxY = inRunnerMode ? gdBottom : H - 80;
          const maxLife = (gdModifierType === "laserstorm" ? 112 : 150) * neonWarningMul;
          hazardBeams.push({ y: minY + Math.random() * Math.max(20, maxY - minY), life: maxLife, maxLife, storm: gdModifierType === "laserstorm" });
        }
        hazardBeams.forEach((b, i) => {
          b.life -= deltaTime/16;
          const progress = 1 - b.life / b.maxLife;
          if (b.life <= 0) { hazardBeams.splice(i, 1); return; }
          
          if (progress < 0.3) {
            // Warning phase — flashing line
            if (Math.floor(b.life / 4) % 2 === 0) {
              ctx.strokeStyle = `rgba(255,200,0,0.5)`; ctx.lineWidth = 2;
              ctx.setLineDash([10, 10]);
              ctx.beginPath(); ctx.moveTo(0, b.y); ctx.lineTo(W, b.y); ctx.stroke();
              ctx.setLineDash([]);
            }
          } else if (progress < 0.7) {
            // Active beam — DANGER
            ctx.save();
            ctx.shadowColor = COLOR_MINE; ctx.shadowBlur = 20;
            ctx.strokeStyle = COLOR_MINE; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(0, b.y); ctx.lineTo(W, b.y); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
            // Check if player is in beam
            if (inRunnerMode) {
              if (!gdPlayer.dead && gdInvulnTimer <= 0 && Math.abs(gdPlayer.y - b.y) < gdPlayer.size * 0.42) {
                if (giantModeTimer > 0) {
                  const smash = awardPoints(140);
                  spawnText(`BEAM CRUSH +${smash}`, gdPlayer.x + 50, b.y - 14, "#ffcf66", 16);
                  hazardBeams.splice(i, 1);
                  return;
                }
                if (absorbHazard('BEAM HIT', gdPlayer.x, gdPlayer.y, { racing: true })) {
                  hazardBeams.splice(i, 1);
                } else if (tryGdPracticeRespawn("BEAM HIT", gdPlayer.x, gdPlayer.y, COLOR_MINE)) {
                  hazardBeams.splice(i, 1);
                } else {
                  endLevel('BEAM HIT', false);
                }
              }
            } else if (Math.abs(mouse.y - b.y) < 15 && mouse.x > 0) {
              if (!absorbHazard('BEAM HIT', mouse.x, mouse.y)) endLevel('BEAM HIT', false);
              else hazardBeams.splice(i, 1);
            }
          } else {
            // Fade out
            ctx.strokeStyle = `rgba(255,0,60,${(1-progress)*0.5})`; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0, b.y); ctx.lineTo(W, b.y); ctx.stroke();
          }
        });

        // Chaos Frenzy Power-Up
        if (chaosFrenzyTimer > 0) {
          chaosFrenzyTimer -= deltaTime/16;
          // Insane spawn rate from all directions
          if (Math.random() < 0.6) {
            const sides = ['bottom','left','right','rain','diagonal_left','diagonal_right','zigzag'];
            cubes.push(createCube(false, 'ninja', 0, 0, Math.random() < 0.3, sides[Math.floor(Math.random() * sides.length)]));
          }
          if (Math.random() < 0.1) glitchFrames = 2; // subtle continuous glitch
        }

        // Magnet — pulls cubes toward mouse and destroys them
        if (magnetActive > 0) {
          magnetActive -= deltaTime/16;
          cubes.forEach(c => {
            if (!c.destroyed && !c.isMine && mouse.x > 0) {
              const dx = mouse.x - c.x; const dy = mouse.y - c.y;
              const dist = Math.sqrt(dx*dx+dy*dy);
              if (dist < 300) {
                c.vx += (dx/dist) * 8;
                c.vy += (dy/dist) * 8;
                if (dist < 60) hitCube(c);
              }
            }
          });
          // Draw magnet aura
          ctx.save();
          ctx.strokeStyle = `rgba(255,136,255,${0.3 + Math.sin(tick*10)*0.2})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 300, 0, Math.PI*2); ctx.stroke();
          ctx.restore();
        }

        // Shield aura around cursor
        if (shieldActive) {
          ctx.save();
          ctx.strokeStyle = `rgba(0,170,255,${0.4 + Math.sin(tick*8)*0.2})`;
          ctx.lineWidth = 3;
          ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 15;
          ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 45, 0, Math.PI*2); ctx.stroke();
          ctx.restore();
        }

        if (slowMo > 0) {
          ctx.save();
          ctx.globalAlpha = 0.08 + Math.sin(tick * 12) * 0.035;
          ctx.fillStyle = '#e8fbff';
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(210,250,255,0.22)';
          ctx.lineWidth = 1;
          for (let y = (tick * 40) % 42; y < H; y += 42) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y + Math.sin(tick + y) * 8);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Cubes
        const CW = 80, CH = 40, CD = 50;
        for (let i = cubes.length - 1; i >= 0; i--) {
          const c = cubes[i];
          if (!c.destroyed) {
            c.x += c.vx * dt * (deltaTime/16);
            c.y += c.vy * dt * (deltaTime/16);
            c.vy += c.gravity * dt * (deltaTime/16);
            
            if (c.y > H + 200 || c.x < -200 || c.x > W + 200) {
              if (!c.isMine && levelType !== 'chaos_bonus' && levelType !== 'chaos_intro') combo = 0;
              cubes.splice(i, 1);
              continue;
            }
          } else {
            c.explodeT += 0.1 * dt * (deltaTime/16);
            if (c.explodeT > 1) { cubes.splice(i, 1); continue; }
          }
          
          const ty = c.y - c.explodeT * 50;
          const lx = c.x - c.explodeT * 40;
          const rx = c.x + c.explodeT * 40;
          
          const top = [{x:c.x, y:ty-CH/2}, {x:c.x+CW/2, y:ty}, {x:c.x, y:ty+CH/2}, {x:c.x-CW/2, y:ty}];
          const left = [{x:lx-CW/2, y:c.y}, {x:lx, y:c.y+CH/2}, {x:lx, y:c.y+CH/2+CD}, {x:lx-CW/2, y:c.y+CD}];
          const right = [{x:rx, y:c.y+CH/2}, {x:rx+CW/2, y:c.y}, {x:rx+CW/2, y:c.y+CD}, {x:rx, y:c.y+CH/2+CD}];
          
          ctx.globalAlpha = 1 - c.explodeT;
          const cubeSprite = c.isMine ? "hazardMine" : c.isGold ? "energyReactor" : "dataCore";
          const cubeGlow = c.isMine ? COLOR_MINE : c.isGold ? COLOR_GOLD : c.color;
          const cubeSize = c.isMine ? 104 : c.isGold ? 100 : 94;
          const spriteDrawn = drawGameSprite(
            cubeSprite,
            c.x,
            c.y + 20 - c.explodeT * 26,
            cubeSize,
            tick * (c.isMine ? 0.14 : 0.2) + i * 0.035,
            cubeGlow,
            1 - c.explodeT,
          );

          if (!spriteDrawn) {
            poly(left, c.isMine ? '#1a0000' : '#111111', c.color);
            poly(right, c.isMine ? '#330000' : '#222222', c.color);
            poly(top, c.destroyed ? '#fff' : (c.isMine ? '#440000' : '#333333'), c.color);
          }
          ctx.globalAlpha = 1;
        }

        // PowerUps
        const POWER_COLORS: Record<string, string> = {
          slow: '#00f2ff',
          freeze: '#bff7ff',
          multi: '#ffd700',
          auto: '#00ff88',
          rocket: '#ff1a24',
          magnet: '#ff88ff',
          shield: '#00aaff',
          chaos: '#ff00ff',
          quake: '#ffffff',
          whiteout: '#ffffff',
          void: '#bc13fe',
          giant: '#ffcf66',
          bomb: '#ffd700',
          material: '#9ff4ff',
        };
        powerUps.forEach((p, i) => {
          if (!p.destroyed) {
            p.x += p.vx * dt * (deltaTime/16); p.y += p.vy * dt * (deltaTime/16); p.vy += p.gravity * dt * (deltaTime/16);
            const matId = p.materialId as MaterialId | undefined;
            const matMeta = matId ? MATERIALS_BY_ID[matId] : undefined;
            const col = p.type === "material" ? (matMeta?.color ?? "#9ff4ff") : (POWER_COLORS[p.type] || '#fff');
            const spriteKey: GameSpriteKey = p.type === "freeze" || p.type === "slow"
              ? "timeCrystal"
              : p.type === "shield"
                ? "shieldModule"
                : p.type === "material"
                  ? "dataCore"
                  : "energyReactor";
            const pulseSize = 61 + Math.sin(tick * 4 + i) * 3;
            if (!drawGameSprite(spriteKey, p.x, p.y, pulseSize, Math.sin(tick + i) * 0.05, col)) {
              ctx.shadowColor = col; ctx.shadowBlur = 20;
              ctx.beginPath(); ctx.arc(p.x, p.y, 25, 0, Math.PI*2);
              ctx.fillStyle = col; ctx.fill();
              ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
              ctx.shadowBlur = 0;
            }
            if (p.y > H + 100) powerUps.splice(i, 1);
          } else powerUps.splice(i, 1);
        });

        // Flashes
        flashes.forEach((f, i) => {
           f.life -= 0.05 * (deltaTime/16);
           if (f.life <= 0) flashes.splice(i, 1);
           else {
             ctx.fillStyle = f.color;
             ctx.globalAlpha = f.life * (f.intensity ?? 0.3);
             ctx.fillRect(0, 0, W, H);
             ctx.globalAlpha = 1;
           }
        });

        // Floating Texts
        floatingTexts.forEach((t, i) => {
          t.y += t.vy * (deltaTime/16);
          t.life -= 0.02 * (deltaTime/16);
          if (t.life <= 0) floatingTexts.splice(i, 1);
          else {
            ctx.globalAlpha = t.life;
            ctx.fillStyle = t.color;
            ctx.font = `${t.size}px Orbitron`;
            ctx.textAlign = 'center';
            ctx.fillText(t.text, t.x, t.y);
            ctx.globalAlpha = 1;
          }
        });

        capArray(pixelSparks, isTestingBossLevel ? 70 : ULTRA_SMOOTH_MODE ? 130 : 320);
        capArray(particles, isTestingBossLevel ? 50 : ULTRA_SMOOTH_MODE ? 95 : 220);
        capArray(floatingTexts, ULTRA_SMOOTH_MODE ? 18 : 26);
        capArray(flashes, ULTRA_SMOOTH_MODE ? 5 : 8);
        capArray(cubes, ULTRA_SMOOTH_MODE ? 56 : 80);
        capArray(powerUps, 6);
        capArray(rockets, ULTRA_SMOOTH_MODE ? 20 : 32);
        capArray(bossRockets, isTestingBossLevel ? 16 : ULTRA_SMOOTH_MODE ? 24 : 44);
        capArray(gdObstacles, ULTRA_SMOOTH_MODE ? 240 : 300);
        capArray(snailShots, ULTRA_SMOOTH_MODE ? 18 : 24);

        const intel = getLevelIntel(currentLevel, levelInSector);
        const modeLabel =
          levelType === "operative" ? "OPERATIVE RUN" :
          levelType === "gd" ? "GD RUN" :
          levelType === "snail" ? "VERTICAL SHOOTER" :
          levelType === "chaos_intro" ? "CHAOS INTRO" :
          levelType === "chaos_bonus" ? "CHAOS BONUS" :
          levelType === "boss" ? "BOSS ASSAULT" :
          levelType.toUpperCase();

        const progressBase = Math.min(1, targetsDestroyed / Math.max(1, targetsNeeded));
        const progressByTime =
          levelType === "static" || levelType === "chaos_bonus" || levelType === "chaos_intro" || levelType === "operative"
            ? 1 - Math.max(0, timeRemaining) / (levelType === "operative" ? 60 : levelType === "chaos_intro" ? 38 : 20)
            : progressBase;
        const bossProgress = levelType === "boss" ? 1 - Math.max(0, bossHealth) / Math.max(1, bossMaxHealth) : 0;
        const progress = levelType === "boss" ? Math.max(0, Math.min(1, bossProgress)) : Math.max(progressBase, Math.min(1, progressByTime));

        const powerState =
          giantModeTimer > 0 ? { label: "TITAN FORM", progress: Math.min(1, giantModeTimer / getGiantDuration()) } :
          slowMo > 0 ? { label: "TIME FREEZE", progress: Math.min(1, slowMo / (getSlowDuration() + 40)) } :
          autoSlicer > 0 ? { label: "AUTO SLICER", progress: Math.min(1, autoSlicer / getAutoDuration()) } :
          multiScore > 0 ? { label: "SCORE x2", progress: Math.min(1, multiScore / 400) } :
          (powerCooldowns.giant ?? 0) > 0 ? { label: "TITAN CD", progress: Math.min(1, (powerCooldowns.giant ?? 0) / POWER_COOLDOWN_FRAMES.giant) } :
          (powerCooldowns.freeze ?? 0) > 0 ? { label: "FREEZE CD", progress: Math.min(1, (powerCooldowns.freeze ?? 0) / POWER_COOLDOWN_FRAMES.freeze) } :
          (powerCooldowns.slow ?? 0) > 0 ? { label: "WARP CD", progress: Math.min(1, (powerCooldowns.slow ?? 0) / POWER_COOLDOWN_FRAMES.slow) } :
          { label: "READY", progress: 0 };

        const modifierLabel =
          gdModifierType === "laserstorm" ? "LASER STORM" : "NONE";
        const modifierProgress = gdModifierTimer > 0 ? Math.min(1, gdModifierTimer / (gdModifierType === "laserstorm" ? 200 : 230)) : 0;
        const runnerSection = GD_SECTION_LABELS[Math.max(0, Math.min(3, gdSectionIndex))];
        const runnerMode = levelType === "gd" || levelType === "operative";
        const checkpointLabel = runnerMode ? (gdPracticeMode ? (gdCheckpointReady ? "READY" : "USED") : "OFF") : "OFF";
        const rankLabel = runnerMode ? (gdBestRank ?? "-") : "-";

        const objectiveLines =
          levelType === "boss" && isTestingBossLevel
            ? [
                "Classic boss pattern enabled.",
                "Dodge volleys and laser sweeps.",
                "Burn through boss HP to clear.",
              ]
            : levelType === "operative"
            ? [
                `Survive 60s: ${Math.max(0, timeRemaining).toFixed(1)}s`,
                `Energy Cores: ${targetsDestroyed}/${targetsNeeded}`,
                `Section: ${runnerSection} · Modifier: ${modifierLabel}`,
                `Checkpoint: ${checkpointLabel} · Laser Clean: ${laserContactCount === 0 ? "YES" : "NO"}`,
              ]
            : levelType === "gd"
            ? [
                `Section: ${runnerSection}`,
                `Modifier: ${modifierLabel}`,
                `Practice Checkpoint: ${checkpointLabel}`,
                `Best Rank: ${rankLabel}`,
              ]
            : intel.objectives.slice(0, 3);

        const hudCommitInterval = ULTRA_SMOOTH_MODE ? 180 : 120;
        if (time - lastHudCommit > hudCommitInterval) {
          setHud({
            score: sessionScore,
            combo,
            lives: levelLives,
            levelLabel: `${planet.name} | L${currentLevel.toString().padStart(2, "0")}`,
            modeLabel,
            targetLabel:
              levelType === "boss"
                ? `${bossProfile.name} · PHASE ${bossPhase}`
                : levelType === "chaos_intro" || levelType === "chaos_bonus"
                ? `${Math.max(0, timeRemaining).toFixed(1)}s · ${targetsDestroyed}/${targetsNeeded}`
                : levelType === "operative"
                ? `${targetsDestroyed}/${targetsNeeded} cores`
                : `${targetsDestroyed}/${targetsNeeded}`,
            progress,
            powerLabel: powerState.label,
            powerProgress: powerState.progress,
            sectionLabel: levelType === "boss" ? `PHASE ${bossPhase}` : runnerSection,
            modifierLabel,
            modifierProgress,
            checkpointLabel,
            bestRankLabel: rankLabel,
            objectives: objectiveLines,
            bossActive: levelType === "boss",
            bossPhase,
            bossHealth,
            bossName: bossProfile.name,
            bossColor: bossProfile.color,
            eyeX: eyeCore.x,
            eyeY: eyeCore.y,
            eyeScale: 1 + eyeCore.pulse * 0.2 + eyeCore.burst * 0.26,
            eyeActive: eyeCore.reveal > 0.02,
            lightningActive: lightningTimer > 0,
            lightningHue,
            lightningIntensity,
            lightningSpeed,
            lightningSize,
            lightningXOffset,
            isTestingBoss: isTestingBossLevel && levelType === "boss",
          });
          lastHudCommit = time;
        }

      }

      ctx.restore();
      
      // Auto-slicer logic and movement logic
      if (active && (mouse.x !== mouse.px || mouse.y !== mouse.py || autoSlicer > 0)) {
        checkCollisions(mouse.x, mouse.y);
      }
      mouse.px = mouse.x;
      mouse.py = mouse.y;

      // --- CURSOR RENDERING & LOGIC ---
      if (mouse.x !== -9999) {
        ctx.save();
        const simpleBossCursor = ULTRA_SMOOTH_MODE && levelType === 'boss';

        if (simpleBossCursor) {
          // Hard performance mode for boss fights: lightweight crosshair only.
          cursorTrail.length = 0;
          cursorParticles.length = 0;
          const cx = mouse.x;
          const cy = mouse.y;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx - 14, cy);
          ctx.lineTo(cx - 4, cy);
          ctx.moveTo(cx + 4, cy);
          ctx.lineTo(cx + 14, cy);
          ctx.moveTo(cx, cy - 14);
          ctx.lineTo(cx, cy - 4);
          ctx.moveTo(cx, cy + 4);
          ctx.lineTo(cx, cy + 14);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return;
        }

        const operatorCursorMode = levelType === 'ninja' || levelType === 'static' || levelType === 'chaos_intro' || levelType === 'chaos_bonus';
        if (operatorCursorMode) {
          const operatorHeight = Math.max(78, Math.min(98, H * 0.11));
          drawOperatorSprite(
            mouse.x,
            mouse.y + operatorHeight * 0.12,
            operatorHeight * 0.76,
            operatorHeight,
            Math.sin(tick * 3.2) * 0.025,
            false,
            hero.accent,
            0.96,
          );
        }
        
        // 1. Trail Logic
        if (activeCursor.type === 'trail' || activeCursor.type === 'data') {
          cursorTrail.push({ x: mouse.x, y: mouse.y, life: 1.0 });
        }
        cursorTrail = cursorTrail.filter(t => {
          t.life -= 0.05;
          return t.life > 0;
        });

        // Draw Trail
        cursorTrail.forEach(t => {
          ctx.globalAlpha = t.life * 0.5;
          if (t.isRing) {
            ctx.strokeStyle = activeCursor.color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(t.x, t.y, t.size * (2-t.life), 0, Math.PI*2); ctx.stroke();
          } else if (t.isGhost) {
            ctx.fillStyle = activeCursor.color;
            ctx.beginPath(); ctx.moveTo(t.x, t.y-8); ctx.lineTo(t.x+8, t.y+8); ctx.lineTo(t.x-8, t.y+8); ctx.closePath(); ctx.fill();
          } else if (t.isData || activeCursor.type === 'data') {
            ctx.fillStyle = activeCursor.color;
            ctx.font = '10px monospace';
            ctx.fillText(Math.random() > 0.5 ? '1' : '0', t.x, t.y + (1-t.life)*50);
          } else if (activeCursor.type === 'trail') {
            ctx.strokeStyle = activeCursor.color;
            ctx.strokeRect(t.x - 10, t.y - 10, 20, 20);
          }
        });
        ctx.globalAlpha = 1;

        // 2. Particle Logic
        cursorParticles = cursorParticles.filter(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.02;
          return p.life > 0;
        });
        cursorParticles.forEach(p => {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          if (p.isSlash) {
            ctx.lineWidth = p.size; ctx.strokeStyle = p.color;
            ctx.beginPath(); ctx.moveTo(p.x - 20*p.life, p.y); ctx.lineTo(p.x + 20*p.life, p.y); ctx.stroke();
          } else if (p.isFire) {
            ctx.shadowBlur = 10; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
          } else if (p.isStar) {
            const s = p.size * p.life;
            ctx.beginPath(); ctx.moveTo(p.x, p.y-s); ctx.lineTo(p.x+s, p.y); ctx.lineTo(p.x, p.y+s); ctx.lineTo(p.x-s, p.y); ctx.closePath(); ctx.fill();
          } else if (p.isPixel) ctx.fillRect(p.x, p.y, p.size, p.size);
          else {
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
          }
        });
        ctx.globalAlpha = 1;

        // 3. Main Cursor Body & Core FX
        const cx = mouse.x, cy = mouse.y;
        
        // --- UNIVERSAL CORE ---
        // Every cursor gets a bright white center so it's NEVER lost
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffffff';
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0; // reset for specific drawing
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();
        
        if (activeCursor.type === 'glow') {
          const pulse = 1 + Math.sin(tick * 0.15) * 0.3;
          ctx.shadowColor = activeCursor.color;
          ctx.shadowBlur = 20 * pulse;
          ctx.strokeStyle = activeCursor.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(cx - 15 * pulse, cy); ctx.lineTo(cx - 5, cy);
          ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 15 * pulse, cy);
          ctx.moveTo(cx, cy - 15 * pulse); ctx.lineTo(cx, cy - 5);
          ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 15 * pulse);
          ctx.stroke();
        } else if (activeCursor.type === 'particles') {
          ctx.fillStyle = activeCursor.color;
          ctx.shadowColor = activeCursor.color;
          ctx.shadowBlur = 10;
          for(let i=0; i<4; i++) {
             const angle = (tick * 0.05) + (i * Math.PI/2);
             ctx.fillRect(cx + Math.cos(angle)*12 - 2, cy + Math.sin(angle)*12 - 2, 4, 4);
          }
          ctx.strokeStyle = activeCursor.color;
          ctx.lineWidth = 1;
          ctx.strokeRect(cx - 6, cy - 6, 12, 12);
        } else if (activeCursor.type === 'trail') {
          ctx.strokeStyle = activeCursor.color;
          ctx.lineWidth = 2;
          ctx.shadowColor = activeCursor.color;
          ctx.shadowBlur = 15;
          ctx.beginPath(); ctx.moveTo(cx, cy-8); ctx.lineTo(cx+8, cy+8); ctx.lineTo(cx-8, cy+8); ctx.closePath(); ctx.stroke();
        } else if (activeCursor.type === 'sharp') {
          ctx.strokeStyle = activeCursor.color;
          ctx.shadowColor = activeCursor.color;
          ctx.shadowBlur = 15;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx, cy-4); ctx.lineTo(cx+20, cy+20); ctx.lineTo(cx-4, cy); ctx.closePath(); ctx.stroke();
          ctx.fillStyle = activeCursor.color + '44'; ctx.fill();
        } else if (activeCursor.type === 'fluid') {
          mercuryMorph += 0.15;
          ctx.fillStyle = activeCursor.color + 'aa';
          ctx.shadowColor = activeCursor.color;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          for(let i=0; i<8; i++) {
            const a = (i/8)*Math.PI*2;
            const r = 8 + Math.sin(mercuryMorph + i) * 4;
            ctx.lineTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r);
          }
          ctx.closePath(); ctx.fill();
        } else if (activeCursor.type === 'data') {
          ctx.fillStyle = activeCursor.color;
          ctx.font = '14px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = activeCursor.color;
          ctx.shadowBlur = 10;
          ctx.fillText('<o>', cx, cy);
        } else if (activeCursor.type === 'flare') {
          for(let i=0; i<3; i++) {
            cursorParticles.push({
              x: cx + (Math.random()-0.5)*10, y: cy + (Math.random()-0.5)*10, 
              vx: (Math.random()-0.5)*1, vy: -Math.random()*4 - 1, 
              life: 1, color: activeCursor.color, size: Math.random()*4 + 2, isPixel: false
            });
          }
          ctx.fillStyle = activeCursor.color + '88';
          ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2); ctx.fill();
        } else if (activeCursor.type === 'glitch') {
          if (tick % 5 === 0) glitchTimer = 3;
          const offset = glitchTimer > 0 ? (Math.random()-0.5)*8 : 0;
          ctx.fillStyle = '#ff00ff'; ctx.fillRect(cx - 8 + offset, cy - 8 - offset, 16, 16);
          ctx.fillStyle = '#00ffff'; ctx.fillRect(cx - 8 - offset, cy - 8 + offset, 16, 16);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 6, cy - 6, 12, 12);
        } else if (activeCursor.type === 'void') {
          ctx.fillStyle = '#000000';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = activeCursor.color === '#000000' ? '#ffffff' : activeCursor.color;
          ctx.beginPath(); ctx.arc(cx, cy, 18, tick*0.1, tick*0.1 + Math.PI); ctx.stroke();
        } else if (activeCursor.type === 'dust') {
           if (tick % 2 === 0) {
             cursorParticles.push({
               x: cx + (Math.random()-0.5)*15, y: cy + (Math.random()-0.5)*15,
               vx: (Math.random()-0.5)*2, vy: Math.random()*2 + 1,
               life: 1, color: activeCursor.color, size: Math.random()*3 + 1, isPixel: true
             });
           }
           ctx.fillStyle = activeCursor.color;
           ctx.shadowColor = activeCursor.color;
           ctx.shadowBlur = 10;
           ctx.beginPath();
           ctx.moveTo(cx, cy-10); ctx.lineTo(cx+2, cy-2); ctx.lineTo(cx+10, cy); ctx.lineTo(cx+2, cy+2);
           ctx.lineTo(cx, cy+10); ctx.lineTo(cx-2, cy+2); ctx.lineTo(cx-10, cy); ctx.lineTo(cx-2, cy-2);
           ctx.closePath(); ctx.fill();
        } else {
          ctx.strokeStyle = activeCursor.color;
          ctx.lineWidth = 2;
          ctx.strokeRect(cx - 6, cy - 6, 12, 12);
        }

        ctx.restore();
      }
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      mouse.x = clientX;
      mouse.y = clientY;
    };

    // Click = Blast Shot (if skill unlocked) + GD jump
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (paused) return;
      if (levelType === 'gd' || levelType === 'operative') { gdJumpQueued = true; return; }
      const clientX = 'touches' in e ? (e as TouchEvent).changedTouches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).changedTouches[0].clientY : (e as MouseEvent).clientY;
      if (levelType === 'snail') {
        const { left, right } = getSnailBounds();
        snailPlayer.targetX = Math.max(left + 28, Math.min(right - 28, clientX));
        fireSnailShot();
        return;
      }
      if (ULTRA_SMOOTH_MODE && levelType === 'boss') {
        fireBlast(clientX, clientY);
        return;
      }

      // --- UNIQUE CURSOR CLICK BLASTS ---
      const cid = activeCursor.id;
      if (cid === 1) { // Neon Pulse: Expanding Rings
        for(let i=0; i<3; i++) {
          cursorTrail.push({ x: clientX, y: clientY, life: 1.0, isRing: true, size: 5 + i*15 });
        }
      } else if (cid === 2) { // Pixel Blast: Grid Fragments
        for(let i=0; i<15; i++) {
          cursorParticles.push({
            x: clientX, y: clientY,
            vx: (Math.random()-0.5)*20, vy: (Math.random()-0.5)*20,
            life: 1, color: activeCursor.color, size: 4 + Math.random()*6, isPixel: true
          });
        }
      } else if (cid === 3) { // Ghost Trail: Radiating Shadows
        for(let i=0; i<8; i++) {
          const a = (i/8)*Math.PI*2;
          cursorTrail.push({ x: clientX + Math.cos(a)*20, y: clientY + Math.sin(a)*20, life: 0.8, isGhost: true });
        }
      } else if (cid === 4) { // Cyber Blade: Sharp Slashes
        for(let i=0; i<3; i++) {
          cursorParticles.push({
            x: clientX, y: clientY, vx: (Math.random()-0.5)*40, vy: (Math.random()-0.5)*5,
            life: 0.5, color: '#ffffff', size: 2, isSlash: true
          });
        }
      } else if (cid === 5) { // Liquid Mercury: Splashes
        for(let i=0; i<12; i++) {
          cursorParticles.push({
            x: clientX, y: clientY, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12,
            life: 1, color: activeCursor.color, size: 3 + Math.random()*5, isFluid: true
          });
        }
      } else if (cid === 6) { // Data Stream: Binary Pop
        for(let i=0; i<10; i++) {
          cursorTrail.push({ x: clientX + (Math.random()-0.5)*40, y: clientY + (Math.random()-0.5)*40, life: 1, isData: true });
        }
      } else if (cid === 7) { // Solar Flare: Heatwave
        flashes.push({ life: 0.3, color: '#ff8800' });
        for(let i=0; i<20; i++) {
          cursorParticles.push({
            x: clientX, y: clientY, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15,
            life: 1, color: '#ff4400', size: 2 + Math.random()*8, isFire: true
          });
        }
      } else if (cid === 8) { // Glitch Bit: Distortion
        glitchFrames = 10;
        shake = Math.max(shake, 15);
      } else if (cid === 9) { // Void Walker: Implosion
        for(let i=0; i<20; i++) {
          const a = Math.random()*Math.PI*2;
          const r = 50 + Math.random()*50;
          cursorParticles.push({
            x: clientX + Math.cos(a)*r, y: clientY + Math.sin(a)*r,
            vx: -Math.cos(a)*4, vy: -Math.sin(a)*4,
            life: 1, color: '#ffffff', size: 2, isVoid: true
          });
        }
      } else if (cid === 10) { // Star Dust: Twinkle
        for(let i=0; i<15; i++) {
          cursorParticles.push({
            x: clientX, y: clientY, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
            life: 1.5, color: '#ffd700', size: 2 + Math.random()*3, isStar: true
          });
        }
      }

      // Chess click handling
      if (levelType === 'chess' && chessTurn === 'player') {
        const CELL = Math.min(W, H * 0.8) / CHESS_COLS;
        const BOARD_W = CELL * CHESS_COLS, BOARD_H = CELL * CHESS_ROWS;
        const bx = (W - BOARD_W) / 2, by = (H - BOARD_H) / 2 - 20;
        const col = Math.floor((clientX - bx) / CELL);
        const row = Math.floor((clientY - by) / CELL);
        if (row >= 0 && row < CHESS_ROWS && col >= 0 && col < CHESS_COLS) {
          if (chessSelected) {
            const isValid = chessValidMoves.some(m=>m.r===row&&m.c===col);
            if (isValid) {
              const captured = chessBoard[row][col];
              chessBoard[row][col] = chessBoard[chessSelected.r][chessSelected.c];
              chessBoard[chessSelected.r][chessSelected.c] = null;
              chessSelected = null; chessValidMoves = [];
              if (captured?.type === 'core') {
                shake=30; glitchFrames=15; chessMsg = 'ENEMY CORE DESTROYED — VICTORY!';
                createParticles(clientX, clientY, planet.color, 50);
                setTimeout(()=>endLevel('NEURAL CHESS: VICTORY',true),700);
              } else {
                chessTurn='enemy'; chessMsg='ENEMY THINKING...'; chessAIDelay=45;
              }
            } else {
              const piece = chessBoard[row][col];
              if (piece?.owner==='player') {
                chessSelected={r:row,c:col}; chessValidMoves=getChessMoves(chessBoard,row,col);
                chessMsg=`${piece.type.toUpperCase()} — click destination`;
              } else { chessSelected=null; chessValidMoves=[]; chessMsg='YOUR MOVE — click a piece'; }
            }
          } else {
            const piece = chessBoard[row][col];
            if (piece?.owner==='player') {
              chessSelected={r:row,c:col}; chessValidMoves=getChessMoves(chessBoard,row,col);
              chessMsg=`${piece.type.toUpperCase()} — click destination`;
            }
          }
        }
        return;
      }

      fireBlast(clientX, clientY);
    };
    window.addEventListener('click', handleClick);
    window.addEventListener('touchend', handleClick);

    // Q/E/R/F spell keys (only if corresponding skill purchased) + Space/↑ for GD jump
    const handleKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "escape" || k === "p") {
        paused = !paused;
        setIsPaused(paused);
        return;
      }
      if (paused) return;
      if (k === ' ' || k === 'arrowup' || k === 'w') {
        if (levelType === 'gd' || levelType === 'operative') { gdJumpQueued = true; e.preventDefault(); return; }
        if (levelType === 'snail') {
          if (k === ' ' || k === 'w' || k === 'arrowup') {
            fireSnailShot();
          }
          e.preventDefault();
          return;
        }
        if (skill.quantum && k === ' ') {
          autoSlicer = Math.max(autoSlicer, 45);
          fireShockwave(mouse.x > 0 ? mouse.x : W/2, mouse.y > 0 ? mouse.y : H/2, 180, 'QUANTUM DASH');
          e.preventDefault();
          return;
        }
      }
      if ((k === 'arrowleft' || k === 'a') && levelType === 'snail') {
        const { left } = getSnailBounds();
        snailPlayer.targetX = Math.max(left + 28, snailPlayer.targetX - 64);
        e.preventDefault();
        return;
      }
      if ((k === 'arrowright' || k === 'd') && levelType === 'snail') {
        const { right } = getSnailBounds();
        snailPlayer.targetX = Math.min(right - 28, snailPlayer.targetX + 64);
        e.preventDefault();
        return;
      }
      // M = open level select for current sector anytime
      if (k === 'm') {
        const curSector = Math.ceil(currentLevel / LEVELS_PER_SECTOR);
        setLevelSelectSector(curSector);
        setShowLevelSelect(prev => !prev);
        return;
      }
      if (k === 'v' && (levelType === 'gd' || levelType === 'operative')) {
        gdPracticeMode = !gdPracticeMode;
        spawnText(`PRACTICE ${gdPracticeMode ? "ON" : "OFF"}`, W / 2, H / 2 + 40, gdPracticeMode ? "#7ef0b1" : "#ffaa66", 26);
        return;
      }
      // H = chess HACK (convert adjacent enemy piece, once per game)
      if (k === 'h' && levelType === 'chess' && chessTurn === 'player' && !chessHackUsed && chessSelected) {
        const {r: sr, c: sc} = chessSelected;
        const adj = [{r:sr-1,c:sc},{r:sr+1,c:sc},{r:sr,c:sc-1},{r:sr,c:sc+1}];
        const target = adj.find(a=>a.r>=0&&a.r<CHESS_ROWS&&a.c>=0&&a.c<CHESS_COLS&&chessBoard[a.r]?.[a.c]?.owner==='enemy');
        if (target) {
          const p = chessBoard[target.r][target.c]!;
          if (p.type !== 'core') {
            chessBoard[target.r][target.c] = {...p, owner:'player'};
            chessHackUsed=true; shake=15; glitchFrames=8;
            chessMsg='HACK! Enemy converted — your turn continues'; chessTurn='enemy'; chessAIDelay=45;
          } else { chessMsg='Cannot hack the Core!'; }
        } else { chessMsg='Select a piece, then press H near an enemy'; }
        return;
      }
      // Spell activation — check skill requirement first
      const castSpell = (key: string, requiredSkill: string, action: () => void) => {
        if (!stats.skills.includes(requiredSkill)) {
          spawnText(`LOCKED: buy ${requiredSkill.toUpperCase()} skill`, W/2, H/2+80, '#444', 18);
          return;
        }
        if (spellCooldowns[key] > 0) {
          spawnText('COOLDOWN...', W/2, H/2+80, '#555', 16);
          return;
        }
        spellCooldowns[key] = key === 'q' && skill.overclock ? Math.floor(SPELL_MAX[key] / 2) : SPELL_MAX[key];
        action();
      };
      if (k === 'q') castSpell('q', 'reflexes', () => { slowMo = Math.max(slowMo, getSlowDuration()); usedTimeMechanic = true; startPowerCooldown('slow'); spawnText('Q - TIME FREEZE!', W/2, H/2, '#00f2ff', 60); flashes.push({life:0.6,color:'#00f2ff'}); glitchFrames=8; shake=15; });
      if (k === 'e') castSpell('e', 'magnet2',  () => { magnetActive = getMagnetDuration(); spawnText('E - MAGNET!', W/2, H/2, '#ff88ff', 60); flashes.push({life:0.6,color:'#ff88ff'}); shake=12; });
      if (k === 'r') castSpell('r', 'shield',   () => { shieldActive = true; spawnText('R - SHIELD!', W/2, H/2, '#00aaff', 60); flashes.push({life:0.6,color:'#00aaff'}); shake=10; });
      if (k === 'f') castSpell('f', 'blast',    () => { fireBlast(mouse.x, mouse.y); });
    };
    window.addEventListener('keydown', handleKey);
    
    const touchOptions: AddEventListenerOptions = { passive: false };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove, touchOptions);
    window.addEventListener('touchstart', handleMove, touchOptions);

    const handleResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      cyberiaBackdropCache = null;
      cyberiaBackdropWidth = 0;
      cyberiaBackdropHeight = 0;
    };
    window.addEventListener('resize', handleResize);

    startLevel(); // Starts the game loop
    lastTime = performance.now();
    animationFrameId = requestAnimationFrame(draw);

    return () => {
      cyberiaBackdropCache = null;
      cancelAnimationFrame(animationFrameId);
      clearTimeout(spawnTimeoutId);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove, touchOptions);
      window.removeEventListener('touchstart', handleMove, touchOptions);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('touchend', handleClick);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
    };
  }, [mounted, currentLevel, restartKey, hero.archetype, hero.accent, missionStarted]);

  if (!mounted || !storeHydrated || !username) return null;

  const currentLevelInSector = ((currentLevel - 1) % LEVELS_PER_SECTOR) + 1;
  const currentMissionIntel = getLevelIntel(currentLevel, currentLevelInSector);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#050505] touch-none cursor-crosshair">
      {/* Static background for stable frame pacing */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(1200px 700px at 50% 22%, rgba(255,70,70,0.08), transparent 55%), linear-gradient(180deg, #070707 0%, #040404 100%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 z-10" />

      {missionStarted && bossIntro && !isGameOver && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/20 px-4">
          <div className="w-full max-w-xl border-y border-red-400/45 bg-[#05070a]/92 px-6 py-5 text-center sm:px-8">
            <div className="mb-2 font-mono text-[9px] uppercase tracking-normal text-red-300">Boss incoming</div>
            <div className="break-words font-display text-2xl uppercase tracking-normal text-white sm:text-3xl">{bossIntro}</div>
          </div>
        </div>
      )}

      {missionStarted && !isGameOver && (
        <GameHud
          hud={hud}
          ownedSkills={stats.skills}
          paused={isPaused}
          hideObjectives
          onAbort={() => router.push("/hub")}
          onOpenMap={() => {
            const curSector = Math.ceil(currentLevel / LEVELS_PER_SECTOR);
            setLevelSelectSector(curSector);
            setShowLevelSelect(prev => !prev);
          }}
          onTogglePause={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "p" }))}
        />
      )}

      {!missionStarted && !isGameOver && (
        <div className="absolute inset-0 z-[55] flex items-center justify-center overflow-y-auto bg-[#030608]/96 p-4">
          <section className="my-auto w-full max-w-2xl border-y border-cyan-200/30 bg-[#05070a] px-5 py-6 sm:px-8 sm:py-8">
            <div className="font-mono text-[8px] uppercase tracking-normal text-cyan-200/60">
              Mission briefing · L{currentLevelInSector.toString().padStart(2, "0")}
            </div>
            <h1 className="mt-1 font-display text-3xl uppercase tracking-normal text-white sm:text-4xl">
              {currentMissionIntel.title}
            </h1>
            <div className="mt-2 font-mono text-[9px] uppercase tracking-normal text-gray-500">
              {currentMissionIntel.subtitle}
            </div>
            <div className="mt-6 border-y border-white/10 py-4">
              <div className="mb-3 font-mono text-[8px] uppercase tracking-normal text-gray-500">Objectives</div>
              <div className="space-y-2.5">
                {currentMissionIntel.objectives.map((objective, index) => (
                  <div key={objective} className="flex items-start gap-3 font-mono text-[10px] leading-relaxed text-gray-200">
                    <span className="mt-0.5 text-cyan-200">0{index + 1}</span>
                    <span>{objective}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setMissionStarted(true)}
                className="flex-1 border border-cyan-200/50 bg-cyan-200/[0.06] py-3 font-mono text-[10px] uppercase tracking-normal text-cyan-100 transition-colors hover:bg-cyan-200/[0.12]"
              >
                Start mission
              </button>
              <button
                type="button"
                onClick={() => router.push("/hub")}
                className="border border-white/12 px-6 py-3 font-mono text-[9px] uppercase tracking-normal text-gray-400"
              >
                Control deck
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Auto-advance Level Clear Banner */}
      {levelClearBanner && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/20 px-4">
          <div className="w-full max-w-4xl border-y border-white/14 bg-[#05070a]/78 px-5 py-7 text-center sm:px-8 sm:py-9">
            <div className="mb-3 font-mono text-[9px] uppercase tracking-normal text-cyan-100/65">Mission complete</div>
            <div className="break-words font-display text-3xl uppercase tracking-normal text-white sm:text-4xl lg:text-5xl">
              {levelClearBanner}
            </div>
            <div className="mt-4 font-mono text-[9px] uppercase tracking-normal text-gray-500">Loading next phase...</div>
          </div>
        </div>
      )}

      {missionStarted && isPaused && !isGameOver && (
        <div className="absolute inset-0 z-[45] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm border border-white/16 bg-[#05070a]/96 px-6 py-7 text-center sm:px-8">
            <div className="mb-2 font-mono text-[8px] uppercase tracking-normal text-cyan-100/60">Mission suspended</div>
            <div className="font-display text-3xl uppercase tracking-normal text-white">Paused</div>
            <div className="mt-3 font-mono text-[9px] uppercase tracking-normal text-gray-400">
              Press P or ESC to resume
            </div>
          </div>
        </div>
      )}

      {achievementToast && (
        <div className="absolute right-2 top-[108px] z-50 w-[min(320px,calc(100vw-16px))] border border-cyan-300/35 bg-[#05070a]/96 px-4 py-3 sm:right-3 sm:top-[116px]">
          <div className="font-mono text-[8px] uppercase tracking-normal text-cyan-200/70">Achievement unlocked</div>
          <div className="mt-1 truncate font-mono text-xs uppercase tracking-normal text-white">{achievementToast.name}</div>
          <div className="mt-0.5 font-mono text-[9px] leading-relaxed text-gray-400">{achievementToast.description}</div>
        </div>
      )}

      {/* ── LEVEL SELECT PANEL (after every cleared level) ── */}
      {showLevelSelect && (
        <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/95 p-3 sm:p-4">
          <div className="my-auto w-full max-w-2xl border border-gray-800 bg-[#050505] p-4 sm:p-8">
            <div className="mb-2 font-mono text-[9px] uppercase tracking-normal text-gray-600">
              {currentLevelInSector === 11 ? 'Sector Cleared' : 'Level Cleared'}
            </div>
            <div className="mb-1 break-words font-mono text-xl uppercase tracking-normal text-white sm:text-2xl">
              {levelSelectSector === TESTING_BOSS_SECTOR_ID
                ? "TESTING BOSS"
                : levelSelectSector === 99
                ? "LUDILO BONUS"
                : PLANETS[levelSelectSector - 1]?.name ?? `Sector ${levelSelectSector}`}
            </div>
            <div className="font-mono text-[10px] text-gray-600 mb-6">Izaberi level za replay ili nastavi dalje</div>
            <div className="mb-6 grid grid-cols-3 gap-2 sm:mb-8 sm:grid-cols-4">
              {Array.from({length: levelSelectSector === TESTING_BOSS_SECTOR_ID ? 1 : LEVELS_PER_SECTOR}, (_, i) => {
                const lvl = levelSelectSector === TESTING_BOSS_SECTOR_ID
                  ? TESTING_BOSS_LEVEL
                  : (levelSelectSector - 1) * LEVELS_PER_SECTOR + i + 1;
                const isCompleted = (stats.completedLevels ?? []).includes(lvl);
                const isReachable =
                  levelSelectSector === TESTING_BOSS_SECTOR_ID
                    ? true
                    : levelSelectSector === 99 || lvl <= (stats.maxLevelReached ?? 1) || lvl <= currentLevel;
                const isCurrent = lvl === currentLevel;
                const isBoss = levelSelectSector === TESTING_BOSS_SECTOR_ID || i === 10;
                const col =
                  levelSelectSector === TESTING_BOSS_SECTOR_ID
                    ? "#ef4444"
                    : levelSelectSector === 99
                    ? "#ff00a2"
                    : PLANETS[levelSelectSector - 1]?.color ?? "#fff";
                const levelBadge = levelSelectSector === TESTING_BOSS_SECTOR_ID
                  ? "T1"
                  : levelSelectSector === 99
                  ? `B${i + 1}`
                  : isBoss
                  ? 'BOSS'
                  : `L${i+1}`;
                const typeLabel = levelSelectSector === TESTING_BOSS_SECTOR_ID
                  ? "EVIL EYE TEST"
                  : levelSelectSector === 99
                  ? (i % 2 === 0 ? 'LUDILO GD' : 'CUBE SHOOTER')
                  : isBoss ? 'BOSS'
                  : getLevelIntel(lvl, i + 1).title;
                return (
                  <button key={lvl}
                    disabled={!isReachable}
                    onClick={() => {
                      setShowLevelSelect(false);
                      setReplayLevel(lvl);
                      setMissionStarted(false);
                      setCurrentLevel(lvl);
                      setRestartKey(k => k + 1);
                      setIsGameOver(false); setGameResult(null);
                    }}
                    className="flex min-h-16 flex-col items-center justify-center gap-1 border p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-20 sm:p-3"
                    style={{
                      borderColor: isCurrent ? col : isCompleted ? col+'55' : isReachable ? '#333' : '#111',
                      background: isCurrent ? col+'18' : isBoss ? col+'0a' : isCompleted ? col+'06' : 'transparent',
                      boxShadow: isCurrent ? `0 0 12px ${col}44` : 'none',
                    }}>
                    <div className="font-mono text-[9px] tracking-normal" style={{color: isCurrent ? col : isCompleted ? col : isReachable ? '#555' : '#222'}}>
                      {levelBadge}
                    </div>
                    <div className="font-mono text-base leading-none" style={{color: isCurrent ? col : isCompleted ? col : isReachable ? '#444' : '#222'}}>
                      {isCurrent ? 'NOW' : isCompleted ? 'DONE' : isBoss ? 'BOSS' : 'OPEN'}
                    </div>
                    <div className="font-mono text-[6px] tracking-normal" style={{color: isReachable ? '#444' : '#222'}}>
                      {typeLabel}
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Action buttons */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => {
                  setShowLevelSelect(false);
                  setMissionStarted(false);
                  setCurrentLevel(prev => {
                    if (levelSelectSector === TESTING_BOSS_SECTOR_ID) return TESTING_BOSS_LEVEL;
                    const prevSector = Math.ceil(prev / LEVELS_PER_SECTOR);
                    if (prevSector !== 99) return prev + 1;
                    const firstBonusLevel = (99 - 1) * LEVELS_PER_SECTOR + 1;
                    const lastBonusLevel = firstBonusLevel + LEVELS_PER_SECTOR - 1;
                    return prev >= lastBonusLevel ? firstBonusLevel : prev + 1;
                  });
                  setRestartKey(k => k + 1);
                }}
                className="flex-1 border-2 py-4 font-mono text-sm uppercase tracking-normal transition-colors"
                style={{borderColor: PLANETS[levelSelectSector - 1]?.color ?? '#fff', color: PLANETS[levelSelectSector - 1]?.color ?? '#fff', boxShadow: `0 0 20px ${PLANETS[levelSelectSector-1]?.color ?? '#fff'}22`}}
              >
                NEXT LEVEL
              </button>
              <button
                onClick={() => router.push('/hub')}
                className="border border-gray-800 px-6 py-4 font-mono text-xs uppercase tracking-normal text-gray-600 transition-colors hover:border-gray-600 hover:text-white"
              >
                HUB
              </button>
            </div>
          </div>
        </div>
      )}

      {isGameOver && gameResult && (

        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/92 p-4">
          <div className="relative w-full max-w-lg border border-gray-800 bg-[#0a0a0a] p-6 sm:p-10">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white"></div>

            <div className="mb-2 font-mono text-[9px] uppercase tracking-normal text-gray-500">
              Mission Status Report
            </div>
            
            <h2 className={`mb-2 break-words font-display text-2xl uppercase tracking-normal sm:text-3xl ${gameResult.status.includes('FAIL') ? 'text-red-500' : 'text-white'}`}>
              {gameResult.title}
            </h2>
            <div className="mb-8 font-mono text-sm uppercase tracking-normal text-gray-400">
              {gameResult.levelStr}
            </div>
            
            <div className="mb-10 space-y-4 font-mono text-xs tracking-normal text-gray-400">
              <div className="flex justify-between border-b border-gray-900 pb-2">
                <span>Final Score</span>
                <span className="text-white">{gameResult.score}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              {gameResult.status === "SUCCESS" ? (
                 <button
                   onClick={() => {
                     setIsGameOver(false);
                     setGameResult(null);
                     setMissionStarted(false);
                     // Increment BOTH — restartKey guarantees useEffect re-runs even if
                     // React batches currentLevel change with other state updates
                     setCurrentLevel(prev => {
                       if (Math.ceil(prev / LEVELS_PER_SECTOR) === TESTING_BOSS_SECTOR_ID) return TESTING_BOSS_LEVEL;
                       const prevSector = Math.ceil(prev / LEVELS_PER_SECTOR);
                       if (prevSector !== 99) return prev + 1;
                       const firstBonusLevel = (99 - 1) * LEVELS_PER_SECTOR + 1;
                       const lastBonusLevel = firstBonusLevel + LEVELS_PER_SECTOR - 1;
                       return prev >= lastBonusLevel ? firstBonusLevel : prev + 1;
                     });
                     setRestartKey(k => k + 1);
                   }}
                   className="flex-1 bg-white py-4 font-mono text-xs uppercase tracking-normal text-black transition-colors hover:bg-gray-200"
                 >
                   NEXT PHASE
                 </button>
              ) : (
                <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => {
                      // Increment restartKey to force useEffect re-run on same currentLevel
                      setIsGameOver(false);
                      setGameResult(null);
                      setMissionStarted(false);
                      setRestartKey(k => k + 1);
                    }}
                    className="flex-1 bg-red-600 py-4 font-mono text-xs uppercase tracking-normal text-white transition-colors hover:bg-red-500"
                    style={{boxShadow:'0 0 20px rgba(255,0,60,0.4)'}}
                  >
                    RETRY LEVEL
                  </button>
                  <button
                    onClick={() => router.push("/hub")}
                    className="border border-gray-700 px-6 py-4 font-mono text-xs uppercase tracking-normal text-gray-400 transition-colors hover:text-white"
                  >
                    HUB
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
