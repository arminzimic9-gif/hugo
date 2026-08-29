"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Cpu,
  Crosshair,
  HeartPulse,
  Radio,
  Shield,
  Zap,
} from "lucide-react";
import GameHud, { type GameHudSnapshot } from "@/components/game/GameHud";
import {
  ARENA_CONFIG,
  ARENA_DISTRICTS,
  ARENA_LEVEL_INTEL,
  ARENA_MAP_NODES,
  ARENA_UPGRADES,
  ARENA_WAVE_LABELS,
  type ArenaUpgradeDefinition,
  type ArenaUpgradeId,
} from "@/data/arena";
import { getHeroDefinition } from "@/data/heroes";
import { useGameStore } from "@/store/gameStore";

type ArenaResult = {
  success: boolean;
  score: number;
  kills: number;
  level: number;
};

type ArenaEnemyKind = keyof typeof ARENA_CONFIG.enemies;

type ArenaEnemy = {
  id: number;
  kind: ArenaEnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  maxHealth: number;
  speed: number;
  radius: number;
  xp: number;
  score: number;
  attackTimer: number;
  hitFlash: number;
};

type ArenaProjectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  bounces: number;
  color: string;
};

type ArenaDrop = {
  x: number;
  y: number;
  value: number;
  radius: number;
  pulse: number;
};

type ArenaParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
};

const EMPTY_ARENA_HUD: GameHudSnapshot = {
  score: 0,
  combo: 0,
  lives: 1,
  levelLabel: "ARENA TEST | A01",
  modeLabel: "TOP-DOWN SURVIVAL",
  targetLabel: "60.0s",
  progress: 0,
  powerLabel: "LEVEL 1",
  powerProgress: 0,
  sectionLabel: ARENA_WAVE_LABELS[0],
  modifierLabel: "NO LINKS",
  modifierProgress: 0,
  checkpointLabel: "OFF",
  bestRankLabel: "-",
  objectives: ARENA_LEVEL_INTEL.objectives,
  bossActive: false,
  bossPhase: 1,
  bossHealth: 100,
  bossName: "",
  bossColor: ARENA_CONFIG.danger,
  eyeX: 0,
  eyeY: 0,
  eyeScale: 1,
  eyeActive: false,
  lightningActive: false,
  lightningHue: 190,
  lightningIntensity: 0,
  lightningSpeed: 0,
  lightningSize: 0,
  lightningXOffset: 0,
  isTestingBoss: false,
};

const UPGRADE_ICONS: Record<ArenaUpgradeId, typeof Cpu> = {
  precision: Crosshair,
  rapidfire: Zap,
  ricochet: Radio,
  cluster: Cpu,
  barrier: Shield,
  magnet2: HeartPulse,
  phaserush: Zap,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const distanceSquared = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

export default function ArenaPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chooseUpgradeRef = useRef<(id: ArenaUpgradeId) => void>(() => undefined);
  const togglePauseRef = useRef<() => void>(() => undefined);
  const router = useRouter();
  const {
    username,
    stats,
    hero,
    addScore,
    addXp,
    addCredits,
    addMaterials,
  } = useGameStore();
  const [mounted, setMounted] = useState(false);
  const [storeHydrated, setStoreHydrated] = useState(false);
  const [paused, setPaused] = useState(false);
  const [missionStarted, setMissionStarted] = useState(false);
  const [upgradeChoices, setUpgradeChoices] = useState<ArenaUpgradeDefinition[] | null>(null);
  const [upgradeRanks, setUpgradeRanks] = useState<Partial<Record<ArenaUpgradeId, number>>>({});
  const [result, setResult] = useState<ArenaResult | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const [hud, setHud] = useState<GameHudSnapshot>(EMPTY_ARENA_HUD);

  useEffect(() => {
    setMounted(true);
    setStoreHydrated(useGameStore.persist.hasHydrated());
    return useGameStore.persist.onFinishHydration(() => setStoreHydrated(true));
  }, []);

  useEffect(() => {
    if (mounted && storeHydrated && !username) router.push("/");
  }, [mounted, router, storeHydrated, username]);

  useEffect(() => {
    if (!mounted || !storeHydrated || !username || !missionStarted || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const heroDefinition = getHeroDefinition(hero.archetype);
    const operatorImage = new window.Image();
    operatorImage.decoding = "async";
    operatorImage.src = `/images/game/operators/${hero.archetype}.webp`;
    const enemyPackImage = new window.Image();
    enemyPackImage.decoding = "async";
    enemyPackImage.src = "/images/game/arena/enemy-pack.webp";
    const reactorImage = new window.Image();
    reactorImage.decoding = "async";
    reactorImage.src = "/images/game/energy-reactor.webp";
    const coreImage = new window.Image();
    coreImage.decoding = "async";
    coreImage.src = "/images/game/data-core.webp";
    const districtImages = ARENA_DISTRICTS.map((district) => {
      const image = new window.Image();
      image.decoding = "async";
      image.src = district.image;
      return image;
    });

    let width = window.innerWidth;
    let height = window.innerHeight;
    const deviceScale = Math.min(1.5, window.devicePixelRatio || 1);
    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * deviceScale);
      canvas.height = Math.floor(height * deviceScale);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
      context.imageSmoothingEnabled = true;
    };
    resizeCanvas();

    const ownsSkill = (id: ArenaUpgradeId) => stats.skills.includes(id);
    const ownsGear = (id: string) => (stats.craftedGear ?? []).includes(id as never);
    const ranks: Record<ArenaUpgradeId, number> = {
      precision: ownsSkill("precision") ? 1 : 0,
      rapidfire: ownsSkill("rapidfire") ? 1 : 0,
      ricochet: ownsSkill("ricochet") ? 1 : 0,
      cluster: ownsSkill("cluster") ? 1 : 0,
      barrier: ownsSkill("barrier") ? 1 : 0,
      magnet2: ownsSkill("magnet2") ? 1 : 0,
      phaserush: ownsSkill("phaserush") ? 1 : 0,
    };
    setUpgradeRanks({ ...ranks });

    const gearSpeedMultiplier =
      (ownsGear("runner_boots") ? 1.08 : 1) *
      (ownsGear("dragon_engine") ? 1.06 : 1);
    let movementSpeed =
      ARENA_CONFIG.player.speed *
      gearSpeedMultiplier *
      (ranks.phaserush > 0 ? 1.1 : 1);
    let maxHealth = ARENA_CONFIG.player.maxHealth + (ranks.barrier > 0 ? 20 : 0);
    let pickupRadius = ARENA_CONFIG.player.pickupRadius + (ranks.magnet2 > 0 ? 60 : 0);
    let weaponDamage = ARENA_CONFIG.weapon.damage * (ranks.precision > 0 ? 1.3 : 1);
    let fireInterval = ARENA_CONFIG.weapon.fireIntervalMs * (ranks.rapidfire > 0 ? 0.8 : 1);
    let ricochetCount = ranks.ricochet > 0 ? 1 : 0;
    let clusterRank = ranks.cluster;

    const player = {
      x: ARENA_CONFIG.world.chunkSize * 0.36,
      y: ARENA_CONFIG.world.chunkSize * 0.36,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: ARENA_CONFIG.player.radius,
      health: maxHealth,
      invulnerability: 0,
    };
    const camera = { x: player.x, y: player.y };
    const keys = new Set<string>();
    const touch = { pointerId: -1, startX: 0, startY: 0, dx: 0, dy: 0, active: false };
    let enemies: ArenaEnemy[] = [];
    const projectiles: ArenaProjectile[] = [];
    const enemyProjectiles: ArenaProjectile[] = [];
    const drops: ArenaDrop[] = [];
    const particles: ArenaParticle[] = [];
    let enemySequence = 0;
    let active = true;
    let pausedInternal = false;
    let choosingUpgrade = false;
    let rewardGranted = false;
    let eliteSpawned = false;
    let elapsed = 0;
    let spawnTimer = 0;
    let attackTimer = 0;
    let score = 0;
    let kills = 0;
    let killChain = 0;
    let arenaLevel = 1;
    let arenaXp = 0;
    let xpNeeded = ARENA_CONFIG.progression.xpThresholdBase;
    let lastFrame = performance.now();
    let lastHudCommit = 0;
    let animationFrame = 0;
    let cameraShake = 0;
    let damageFlash = 0;

    const capArray = <T,>(items: T[], maximum: number) => {
      if (items.length > maximum) items.splice(0, items.length - maximum);
    };

    const createBurst = (x: number, y: number, color: string, amount: number) => {
      const available = Math.max(0, ARENA_CONFIG.limits.particles - particles.length);
      const count = Math.min(amount, available);
      for (let index = 0; index < count; index++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 45 + Math.random() * 150;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.45 + Math.random() * 0.45,
          color,
          size: 1.5 + Math.random() * 3.5,
        });
      }
    };

    const waveIndex = () => Math.min(2, Math.floor((elapsed / ARENA_CONFIG.durationSeconds) * 3));

    const pickEnemyKind = (): ArenaEnemyKind => {
      const wave = waveIndex();
      const roll = Math.random();
      if (wave === 0) return roll < 0.88 ? "drone" : "hunter";
      if (wave === 1) return roll < 0.58 ? "drone" : roll < 0.84 ? "hunter" : "heavy";
      return roll < 0.4 ? "drone" : roll < 0.72 ? "hunter" : "heavy";
    };

    const spawnEnemy = (forcedKind?: ArenaEnemyKind) => {
      if (enemies.length >= ARENA_CONFIG.limits.enemies) return;
      const kind = forcedKind ?? pickEnemyKind();
      const definition = ARENA_CONFIG.enemies[kind];
      const angle = Math.random() * Math.PI * 2;
      const spawnDistance = ARENA_CONFIG.spawn.distanceFromPlayer + Math.random() * 140;
      const x = player.x + Math.cos(angle) * spawnDistance;
      const y = player.y + Math.sin(angle) * spawnDistance;
      enemies.push({
        id: ++enemySequence,
        kind,
        x,
        y,
        vx: 0,
        vy: 0,
        health: definition.health,
        maxHealth: definition.health,
        speed: definition.speed,
        radius: definition.radius,
        xp: definition.xp,
        score: definition.score,
        attackTimer: definition.fireIntervalMs * (0.45 + Math.random() * 0.65),
        hitFlash: 0,
      });
      if (kind === "elite") createBurst(x, y, ARENA_CONFIG.danger, 34);
    };

    const findNearestEnemy = (x: number, y: number, range: number, excludedId = -1) => {
      let nearest: ArenaEnemy | null = null;
      let nearestDistance = range * range;
      for (const enemy of enemies) {
        if (enemy.id === excludedId || enemy.health <= 0) continue;
        const distance = distanceSquared(x, y, enemy.x, enemy.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = enemy;
        }
      }
      return nearest;
    };

    const fireProjectile = (x: number, y: number, angle: number, damage = weaponDamage, bounces = ricochetCount) => {
      if (projectiles.length >= ARENA_CONFIG.limits.projectiles) return;
      projectiles.push({
        x,
        y,
        vx: Math.cos(angle) * ARENA_CONFIG.weapon.projectileSpeed,
        vy: Math.sin(angle) * ARENA_CONFIG.weapon.projectileSpeed,
        radius: ARENA_CONFIG.weapon.projectileRadius,
        damage,
        life: ARENA_CONFIG.weapon.projectileLifeMs,
        bounces,
        color: heroDefinition.accent,
      });
    };

    const fireAtNearest = () => {
      const target = findNearestEnemy(player.x, player.y, ARENA_CONFIG.weapon.targetRange);
      if (!target) return;
      const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
      const supportShots = ranks.rapidfire >= 3 ? 2 : 1;
      for (let index = 0; index < supportShots; index++) {
        const offset = supportShots === 1 ? 0 : (index - 0.5) * 0.1;
        fireProjectile(player.x, player.y, baseAngle + offset);
      }
    };

    const pushEnemyProjectile = (
      enemy: ArenaEnemy,
      angle: number,
      speed: number,
      damage: number,
      radius: number,
      color: string,
    ) => {
      if (enemyProjectiles.length >= ARENA_CONFIG.limits.enemyProjectiles) return;
      enemyProjectiles.push({
        x: enemy.x + Math.cos(angle) * enemy.radius * 0.7,
        y: enemy.y + Math.sin(angle) * enemy.radius * 0.7,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius,
        damage,
        life: 3600,
        bounces: 0,
        color,
      });
    };

    const fireEnemyPattern = (enemy: ArenaEnemy) => {
      const definition = ARENA_CONFIG.enemies[enemy.kind];
      const leadSeconds = enemy.kind === "hunter" ? 0.24 : 0.08;
      const aimX = player.x + player.vx * leadSeconds;
      const aimY = player.y + player.vy * leadSeconds;
      const baseAngle = Math.atan2(aimY - enemy.y, aimX - enemy.x);

      if (enemy.kind === "heavy") {
        for (const spread of [-0.18, 0, 0.18]) {
          pushEnemyProjectile(enemy, baseAngle + spread, definition.projectileSpeed, definition.projectileDamage, 7, "#ff5a24");
        }
      } else if (enemy.kind === "elite") {
        const count = 10;
        for (let index = 0; index < count; index++) {
          const angle = (index / count) * Math.PI * 2 + elapsed * 0.35;
          pushEnemyProjectile(enemy, angle, definition.projectileSpeed, definition.projectileDamage, 7, ARENA_CONFIG.danger);
        }
        for (const spread of [-0.1, 0, 0.1]) {
          pushEnemyProjectile(enemy, baseAngle + spread, definition.projectileSpeed * 1.35, definition.projectileDamage, 6, "#ff8a36");
        }
      } else {
        const color = enemy.kind === "hunter" ? "#ff3bd4" : "#ff365f";
        pushEnemyProjectile(enemy, baseAngle, definition.projectileSpeed, definition.projectileDamage, enemy.kind === "hunter" ? 5 : 4, color);
      }
      createBurst(enemy.x, enemy.y, enemy.kind === "hunter" ? "#ff3bd4" : ARENA_CONFIG.danger, enemy.kind === "elite" ? 14 : 5);
    };

    const emitCluster = (x: number, y: number) => {
      const count = 6 + Math.min(4, clusterRank);
      for (let index = 0; index < count; index++) {
        fireProjectile(x, y, (index / count) * Math.PI * 2, weaponDamage * 0.65, 0);
      }
      createBurst(x, y, "#ff8800", 14);
    };

    const finishArena = (success: boolean) => {
      if (!active) return;
      active = false;
      pausedInternal = false;
      choosingUpgrade = false;
      setPaused(false);
      setUpgradeChoices(null);
      if (success && !rewardGranted) {
        rewardGranted = true;
        addScore(score);
        addXp(ARENA_CONFIG.rewards.baseXp + Math.floor(score / ARENA_CONFIG.rewards.scoreXpDivisor));
        addCredits(
          ARENA_CONFIG.rewards.baseCredits +
            Math.floor(score / ARENA_CONFIG.rewards.scoreCreditsDivisor),
        );
        addMaterials(ARENA_CONFIG.rewards.materials);
      }
      setResult({ success, score, kills, level: arenaLevel });
    };

    const killEnemy = (enemy: ArenaEnemy) => {
      enemy.health = 0;
      score += enemy.score;
      kills += 1;
      killChain += 1;
      drops.push({
        x: enemy.x,
        y: enemy.y,
        value: enemy.xp,
        radius: enemy.kind === "elite" ? 13 : 8,
        pulse: Math.random() * Math.PI * 2,
      });
      createBurst(
        enemy.x,
        enemy.y,
        enemy.kind === "elite" ? ARENA_CONFIG.danger : heroDefinition.accent,
        enemy.kind === "elite" ? 34 : 10,
      );
      if (clusterRank > 0) {
        const triggerEvery = Math.max(3, 8 - clusterRank);
        if (killChain % triggerEvery === 0) emitCluster(enemy.x, enemy.y);
      }
    };

    const chooseUpgradeOptions = () => {
      const pool = ARENA_UPGRADES.filter(
        (upgrade) => ranks[upgrade.id] < ARENA_CONFIG.progression.maxUpgradeRank,
      );
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(3, shuffled.length));
    };

    const requestUpgrade = () => {
      const choices = chooseUpgradeOptions();
      if (choices.length === 0) return;
      choosingUpgrade = true;
      setUpgradeChoices(choices);
    };

    chooseUpgradeRef.current = (id) => {
      if (!choosingUpgrade) return;
      ranks[id] = Math.min(ARENA_CONFIG.progression.maxUpgradeRank, ranks[id] + 1);
      if (id === "precision") weaponDamage *= 1.25;
      if (id === "rapidfire") fireInterval *= 0.86;
      if (id === "ricochet") ricochetCount += 1;
      if (id === "cluster") clusterRank += 1;
      if (id === "barrier") {
        maxHealth += 20;
        player.health = Math.min(maxHealth, player.health + 20);
      }
      if (id === "magnet2") pickupRadius += 45;
      if (id === "phaserush") movementSpeed *= 1.08;
      choosingUpgrade = false;
      setUpgradeChoices(null);
      setUpgradeRanks({ ...ranks });
      createBurst(player.x, player.y, ARENA_CONFIG.support, 24);
    };

    togglePauseRef.current = () => {
      if (!active || choosingUpgrade) return;
      pausedInternal = !pausedInternal;
      setPaused(pausedInternal);
    };

    const collectDrop = (drop: ArenaDrop) => {
      arenaXp += drop.value;
      score += drop.value * 8;
      while (arenaXp >= xpNeeded) {
        arenaXp -= xpNeeded;
        arenaLevel += 1;
        xpNeeded =
          ARENA_CONFIG.progression.xpThresholdBase +
          arenaLevel * ARENA_CONFIG.progression.xpThresholdPerLevel;
        requestUpgrade();
        if (choosingUpgrade) break;
      }
    };

    const updatePlayer = (deltaSeconds: number) => {
      let horizontal = 0;
      let vertical = 0;
      if (keys.has("a") || keys.has("arrowleft")) horizontal -= 1;
      if (keys.has("d") || keys.has("arrowright")) horizontal += 1;
      if (keys.has("w") || keys.has("arrowup")) vertical -= 1;
      if (keys.has("s") || keys.has("arrowdown")) vertical += 1;
      if (touch.active) {
        horizontal += touch.dx;
        vertical += touch.dy;
      }
      const length = Math.hypot(horizontal, vertical);
      if (length > 0.01) {
        horizontal /= Math.max(1, length);
        vertical /= Math.max(1, length);
        player.vx += (horizontal * movementSpeed - player.vx) * 0.22;
        player.vy += (vertical * movementSpeed - player.vy) * 0.22;
        player.angle = Math.atan2(vertical, horizontal);
      } else {
        player.vx *= 0.78;
        player.vy *= 0.78;
      }
      player.x += player.vx * deltaSeconds;
      player.y += player.vy * deltaSeconds;
      if (player.invulnerability > 0) player.invulnerability -= deltaSeconds * 1000;
      camera.x += (player.x - camera.x) * 0.1;
      camera.y += (player.y - camera.y) * 0.1;
    };

    const updateEnemies = (deltaSeconds: number, deltaMs: number) => {
      for (const enemy of enemies) {
        if (enemy.health <= 0) continue;
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        const speedScale = 1 + waveIndex() * 0.08;
        const definition = ARENA_CONFIG.enemies[enemy.kind];
        const approach = distance > definition.preferredDistance + 50 ? 1 : distance < definition.preferredDistance - 70 ? -0.55 : 0;
        const orbitDirection = enemy.id % 2 === 0 ? 1 : -1;
        const orbitStrength = enemy.kind === "hunter" ? 0.88 : enemy.kind === "elite" ? 0.4 : 0.08;
        const desiredVx =
          ((dx / distance) * approach - (dy / distance) * orbitDirection * orbitStrength) *
          enemy.speed * speedScale;
        const desiredVy =
          ((dy / distance) * approach + (dx / distance) * orbitDirection * orbitStrength) *
          enemy.speed * speedScale;
        enemy.vx += (desiredVx - enemy.vx) * 0.08;
        enemy.vy += (desiredVy - enemy.vy) * 0.08;
        enemy.x += enemy.vx * deltaSeconds;
        enemy.y += enemy.vy * deltaSeconds;
        enemy.hitFlash = Math.max(0, enemy.hitFlash - deltaMs);

        enemy.attackTimer -= deltaMs;
        if (enemy.attackTimer <= 0 && distance < 720) {
          enemy.attackTimer = definition.fireIntervalMs * (0.88 + Math.random() * 0.24);
          fireEnemyPattern(enemy);
        }

        if (distance < player.radius + enemy.radius && player.invulnerability <= 0) {
          const damage = enemy.kind === "elite" ? 28 : enemy.kind === "heavy" ? 24 : 17;
          player.health -= damage;
          player.invulnerability = ARENA_CONFIG.player.contactInvulnerabilityMs;
          player.x -= (dx / distance) * 42;
          player.y -= (dy / distance) * 42;
          enemy.x -= (dx / distance) * 48;
          enemy.y -= (dy / distance) * 48;
          cameraShake = Math.max(cameraShake, 6);
          damageFlash = Math.max(damageFlash, 0.22);
          createBurst(player.x, player.y, ARENA_CONFIG.danger, 18);
          if (player.health <= 0) finishArena(false);
        }
      }
      enemies = enemies.filter((enemy) => enemy.health > 0);
    };

    const updateProjectiles = (deltaSeconds: number, deltaMs: number) => {
      for (let projectileIndex = projectiles.length - 1; projectileIndex >= 0; projectileIndex--) {
        const projectile = projectiles[projectileIndex];
        projectile.x += projectile.vx * deltaSeconds;
        projectile.y += projectile.vy * deltaSeconds;
        projectile.life -= deltaMs;
        let consumed = projectile.life <= 0;
        if (!consumed) {
          for (const enemy of enemies) {
            if (enemy.health <= 0) continue;
            const hitRadius = projectile.radius + enemy.radius;
            if (distanceSquared(projectile.x, projectile.y, enemy.x, enemy.y) > hitRadius * hitRadius) continue;
            enemy.health -= projectile.damage;
            enemy.hitFlash = 80;
            createBurst(projectile.x, projectile.y, projectile.color, 4);
            if (enemy.health <= 0) killEnemy(enemy);
            if (projectile.bounces > 0) {
              const next = findNearestEnemy(enemy.x, enemy.y, 300, enemy.id);
              if (next) {
                const angle = Math.atan2(next.y - enemy.y, next.x - enemy.x);
                projectile.x = enemy.x;
                projectile.y = enemy.y;
                projectile.vx = Math.cos(angle) * ARENA_CONFIG.weapon.projectileSpeed;
                projectile.vy = Math.sin(angle) * ARENA_CONFIG.weapon.projectileSpeed;
                projectile.bounces -= 1;
              } else {
                consumed = true;
              }
            } else {
              consumed = true;
            }
            break;
          }
        }
        if (consumed) projectiles.splice(projectileIndex, 1);
      }

      for (let index = enemyProjectiles.length - 1; index >= 0; index--) {
        const projectile = enemyProjectiles[index];
        projectile.x += projectile.vx * deltaSeconds;
        projectile.y += projectile.vy * deltaSeconds;
        projectile.life -= deltaMs;
        const hitRadius = projectile.radius + player.radius;
        if (
          player.invulnerability <= 0 &&
          distanceSquared(projectile.x, projectile.y, player.x, player.y) <= hitRadius * hitRadius
        ) {
          player.health -= projectile.damage;
          player.invulnerability = ARENA_CONFIG.player.contactInvulnerabilityMs;
          cameraShake = Math.max(cameraShake, 5);
          damageFlash = Math.max(damageFlash, 0.18);
          createBurst(player.x, player.y, ARENA_CONFIG.danger, 16);
          enemyProjectiles.splice(index, 1);
          if (player.health <= 0) finishArena(false);
        } else if (projectile.life <= 0) {
          enemyProjectiles.splice(index, 1);
        }
      }
    };

    const updateDrops = (deltaSeconds: number) => {
      for (let index = drops.length - 1; index >= 0; index--) {
        const drop = drops[index];
        drop.pulse += deltaSeconds * 4;
        const dx = player.x - drop.x;
        const dy = player.y - drop.y;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        if (distance < pickupRadius) {
          const pull = 180 + (pickupRadius - distance) * 5;
          drop.x += (dx / distance) * pull * deltaSeconds;
          drop.y += (dy / distance) * pull * deltaSeconds;
        }
        if (distance < player.radius + drop.radius + 10) {
          collectDrop(drop);
          drops.splice(index, 1);
        }
      }
    };

    const updateParticles = (deltaSeconds: number) => {
      for (let index = particles.length - 1; index >= 0; index--) {
        const particle = particles[index];
        particle.x += particle.vx * deltaSeconds;
        particle.y += particle.vy * deltaSeconds;
        particle.vx *= 0.96;
        particle.vy *= 0.96;
        particle.life -= deltaSeconds;
        if (particle.life <= 0) particles.splice(index, 1);
      }
    };

    const updateArena = (deltaSeconds: number, deltaMs: number) => {
      elapsed += deltaSeconds;
      updatePlayer(deltaSeconds);
      const progress = clamp(elapsed / ARENA_CONFIG.durationSeconds, 0, 1);
      spawnTimer -= deltaMs;
      if (spawnTimer <= 0) {
        const interval =
          ARENA_CONFIG.spawn.startIntervalMs +
          (ARENA_CONFIG.spawn.endIntervalMs - ARENA_CONFIG.spawn.startIntervalMs) * progress;
        spawnTimer = interval;
        const groupSize = 1 + Math.floor(progress * 3);
        for (let index = 0; index < groupSize; index++) spawnEnemy();
      }
      if (!eliteSpawned && elapsed >= ARENA_CONFIG.eliteSpawnSecond) {
        eliteSpawned = true;
        spawnEnemy("elite");
      }

      attackTimer -= deltaMs;
      if (attackTimer <= 0) {
        fireAtNearest();
        attackTimer = fireInterval;
      }

      updateEnemies(deltaSeconds, deltaMs);
      updateProjectiles(deltaSeconds, deltaMs);
      updateDrops(deltaSeconds);
      updateParticles(deltaSeconds);
      capArray(enemies, ARENA_CONFIG.limits.enemies);
      capArray(projectiles, ARENA_CONFIG.limits.projectiles);
      capArray(enemyProjectiles, ARENA_CONFIG.limits.enemyProjectiles);
      capArray(drops, ARENA_CONFIG.limits.drops);
      capArray(particles, ARENA_CONFIG.limits.particles);
      cameraShake = Math.max(0, cameraShake - deltaSeconds * 18);
      damageFlash = Math.max(0, damageFlash - deltaSeconds * 0.9);
      if (elapsed >= ARENA_CONFIG.durationSeconds) finishArena(true);
    };

    const drawSprite = (
      image: HTMLImageElement,
      x: number,
      y: number,
      drawWidth: number,
      drawHeight: number,
      rotation = 0,
      alpha = 1,
    ) => {
      if (!image.complete || image.naturalWidth === 0) return false;
      context.save();
      context.translate(x, y);
      context.rotate(rotation);
      context.globalAlpha = alpha;
      context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      context.restore();
      return true;
    };

    const drawArenaFloor = () => {
      const viewLeft = camera.x - width / 2;
      const viewTop = camera.y - height / 2;
      const chunkSize = ARENA_CONFIG.world.chunkSize;
      const firstChunkX = Math.floor(viewLeft / chunkSize);
      const lastChunkX = Math.floor((viewLeft + width) / chunkSize);
      const firstChunkY = Math.floor(viewTop / chunkSize);
      const lastChunkY = Math.floor((viewTop + height) / chunkSize);
      context.fillStyle = "#04090b";
      context.fillRect(viewLeft, viewTop, width, height);

      for (let chunkY = firstChunkY; chunkY <= lastChunkY; chunkY++) {
        for (let chunkX = firstChunkX; chunkX <= lastChunkX; chunkX++) {
          const hash = Math.abs(Math.imul(chunkX + 217, 73856093) ^ Math.imul(chunkY - 431, 19349663));
          const districtIndex = hash % ARENA_DISTRICTS.length;
          const district = ARENA_DISTRICTS[districtIndex];
          const image = districtImages[districtIndex];
          const chunkLeft = chunkX * chunkSize;
          const chunkTop = chunkY * chunkSize;
          if (image.complete && image.naturalWidth > 0) {
            context.drawImage(image, chunkLeft - 1, chunkTop - 1, chunkSize + 2, chunkSize + 2);
          } else {
            context.fillStyle = districtIndex === 1 ? "#0c0d0e" : "#071015";
            context.fillRect(chunkLeft, chunkTop, chunkSize, chunkSize);
          }
          context.fillStyle = "rgba(2,6,9,0.14)";
          context.fillRect(chunkLeft, chunkTop, chunkSize, chunkSize);
          context.strokeStyle = `${district.tint}22`;
          context.lineWidth = 1;
          context.strokeRect(chunkLeft + 0.5, chunkTop + 0.5, chunkSize - 1, chunkSize - 1);

          if ((hash % 100) / 100 > ARENA_CONFIG.world.nodeChance) continue;
          const node = ARENA_MAP_NODES[hash % ARENA_MAP_NODES.length];
          const nodeX = chunkLeft + node.x * chunkSize;
          const nodeY = chunkTop + node.y * chunkSize;
          context.save();
          context.strokeStyle = `${district.tint}66`;
          context.fillStyle = "rgba(0,0,0,0.5)";
          context.lineWidth = 1.5;
          context.beginPath();
          context.arc(nodeX, nodeY, node.size * 0.64, 0, Math.PI * 2);
          context.fill();
          context.stroke();
          context.restore();
          drawSprite(reactorImage, nodeX, nodeY, node.size, node.size, 0, node.kind === "reactor" ? 0.78 : 0.44);
        }
      }
    };

    const drawEnemies = () => {
      const spriteCells: Record<ArenaEnemyKind, readonly [number, number]> = {
        drone: [0, 0],
        heavy: [1, 0],
        hunter: [0, 1],
        elite: [1, 1],
      };
      for (const enemy of enemies) {
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x) + Math.PI / 2;
        const size = enemy.radius * (enemy.kind === "elite" ? 2.45 : enemy.kind === "heavy" ? 2.5 : 2.28);
        context.save();
        context.globalAlpha = 0.34;
        context.fillStyle = "#000";
        context.beginPath();
        context.ellipse(enemy.x, enemy.y + enemy.radius * 0.52, enemy.radius * 0.9, enemy.radius * 0.42, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
        if (enemy.kind === "elite") {
          context.save();
          context.strokeStyle = ARENA_CONFIG.danger;
          context.lineWidth = 2;
          context.globalAlpha = 0.5 + Math.sin(elapsed * 4) * 0.2;
          context.beginPath();
          context.arc(enemy.x, enemy.y, enemy.radius * 1.35, 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }
        if (enemy.attackTimer < 320) {
          context.save();
          context.globalAlpha = 0.35 + (320 - enemy.attackTimer) / 640;
          context.strokeStyle = enemy.kind === "hunter" ? "#ff3bd4" : ARENA_CONFIG.danger;
          context.lineWidth = 2;
          context.beginPath();
          context.arc(enemy.x, enemy.y, enemy.radius * 1.28, 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }
        let drawn = false;
        if (enemyPackImage.complete && enemyPackImage.naturalWidth > 0) {
          const [column, row] = spriteCells[enemy.kind];
          const sourceWidth = enemyPackImage.naturalWidth / 2;
          const sourceHeight = enemyPackImage.naturalHeight / 2;
          context.save();
          context.translate(enemy.x, enemy.y);
          context.rotate(angle);
          context.globalAlpha = enemy.hitFlash > 0 ? 0.58 : 1;
          context.drawImage(
            enemyPackImage,
            column * sourceWidth,
            row * sourceHeight,
            sourceWidth,
            sourceHeight,
            -size / 2,
            -size / 2,
            size,
            size,
          );
          context.restore();
          drawn = true;
        }
        if (!drawn) {
          context.fillStyle = enemy.kind === "elite" ? ARENA_CONFIG.danger : "#d5d9df";
          context.beginPath();
          context.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
          context.fill();
        }
        if (enemy.kind === "heavy" || enemy.kind === "elite") {
          const barWidth = enemy.radius * 2;
          context.fillStyle = "rgba(0,0,0,0.7)";
          context.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 13, barWidth, 4);
          context.fillStyle = enemy.kind === "elite" ? ARENA_CONFIG.danger : "#ffffff";
          context.fillRect(
            enemy.x - barWidth / 2,
            enemy.y - enemy.radius - 13,
            barWidth * clamp(enemy.health / enemy.maxHealth, 0, 1),
            4,
          );
        }
      }
    };

    const drawPlayer = () => {
      const flicker = player.invulnerability > 0 && Math.floor(player.invulnerability / 70) % 2 === 0;
      context.save();
      context.fillStyle = "rgba(0,0,0,0.48)";
      context.beginPath();
      context.ellipse(player.x, player.y + 24, 26, 11, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = heroDefinition.accent;
      context.lineWidth = 2;
      context.globalAlpha = 0.5 + Math.sin(elapsed * 5) * 0.15;
      context.beginPath();
      context.arc(player.x, player.y, player.radius + 9, player.angle - 0.65, player.angle + 0.65);
      context.stroke();
      context.restore();
      if (!drawSprite(operatorImage, player.x, player.y - 4, 50, 72, 0, flicker ? 0.36 : 1)) {
        context.fillStyle = heroDefinition.accent;
        context.fillRect(player.x - 18, player.y - 18, 36, 36);
      }
    };

    const drawEntities = () => {
      for (const drop of drops) {
        const size = drop.radius * 2 + Math.sin(drop.pulse) * 2;
        if (!drawSprite(coreImage, drop.x, drop.y, size, size, drop.pulse * 0.25, 0.9)) {
          context.save();
          context.translate(drop.x, drop.y);
          context.rotate(Math.PI / 4);
          context.fillStyle = ARENA_CONFIG.accent;
          context.fillRect(-drop.radius, -drop.radius, drop.radius * 2, drop.radius * 2);
          context.restore();
        }
      }
      context.save();
      context.globalCompositeOperation = "lighter";
      for (const projectile of projectiles) {
        context.fillStyle = projectile.color;
        context.beginPath();
        context.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
        context.fill();
      }
      for (const projectile of enemyProjectiles) {
        const speed = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
        context.strokeStyle = projectile.color;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(projectile.x - (projectile.vx / speed) * 16, projectile.y - (projectile.vy / speed) * 16);
        context.lineTo(projectile.x, projectile.y);
        context.stroke();
        context.beginPath();
        context.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
        context.stroke();
      }
      for (const particle of particles) {
        context.globalAlpha = clamp(particle.life * 1.7, 0, 1);
        context.fillStyle = particle.color;
        context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
      }
      context.restore();
      drawEnemies();
      drawPlayer();
    };

    const drawMinimap = () => {
      if (width < 760) return;
      const mapWidth = 128;
      const mapHeight = 108;
      const left = width - mapWidth - 14;
      const top = height - mapHeight - 14;
      const radarRange = ARENA_CONFIG.world.radarRange;
      context.save();
      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
      context.fillStyle = "rgba(3,6,8,0.9)";
      context.fillRect(left, top, mapWidth, mapHeight);
      context.strokeStyle = "rgba(255,255,255,0.16)";
      context.strokeRect(left + 0.5, top + 0.5, mapWidth - 1, mapHeight - 1);
      context.strokeStyle = "rgba(0,242,255,0.12)";
      context.beginPath();
      context.arc(left + mapWidth / 2, top + mapHeight / 2, 36, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = "rgba(255,0,60,0.66)";
      for (let index = 0; index < enemies.length; index += 2) {
        const dx = enemies[index].x - player.x;
        const dy = enemies[index].y - player.y;
        if (Math.abs(dx) > radarRange || Math.abs(dy) > radarRange) continue;
        const radarX = left + mapWidth / 2 + (dx / radarRange) * (mapWidth * 0.42);
        const radarY = top + mapHeight / 2 + (dy / radarRange) * (mapHeight * 0.38);
        context.fillRect(radarX, radarY, 2, 2);
      }
      context.fillStyle = heroDefinition.accent;
      context.fillRect(left + mapWidth / 2 - 2, top + mapHeight / 2 - 2, 5, 5);
      context.fillStyle = "rgba(255,255,255,0.42)";
      context.font = "8px monospace";
      context.fillText("LOCAL RADAR", left + 8, top + 12);
      context.restore();
    };

    const drawTouchControl = () => {
      if (!touch.active) return;
      context.save();
      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
      context.globalAlpha = 0.55;
      context.strokeStyle = heroDefinition.accent;
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(touch.startX, touch.startY, 34, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = heroDefinition.accent;
      context.beginPath();
      context.arc(touch.startX + touch.dx * 28, touch.startY + touch.dy * 28, 9, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const drawFrame = () => {
      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
      context.fillStyle = "#020405";
      context.fillRect(0, 0, width, height);
      const shakeX = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake : 0;
      const shakeY = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake : 0;
      context.save();
      context.translate(width / 2 - camera.x + shakeX, height / 2 - camera.y + shakeY);
      drawArenaFloor();
      drawEntities();
      context.restore();
      drawMinimap();
      drawTouchControl();
      if (damageFlash > 0) {
        context.fillStyle = `rgba(255,0,60,${damageFlash})`;
        context.fillRect(0, 0, width, height);
      }
    };

    const commitHud = (time: number) => {
      if (time - lastHudCommit < 140) return;
      const elapsedProgress = clamp(elapsed / ARENA_CONFIG.durationSeconds, 0, 1);
      const currentWave = ARENA_WAVE_LABELS[waveIndex()];
      const activeLinks = Object.values(ranks).reduce((total, rank) => total + rank, 0);
      const chunkX = Math.floor(player.x / ARENA_CONFIG.world.chunkSize);
      const chunkY = Math.floor(player.y / ARENA_CONFIG.world.chunkSize);
      const districtHash = Math.abs(Math.imul(chunkX + 217, 73856093) ^ Math.imul(chunkY - 431, 19349663));
      const district = ARENA_DISTRICTS[districtHash % ARENA_DISTRICTS.length];
      setHud({
        ...EMPTY_ARENA_HUD,
        score,
        combo: kills,
        lives: Math.max(0, Math.ceil(player.health / Math.max(1, maxHealth / 4))),
        targetLabel: `${Math.max(0, ARENA_CONFIG.durationSeconds - elapsed).toFixed(1)}s · ${kills} KILLS`,
        progress: elapsedProgress,
        powerLabel: `LEVEL ${arenaLevel}`,
        powerProgress: clamp(arenaXp / Math.max(1, xpNeeded), 0, 1),
        sectionLabel: currentWave,
        modifierLabel: `${district.label} · ${activeLinks} LINKS`,
        modifierProgress: clamp(activeLinks / (ARENA_UPGRADES.length * 3), 0, 1),
        objectives: [
          `Survive: ${Math.max(0, ARENA_CONFIG.durationSeconds - elapsed).toFixed(1)}s`,
          `Integrity: ${Math.max(0, Math.ceil(player.health))}/${maxHealth}`,
          eliteSpawned ? "Elite signal active." : `Wave: ${currentWave}`,
        ],
      });
      lastHudCommit = time;
    };

    const frame = (time: number) => {
      animationFrame = window.requestAnimationFrame(frame);
      const deltaMs = Math.min(34, Math.max(0, time - lastFrame));
      lastFrame = time;
      if (active && !pausedInternal && !choosingUpgrade) {
        updateArena(deltaMs / 1000, deltaMs);
      }
      drawFrame();
      commitHud(time);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "p" || key === "escape") {
        togglePauseRef.current();
        return;
      }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        keys.add(key);
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      touch.pointerId = event.pointerId;
      touch.startX = event.clientX;
      touch.startY = event.clientY;
      touch.dx = 0;
      touch.dy = 0;
      touch.active = true;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!touch.active || event.pointerId !== touch.pointerId) return;
      const dx = event.clientX - touch.startX;
      const dy = event.clientY - touch.startY;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const strength = Math.min(1, distance / 54);
      touch.dx = (dx / distance) * strength;
      touch.dy = (dy / distance) * strength;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== touch.pointerId) return;
      touch.active = false;
      touch.dx = 0;
      touch.dy = 0;
      touch.pointerId = -1;
    };

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    spawnEnemy("drone");
    spawnEnemy("drone");
    animationFrame = window.requestAnimationFrame(frame);

    return () => {
      active = false;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      chooseUpgradeRef.current = () => undefined;
      togglePauseRef.current = () => undefined;
    };
  }, [
    addCredits,
    addMaterials,
    addScore,
    addXp,
    hero.accent,
    hero.archetype,
    missionStarted,
    mounted,
    restartKey,
    stats.craftedGear,
    stats.skills,
    storeHydrated,
    username,
  ]);

  if (!mounted || !storeHydrated || !username) return null;

  const restart = () => {
    setResult(null);
    setPaused(false);
    setMissionStarted(false);
    setUpgradeChoices(null);
    setHud(EMPTY_ARENA_HUD);
    setRestartKey((value) => value + 1);
  };

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#020405] text-white touch-none">
      <canvas ref={canvasRef} className="absolute inset-0 z-0 block outline-none" aria-label="Top-down arena gameplay" tabIndex={0} />

      {missionStarted && !result && (
        <GameHud
          hud={hud}
          ownedSkills={stats.skills}
          paused={paused}
          hideAbilities
          hideMapButton
          hideObjectives
          onAbort={() => router.push("/hub")}
          onOpenMap={() => undefined}
          onTogglePause={() => togglePauseRef.current()}
        />
      )}

      {!missionStarted && !result && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-cover bg-center px-4 py-8"
          style={{ backgroundImage: "linear-gradient(rgba(2,5,8,.7), rgba(2,5,8,.94)), url('/images/maps/arena/cyber-district-a.webp')" }}
        >
          <section className="my-auto w-full max-w-2xl border-y border-cyan-300/35 bg-[#05070a]/94 px-5 py-6 sm:px-8 sm:py-8">
            <div className="font-mono text-[8px] uppercase tracking-normal text-cyan-200/65">Mission briefing · {ARENA_CONFIG.levelTag}</div>
            <h1 className="mt-1 font-display text-3xl uppercase tracking-normal text-white sm:text-4xl">{ARENA_LEVEL_INTEL.title}</h1>
            <div className="mt-2 font-mono text-[9px] uppercase tracking-normal text-gray-400">{ARENA_LEVEL_INTEL.subtitle}</div>
            <div className="mt-6 border-y border-white/10 py-4">
              <div className="mb-3 flex items-center gap-2 font-mono text-[8px] uppercase tracking-normal text-gray-500">
                <Crosshair className="h-3.5 w-3.5 text-cyan-200" /> Objectives
              </div>
              <div className="space-y-2.5">
                {ARENA_LEVEL_INTEL.objectives.map((objective, index) => (
                  <div key={objective} className="flex items-start gap-3 font-mono text-[10px] leading-relaxed text-gray-200">
                    <span className="mt-0.5 text-cyan-200">0{index + 1}</span>
                    <span>{objective}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 font-mono text-[8px] uppercase tracking-normal text-gray-500">WASD / ARROWS · MOVE · AUTO FIRE · P / ESC · PAUSE</div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setMissionStarted(true)}
                className="flex-1 border border-cyan-300/55 bg-cyan-300/8 py-3 font-mono text-[10px] uppercase tracking-normal text-cyan-100 transition-colors hover:bg-cyan-300/15"
              >
                Start protocol
              </button>
              <button
                type="button"
                onClick={() => router.push("/hub")}
                className="flex items-center justify-center gap-2 border border-white/12 px-5 py-3 font-mono text-[9px] uppercase tracking-normal text-gray-400"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Control deck
              </button>
            </div>
          </section>
        </div>
      )}

      {paused && !result && !upgradeChoices && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/72 px-4">
          <div className="w-full max-w-sm border border-white/15 bg-[#05070a]/96 px-7 py-7 text-center">
            <div className="font-mono text-[8px] uppercase tracking-normal text-cyan-200/60">Arena simulation suspended</div>
            <div className="mt-1 font-display text-3xl uppercase tracking-normal text-white">PAUSED</div>
            <button
              type="button"
              onClick={() => togglePauseRef.current()}
              className="mt-6 w-full border border-cyan-300/45 bg-cyan-300/5 py-3 font-mono text-[10px] uppercase tracking-normal text-cyan-100"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      {upgradeChoices && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/84 p-4">
          <section className="my-auto w-full max-w-4xl border-y border-white/15 bg-[#05070a]/96 px-4 py-6 sm:px-7 sm:py-8">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="font-mono text-[8px] uppercase tracking-normal text-cyan-200/65">Neural link available</div>
                <h1 className="mt-1 font-display text-2xl uppercase tracking-normal text-white">CHOOSE SUPPORT</h1>
              </div>
              <div className="font-mono text-[9px] uppercase tracking-normal text-gray-500">Simulation paused</div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {upgradeChoices.map((upgrade) => {
                const Icon = UPGRADE_ICONS[upgrade.id];
                const rank = upgradeRanks[upgrade.id] ?? 0;
                return (
                  <button
                    key={upgrade.id}
                    type="button"
                    onClick={() => chooseUpgradeRef.current(upgrade.id)}
                    className="group min-h-44 border border-white/12 bg-black/45 p-4 text-left transition-colors hover:bg-white/[0.035]"
                    style={{ borderColor: `${upgrade.color}66` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-10 w-10 items-center justify-center border" style={{ borderColor: `${upgrade.color}88`, color: upgrade.color }}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">Rank {rank + 1}/{ARENA_CONFIG.progression.maxUpgradeRank}</div>
                    </div>
                    <div className="mt-5 font-mono text-[8px] uppercase tracking-normal" style={{ color: upgrade.color }}>{upgrade.branch}</div>
                    <div className="mt-1 font-display text-lg uppercase tracking-normal text-white">{upgrade.label}</div>
                    <div className="mt-2 font-mono text-[9px] leading-relaxed text-gray-400">{upgrade.description}</div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {result && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/90 p-4">
          <section className="w-full max-w-lg border border-white/15 bg-[#05070a]/98 p-6 sm:p-8">
            <div className="font-mono text-[8px] uppercase tracking-normal" style={{ color: result.success ? ARENA_CONFIG.support : ARENA_CONFIG.danger }}>
              {result.success ? "Simulation complete" : "Neural link severed"}
            </div>
            <h1 className="mt-1 font-display text-3xl uppercase tracking-normal text-white">
              {result.success ? "ARENA SECURED" : "SYSTEM COLLAPSE"}
            </h1>
            <div className="mt-6 grid grid-cols-3 border-y border-white/10 py-4 text-center">
              <div><div className="font-display text-xl text-white">{result.score}</div><div className="font-mono text-[7px] text-gray-500">SCORE</div></div>
              <div className="border-x border-white/10"><div className="font-display text-xl text-white">{result.kills}</div><div className="font-mono text-[7px] text-gray-500">KILLS</div></div>
              <div><div className="font-display text-xl text-white">{result.level}</div><div className="font-mono text-[7px] text-gray-500">BUILD LVL</div></div>
            </div>
            {result.success && (
              <div className="mt-4 flex items-center gap-2 border border-emerald-300/20 bg-emerald-300/5 px-3 py-3 font-mono text-[8px] uppercase tracking-normal text-emerald-200">
                <Check className="h-3.5 w-3.5" /> Rewards linked to operative profile
              </div>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={restart} className="flex-1 border border-cyan-300/45 bg-cyan-300/5 py-3 font-mono text-[9px] uppercase tracking-normal text-cyan-100">Run again</button>
              <button type="button" onClick={() => router.push("/hub")} className="flex flex-1 items-center justify-center gap-2 border border-white/12 py-3 font-mono text-[9px] uppercase tracking-normal text-gray-300">
                <ArrowLeft className="h-3.5 w-3.5" /> Control deck
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
