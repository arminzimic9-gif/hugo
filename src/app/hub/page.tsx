"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring } from "framer-motion";
import {
  Activity,
  Award,
  Boxes,
  ChevronRight,
  CircleDot,
  Cpu,
  Crosshair,
  Gauge,
  Hammer,
  LockKeyhole,
  LogOut,
  MousePointer2,
  Play,
  Radio,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Wrench,
} from "lucide-react";
import { LEVELS_PER_SECTOR, getSectorForLevel, useGameStore } from "@/store/gameStore";
import { getLevelIntel } from "@/data/progression";
import { ACHIEVEMENTS } from "@/data/achievements";
import { HEROES, HERO_ARCHETYPES, getHeroDefinition } from "@/data/heroes";
import { ARENA_OPERATORS } from "@/data/arenaOperators";
import { ARENA_GEAR_CATALOG, ARENA_GEAR_RARITIES, ARENA_GEAR_SLOTS, type ArenaGearSlot } from "@/data/arenaGear";
import { CRAFTING_RECIPES_BY_ID, MATERIALS } from "@/data/crafting";
import { ARENA_PILOTS, ARENA_PILOT_BODIES } from "@/data/arenaPilots";
import { ARENA_CLASSES, ARTIFACT_WEAPONS, getArtifactPowerThreshold } from "@/data/arenaProgression";
import {
  ARENA_CONFIG,
  ARENA_LEVEL_INTEL,
  ARENA_TEST_LEVEL,
  ARENA_TEST_SECTOR_ID,
} from "@/data/arena";
import TelemetryRing from "@/components/game/TelemetryRing";

const OperativeModel = dynamic(() => import("@/components/game/OperativeModel"), {
  ssr: false,
});

type SectorCard = {
  id: number;
  name: string;
  color: string;
  levels: string;
  descriptor: string;
  isTesting?: boolean;
  testLevel?: number;
  levelPrefix?: string;
  route?: string;
};

type ControlDeckView = "missions" | "classes" | "gear" | "systems" | "awards";

const SECTORS: SectorCard[] = [
  {
    id: ARENA_TEST_SECTOR_ID,
    name: ARENA_CONFIG.name,
    color: ARENA_CONFIG.accent,
    levels: ARENA_CONFIG.levelTag,
    descriptor: ARENA_CONFIG.descriptor,
    isTesting: true,
    testLevel: ARENA_TEST_LEVEL,
    levelPrefix: "A",
    route: "/arena",
  },
];

const CONTROL_DECK_VIEWS: Array<{
  id: ControlDeckView;
  label: string;
  icon: typeof Radio;
}> = [
  { id: "missions", label: "MISSIONS", icon: Radio },
  { id: "classes", label: "CLASSES", icon: Swords },
  { id: "gear", label: "GEAR", icon: Boxes },
  { id: "systems", label: "SYSTEMS", icon: Cpu },
  { id: "awards", label: "AWARDS", icon: Trophy },
];

const GEAR_SLOT_META: Record<ArenaGearSlot, { label: string; Icon: typeof Swords }> = {
  head: { label: "HEAD", Icon: CircleDot },
  torso: { label: "TORSO", Icon: Shield },
  arms: { label: "ARMS", Icon: Wrench },
  legs: { label: "LEGS", Icon: Gauge },
  core: { label: "CORE", Icon: Cpu },
  weapon: { label: "ARTIFACT MOD", Icon: Swords },
};

const sectorFirstLevel = (sectorId: number) =>
  sectorId === ARENA_TEST_SECTOR_ID
    ? ARENA_TEST_LEVEL
    : (sectorId - 1) * LEVELS_PER_SECTOR + 1;

export default function NeuralHub() {
  const {
    username,
    stats,
    hero,
    pilotBody,
    currentCampaignLevel,
    logout,
    setSector,
    setReplayLevel,
    setHeroProfile,
    setPilotBody,
    equipArenaGear,
  } = useGameStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeView, setActiveView] = useState<ControlDeckView>("missions");
  const [selectedSectorId, setSelectedSectorId] = useState(ARENA_TEST_SECTOR_ID);
  const [selectedLevel, setSelectedLevel] = useState(ARENA_TEST_LEVEL);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const heroX = useSpring(pointerX, { stiffness: 70, damping: 22, mass: 0.7 });
  const heroY = useSpring(pointerY, { stiffness: 70, damping: 22, mass: 0.7 });

  useEffect(() => {
    setMounted(true);
    if (!username) router.push("/");
  }, [username, router]);

  const unlockedSectors = useMemo(
    () => new Set([ARENA_TEST_SECTOR_ID]),
    []
  );
  const unlockedOperators = useMemo(
    () => new Set(stats.unlockedOperators ?? ["vanguard"]),
    [stats.unlockedOperators]
  );
  const activeSector = SECTORS.find((sector) => sector.id === selectedSectorId) ?? SECTORS[0];
  const activeHero = getHeroDefinition(hero.archetype);
  const activeClass = ARENA_CLASSES[hero.archetype];
  const activeArtifactDefinition = ARTIFACT_WEAPONS[hero.archetype];
  const activeArtifact = stats.artifactWeapons[hero.archetype];
  const activePilot = ARENA_PILOTS[pilotBody];
  const campaignMaxLevel = Math.min(stats.maxLevelReached ?? 1, 5 * LEVELS_PER_SECTOR);
  const completedLevels = stats.completedLevels ?? [];
  const unlockedAchievements = stats.achievements ?? [];
  const craftedCount = stats.craftedGear?.length ?? 0;
  const activeLoadout = stats.arenaLoadouts[hero.archetype];
  const equippedGearCount = ARENA_GEAR_SLOTS.reduce(
    (count, slot) => count + (activeLoadout[slot] ? 1 : 0),
    0
  );
  const materialInventory = stats.materials ?? {};
  const totalMaterials = MATERIALS.reduce((total, material) => total + (materialInventory[material.id] ?? 0), 0);
  const xpPercentage = Math.max(0, Math.min(100, (stats.xp / (1000 * stats.level)) * 100));
  const activeIntel = activeSector.id === ARENA_TEST_SECTOR_ID
    ? ARENA_LEVEL_INTEL
    : getLevelIntel(selectedLevel, ((selectedLevel - 1) % LEVELS_PER_SECTOR) + 1);

  const levelOptions = useMemo(() => {
    if (activeSector.isTesting) return [sectorFirstLevel(activeSector.id)];
    const first = sectorFirstLevel(activeSector.id);
    return Array.from({ length: LEVELS_PER_SECTOR }, (_, index) => first + index);
  }, [activeSector]);

  if (!mounted || !username) return null;

  const isLevelReachable = (level: number) =>
    activeSector.isTesting ||
    activeSector.id === 99 ||
    level <= campaignMaxLevel ||
    completedLevels.includes(level);

  const chooseSector = (sector: SectorCard) => {
    if (!unlockedSectors.has(sector.id)) return;
    setSelectedSectorId(sector.id);
    if (sector.isTesting) {
      setSelectedLevel(sector.testLevel ?? sectorFirstLevel(sector.id));
      return;
    }
    const first = sectorFirstLevel(sector.id);
    const currentBelongsHere = getSectorForLevel(currentCampaignLevel) === sector.id;
    setSelectedLevel(currentBelongsHere ? currentCampaignLevel : first);
  };

  const deploy = () => {
    setSector(activeSector.id);
    setReplayLevel(selectedLevel);
    router.push("/arena");
  };

  const trackOperative = (event: React.PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 12);
    pointerY.set(((event.clientY - bounds.top) / bounds.height - 0.5) * 8);
  };

  const resetOperativePosition = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const levelTag = activeSector.isTesting
    ? `${activeSector.levelPrefix ?? "T"}01`
    : activeSector.id === 99
      ? `B${String(((selectedLevel - 1) % LEVELS_PER_SECTOR) + 1).padStart(2, "0")}`
      : `L${String(selectedLevel).padStart(2, "0")}`;

  const systemStats = [
    { label: "POWER", value: Math.min(96, 42 + stats.level * 3 + stats.skills.length * 2), icon: Swords },
    { label: "DEFENSE", value: Math.min(94, 34 + equippedGearCount * 8), icon: Shield },
    { label: "CONTROL", value: Math.min(98, 48 + stats.level * 2 + Math.min(20, stats.skills.length)), icon: Crosshair },
    { label: "MOBILITY", value: Math.min(99, 52 + equippedGearCount * 5 + stats.level * 2), icon: Gauge },
  ];

  const missionPreviewImage = activeSector.id === 1 || activeSector.id === ARENA_TEST_SECTOR_ID
    ? "/images/maps/cyberia/city-run-bg.webp"
    : activeSector.id === 99 || activeSector.isTesting
      ? "/images/maps/cyberia/chaos-intro-bg.webp"
      : null;

  return (
    <main
      className="relative min-h-screen overflow-y-auto bg-[#020405] text-white lg:h-screen lg:overflow-hidden"
      style={{ "--sector-accent": activeSector.color } as React.CSSProperties}
      onPointerMove={activeView === "classes" ? trackOperative : undefined}
      onPointerLeave={activeView === "classes" ? resetOperativePosition : undefined}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/34" />
      <div className="pointer-events-none absolute inset-0 opacity-20 scanlines" />

      <header className="relative z-20 border-b border-white/10 bg-[#020405]/96">
        <div className="flex min-h-20 flex-wrap items-center justify-between gap-x-4 px-4 py-3 md:flex-nowrap md:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-cyan-300/35 bg-cyan-300/5">
              <CircleDot className="h-5 w-5 text-cyan-200" />
            </div>
            <div>
              <div className="font-display text-lg tracking-normal text-white">HUGO</div>
              <div className="font-mono text-[8px] uppercase tracking-normal text-cyan-200/70">
                Control Deck / {activeView}
              </div>
            </div>
          </div>

          <nav className="order-3 mt-3 grid w-full grid-cols-5 border border-white/10 md:order-none md:mt-0 md:w-auto md:min-w-[500px]" aria-label="Control Deck sections">
            {CONTROL_DECK_VIEWS.map(({ id, label, icon: Icon }) => {
              const selected = activeView === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveView(id)}
                  aria-pressed={selected}
                  className="relative flex h-10 min-w-0 items-center justify-center gap-2 border-r border-white/10 px-2 font-mono text-[8px] uppercase tracking-normal text-gray-500 transition-colors last:border-r-0 hover:text-white"
                  style={{ color: selected ? activeSector.color : undefined, background: selected ? `${activeSector.color}10` : undefined }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                  {selected && <span className="absolute inset-x-0 bottom-0 h-px" style={{ background: activeSector.color }} />}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">Operative online</div>
              <div className="font-mono text-xs uppercase tracking-normal text-white">{hero.codename}</div>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Disconnect"
              aria-label="Disconnect"
              className="flex h-10 w-10 items-center justify-center border border-white/10 bg-black/60 text-gray-400 transition-colors hover:border-red-400/60 hover:text-red-300"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 min-h-[calc(100vh-116px)] lg:h-[calc(100vh-80px)] lg:min-h-0">
        {activeView === "missions" && (
          <motion.section
            key="missions"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            className="grid min-h-[calc(100vh-116px)] grid-cols-1 lg:h-full lg:min-h-0 lg:grid-cols-[310px_minmax(360px,1fr)_340px] xl:grid-cols-[330px_minmax(460px,1fr)_370px]"
          >
            <aside className="border-r border-white/10 bg-black/78 p-4 lg:overflow-y-auto lg:p-5 app-scroll">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">Available systems</div>
                  <h1 className="mt-1 font-display text-xl tracking-normal">MISSIONS</h1>
                </div>
                <Radio className="h-4 w-4 text-cyan-200" />
              </div>

              <div className="space-y-1.5">
                {SECTORS.map((sector, index) => {
                  const locked = !unlockedSectors.has(sector.id);
                  const active = sector.id === activeSector.id;
                  return (
                    <button
                      key={sector.id}
                      type="button"
                      onClick={() => chooseSector(sector)}
                      disabled={locked}
                      className="group relative flex w-full items-center gap-3 border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                      style={{
                        borderColor: active ? `${sector.color}99` : "rgba(255,255,255,0.08)",
                        background: active ? `${sector.color}16` : "rgba(0,0,0,0.48)",
                      }}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center border font-mono text-[10px]"
                        style={{ borderColor: active ? sector.color : "rgba(255,255,255,0.12)", color: locked ? "#555" : sector.color }}
                      >
                        {locked ? <LockKeyhole className="h-3.5 w-3.5" /> : String(index + 1).padStart(2, "0")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[11px] uppercase tracking-normal text-white">{sector.name}</div>
                        <div className="mt-0.5 truncate font-mono text-[8px] uppercase tracking-normal text-gray-500">
                          {sector.descriptor} / {sector.levels}
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 ${active ? "text-white" : "text-gray-700"}`} />
                      {active && <span className="absolute inset-y-0 left-0 w-px" style={{ background: sector.color }} />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">Select level</div>
                  <div className="font-mono text-[9px] text-white">{activeSector.levels}</div>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {levelOptions.map((level, index) => {
                    const reachable = isLevelReachable(level);
                    const completed = completedLevels.includes(level);
                    const selected = level === selectedLevel;
                    const tag = activeSector.isTesting
                      ? `${activeSector.levelPrefix ?? "T"}1`
                      : activeSector.id === 99
                        ? `B${index + 1}`
                        : String(index + 1).padStart(2, "0");
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => reachable && setSelectedLevel(level)}
                        disabled={!reachable}
                        title={activeSector.isTesting ? "Testing Boss" : `Level ${level}`}
                        className="aspect-square min-w-0 border font-mono text-[9px] transition-colors disabled:cursor-not-allowed"
                        style={{
                          borderColor: selected ? activeSector.color : completed ? `${activeSector.color}66` : "rgba(255,255,255,0.1)",
                          color: selected || completed ? activeSector.color : reachable ? "#c6cbd2" : "#34383d",
                          background: selected ? `${activeSector.color}1f` : "rgba(0,0,0,0.48)",
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            <section className="relative isolate min-h-[520px] overflow-hidden bg-[#030607] lg:min-h-0">
              {missionPreviewImage && (
                <Image
                  key={missionPreviewImage}
                  src={missionPreviewImage}
                  alt={`${activeSector.name} mission environment`}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover opacity-80"
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-black/30" />
              <div className="pointer-events-none absolute inset-0 opacity-25 scanlines" />

              <div className="absolute left-5 top-5 border-l pl-3 lg:left-7 lg:top-7" style={{ borderColor: activeSector.color }}>
                <div className="font-mono text-[8px] uppercase tracking-normal" style={{ color: activeSector.color }}>Mission environment</div>
                <div className="font-display text-lg uppercase tracking-normal text-white">{activeSector.name}</div>
                <div className="font-mono text-[8px] uppercase tracking-normal text-gray-400">{activeSector.descriptor}</div>
              </div>

              <motion.div
                key={`${activeSector.id}-${selectedLevel}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#020405]/92 px-5 py-5 lg:px-7"
              >
                <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-normal" style={{ color: activeSector.color }}>
                  <Target className="h-3.5 w-3.5" /> {activeSector.name} / {levelTag}
                </div>
                <div className="mt-1 break-words font-display text-2xl uppercase tracking-normal text-white md:text-3xl">{activeIntel.title}</div>
                <div className="mt-1 font-mono text-[10px] text-gray-400">{activeIntel.subtitle}</div>
              </motion.div>
            </section>

            <aside className="border-l border-white/10 bg-black/78 p-5 lg:overflow-y-auto lg:p-6 app-scroll">
              <div className="border-b border-white/10 pb-5">
                <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">Mission briefing</div>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <div>
                    <div className="font-display text-2xl uppercase tracking-normal text-white">{activeIntel.title}</div>
                    <div className="font-mono text-[9px] uppercase tracking-normal" style={{ color: activeSector.color }}>{activeSector.name} / {levelTag}</div>
                  </div>
                  <div className="font-display text-4xl leading-none text-white">{String(((selectedLevel - 1) % LEVELS_PER_SECTOR) + 1).padStart(2, "0")}</div>
                </div>
              </div>

              <div className="border-b border-white/10 py-5">
                <div className="mb-3 font-mono text-[8px] uppercase tracking-normal text-gray-500">Objectives</div>
                <div className="space-y-3">
                  {activeIntel.objectives.slice(0, 4).map((objective, index) => (
                    <div key={objective} className="flex items-start gap-3 font-mono text-[10px] leading-relaxed text-gray-300">
                      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center border text-[7px]" style={{ borderColor: `${activeSector.color}88`, color: activeSector.color }}>
                        {index + 1}
                      </span>
                      <span>{objective}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-b border-white/10 py-5">
                <div className="mb-2 flex items-center justify-between font-mono text-[8px] uppercase tracking-normal text-gray-500">
                  <span>Arena state</span>
                  <span>
                    {activeSector.isTesting
                      ? "READY"
                      : `${completedLevels.filter((level) => getSectorForLevel(level) === activeSector.id).length}/${LEVELS_PER_SECTOR}`}
                  </span>
                </div>
                <div className="h-1 bg-white/10">
                  <div
                    className="h-full"
                    style={{
                      width: activeSector.isTesting
                        ? "100%"
                        : `${Math.min(100, (completedLevels.filter((level) => getSectorForLevel(level) === activeSector.id).length / LEVELS_PER_SECTOR) * 100)}%`,
                      background: activeSector.color,
                    }}
                  />
                </div>
              </div>

              <div className="py-5">
                <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">Active class</div>
                <div className="mt-2 flex items-center justify-between border border-white/10 bg-black/50 px-3 py-3">
                  <div>
                    <div className="font-mono text-[10px] text-white">{activeHero.label}</div>
                    <div className="font-mono text-[8px] text-gray-500">{activeHero.role}</div>
                  </div>
                  <button type="button" onClick={() => setActiveView("classes")} className="font-mono text-[8px] uppercase tracking-normal text-cyan-200 hover:text-white">
                    Change
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={deploy}
                className="group flex w-full items-center justify-between border px-4 py-4 text-left transition-colors"
                style={{ borderColor: activeSector.color, background: `${activeSector.color}16` }}
              >
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-normal" style={{ color: activeSector.color }}>Launch sequence</div>
                  <div className="mt-1 font-display text-xl uppercase tracking-normal text-white">Deploy</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center" style={{ background: activeSector.color, color: "#030405" }}>
                  <Play className="h-5 w-5 fill-current" />
                </div>
              </button>
            </aside>
          </motion.section>
        )}

        {activeView === "classes" && (
          <motion.section
            key="classes"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            className="grid min-h-[calc(100vh-116px)] grid-cols-1 lg:h-full lg:min-h-0 lg:grid-cols-[300px_minmax(360px,1fr)_360px] xl:grid-cols-[330px_minmax(460px,1fr)_390px]"
          >
            <aside className="border-r border-white/10 bg-black/78 p-4 lg:overflow-y-auto lg:p-5 app-scroll">
              <div className="mb-5">
                <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">Available protocols</div>
                <h1 className="mt-1 font-display text-xl uppercase tracking-normal">CLASSES</h1>
              </div>
              <div className="space-y-2">
                {HERO_ARCHETYPES.map((archetype) => {
                  const definition = HEROES[archetype];
                  const selected = hero.archetype === archetype;
                  const unlocked = unlockedOperators.has(archetype);
                  return (
                    <button
                      key={archetype}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => {
                        if (unlocked) {
                          setHeroProfile({ codename: hero.codename, archetype, accent: definition.accent });
                        }
                      }}
                      className="relative flex w-full items-center gap-3 border p-2 text-left transition-colors"
                      style={{
                        borderColor: selected ? definition.accent : "rgba(255,255,255,0.1)",
                        background: selected ? `${definition.accent}12` : "rgba(0,0,0,0.45)",
                        opacity: unlocked ? 1 : 0.42,
                      }}
                    >
                      <div className="relative flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden bg-black">
                        <span className="font-display text-3xl" style={{ color: definition.accent }}>
                          {definition.label.slice(0, 1)}
                        </span>
                        {!unlocked ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                            <LockKeyhole className="h-5 w-5 text-white/70" />
                          </div>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-base uppercase tracking-normal text-white">{definition.label}</div>
                        <div className="mt-1 truncate font-mono text-[8px] uppercase tracking-normal" style={{ color: definition.accent }}>{ARENA_OPERATORS[archetype].weaponName}</div>
                        <div className="mt-1 truncate font-mono text-[8px] text-gray-500">
                          {unlocked
                            ? definition.role
                            : `UNLOCK · RUN ${ARENA_OPERATORS[archetype].unlockRun}`}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: selected ? definition.accent : "#3b4048" }} />
                      {selected && <span className="absolute inset-y-0 left-0 w-px" style={{ background: definition.accent }} />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 border-t border-white/10 pt-5">
                <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">Class filter</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {["S", "A", "B"].map((rank, index) => (
                    <div key={rank} className={`flex h-9 items-center justify-center border font-mono text-[9px] ${index === 0 ? "border-white/25 text-white" : "border-white/8 text-gray-700"}`}>
                      {rank}
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <section className="relative isolate min-h-[620px] overflow-hidden bg-[#030607] lg:min-h-0">
              <motion.div key={hero.archetype} className="pointer-events-none absolute -inset-3" style={{ x: heroX, y: heroY }}>
                <div className="operative-signal-in absolute inset-0">
                  <OperativeModel
                    modelUrl={activePilot.model}
                    accent={activeHero.accent}
                    label={`${activePilot.label} · ${activeHero.label}`}
                    fallbackImage={activePilot.image}
                  />
                </div>
              </motion.div>
              <TelemetryRing accent={hero.accent} className="left-1/2 top-[47%] z-[1] -translate-x-1/2 -translate-y-1/2" />
              <div className="pointer-events-none absolute inset-0 z-[2] bg-black/8" />
              <div className="pointer-events-none absolute inset-0 z-[2] opacity-24 scanlines" />

              <div className="absolute left-5 top-5 z-10 border-l pl-3 lg:left-7 lg:top-7" style={{ borderColor: hero.accent }}>
                <div className="font-mono text-[8px] uppercase tracking-normal" style={{ color: hero.accent }}>Active pilot class</div>
                <div className="font-display text-xl uppercase tracking-normal text-white">{activePilot.label}</div>
                <div className="font-mono text-[8px] uppercase tracking-normal text-gray-400">{activeHero.label} / {activeHero.role}</div>
              </div>

              <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/10 bg-[#020405]/90 px-5 py-5 lg:px-7">
                <div className="font-mono text-[8px] uppercase tracking-normal" style={{ color: hero.accent }}>Class profile</div>
                <div className="mt-2 max-w-2xl font-mono text-[10px] leading-relaxed text-gray-300">{activeHero.lore}</div>
              </div>
            </section>

            <aside className="border-l border-white/10 bg-black/78 p-5 lg:overflow-y-auto lg:p-6 app-scroll">
              <div className="flex items-start justify-between border-b border-white/10 pb-5">
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">Operative class</div>
                  <div className="mt-1 font-display text-2xl uppercase tracking-normal text-white">{activeHero.label}</div>
                  <div className="font-mono text-[9px] uppercase tracking-normal" style={{ color: hero.accent }}>{activeHero.role}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-6xl leading-none text-white">{stats.level}</div>
                  <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">Level</div>
                </div>
              </div>

              <div className="py-5">
                <div className="mb-2 flex items-center justify-between font-mono text-[8px] uppercase tracking-normal text-gray-500">
                  <span>Neural sync</span>
                  <span>{Math.floor(xpPercentage)}%</span>
                </div>
                <div className="h-1 bg-white/10">
                  <motion.div className="h-full" initial={{ width: 0 }} animate={{ width: `${xpPercentage}%` }} style={{ background: hero.accent }} />
                </div>
              </div>

              <div className="space-y-3 border-y border-white/10 py-5">
                {systemStats.map(({ label, value, icon: Icon }) => (
                  <div key={label}>
                    <div className="mb-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-normal text-gray-400">
                      <span className="flex items-center gap-2"><Icon className="h-3 w-3" /> {label}</span>
                      <span className="text-white">{value}</span>
                    </div>
                    <div className="h-1 bg-white/10">
                      <motion.div className="h-full" initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.45 }} style={{ background: value > 80 ? hero.accent : "#d5d9df" }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-b border-white/10 py-5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-white/10 bg-black/45 p-3">
                    <div className="font-mono text-[7px] text-gray-500">ARCHETYPE</div>
                    <div className="mt-1 font-display text-sm" style={{ color: activeClass.accent }}>{activeClass.fantasy}</div>
                  </div>
                  <div className="border border-white/10 bg-black/45 p-3">
                    <div className="font-mono text-[7px] text-gray-500">CLASS RESOURCE</div>
                    <div className="mt-1 font-display text-sm" style={{ color: activeClass.accent }}>{activeClass.resource}</div>
                  </div>
                </div>
                <div className="mt-3 space-y-3 font-mono text-[8px] leading-relaxed">
                  <div><span className="text-gray-500">RESOURCE RULE</span><br /><span className="text-gray-300">{activeClass.resourceRule}</span></div>
                  <div><span className="text-gray-500">SIGNATURE</span><br /><span className="text-gray-300">{activeClass.signature}</span></div>
                  <div><span className="text-gray-500">PASSIVE</span><br /><span className="text-gray-300">{activeClass.passive}</span></div>
                  <div><span className="text-gray-500">WEAKNESS</span><br /><span className="text-gray-300">{activeClass.weakness}</span></div>
                </div>
                <div className="mt-4 border border-white/10 bg-black/45 p-3">
                  <div className="flex items-center justify-between font-mono text-[7px] text-gray-500">
                    <span>{activeArtifactDefinition.name}</span><span>TIER {activeArtifact.tier}/3</span>
                  </div>
                  <div className="mt-2 h-1 bg-white/10">
                    <div className="h-full" style={{ width: `${Math.min(100, (activeArtifact.power / getArtifactPowerThreshold(activeArtifact)) * 100)}%`, background: activeArtifactDefinition.color }} />
                  </div>
                  <button type="button" onClick={() => router.push("/skills")} className="mt-3 font-mono text-[8px]" style={{ color: activeArtifactDefinition.color }}>
                    OPEN SKILL & ARTIFACT MATRIX →
                  </button>
                </div>
              </div>

              <div className="py-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">System modules</div>
                  <div className="font-mono text-[8px] text-gray-400">{stats.skills.length} ACTIVE</div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[Activity, Shield, Crosshair, Sparkles].map((Icon, index) => (
                    <div key={index} className="flex aspect-square items-center justify-center border bg-black/50" style={{ borderColor: index < Math.min(4, stats.skills.length) ? `${hero.accent}88` : "rgba(255,255,255,0.1)" }}>
                      <Icon className="h-4 w-4" style={{ color: index < stats.skills.length ? hero.accent : "#4b5058" }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10 py-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">Arena loadout</div>
                  <div className="font-mono text-[8px] text-gray-400">{equippedGearCount}/{ARENA_GEAR_SLOTS.length} EQUIPPED</div>
                </div>
                <div className="space-y-3">
                  {ARENA_GEAR_SLOTS.map((slot) => {
                    const { label, Icon } = GEAR_SLOT_META[slot];
                    const equippedId = activeLoadout[slot];
                    const equippedDefinition = equippedId ? ARENA_GEAR_CATALOG[equippedId] : null;
                    const equippedRarity = equippedDefinition
                      ? ARENA_GEAR_RARITIES[equippedDefinition.rarity]
                      : null;
                    const candidates = (stats.craftedGear ?? []).filter(
                      (id) => ARENA_GEAR_CATALOG[id].slot === slot
                    );
                    return (
                      <div key={slot} className="border border-white/10 bg-black/45 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 font-mono text-[8px] text-gray-500">
                            <Icon className="h-3.5 w-3.5" /> {label}
                          </span>
                          <span
                            className="truncate font-mono text-[8px]"
                            style={{ color: equippedRarity?.color ?? "#4b5058" }}
                          >
                            {equippedId ? CRAFTING_RECIPES_BY_ID[equippedId].name : "EMPTY"}
                          </span>
                        </div>
                        {candidates.length > 0 ? (
                          <div className="mt-2 grid grid-cols-1 gap-1.5">
                            {candidates.map((id) => {
                              const definition = ARENA_GEAR_CATALOG[id];
                              const rarity = ARENA_GEAR_RARITIES[definition.rarity];
                              const selected = equippedId === id;
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => equipArenaGear(hero.archetype, slot, selected ? null : id)}
                                  className="flex items-center justify-between gap-2 border px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
                                  style={{
                                    borderColor: selected ? rarity.color : "rgba(255,255,255,.08)",
                                    background: selected ? `${rarity.color}10` : "transparent",
                                  }}
                                >
                                  <span className="truncate font-mono text-[8px] text-white">
                                    {CRAFTING_RECIPES_BY_ID[id].name}
                                  </span>
                                  <span className="shrink-0 font-mono text-[7px]" style={{ color: rarity.color }}>
                                    {rarity.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-2 font-mono text-[8px] leading-relaxed text-gray-600">
                            Craft compatible gear in Systems.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveView("missions")}
                className="mt-2 flex w-full items-center justify-between border px-4 py-4 text-left"
                style={{ borderColor: hero.accent, background: `${hero.accent}12` }}
              >
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-normal" style={{ color: hero.accent }}>Pilot synced</div>
                  <div className="mt-1 font-display text-lg uppercase tracking-normal text-white">Arena select</div>
                </div>
                <ChevronRight className="h-5 w-5" style={{ color: hero.accent }} />
              </button>
            </aside>
          </motion.section>
        )}

        {activeView === "gear" && (
          <motion.section
            key="gear"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            className="grid min-h-[calc(100vh-116px)] grid-cols-1 lg:h-full lg:min-h-0 lg:grid-cols-[300px_minmax(360px,1fr)_390px]"
          >
            <aside className="border-r border-white/10 bg-black/78 p-5 lg:overflow-y-auto app-scroll">
              <div className="border-b border-white/10 pb-5">
                <div className="font-mono text-[8px] uppercase tracking-normal text-cyan-200/65">Human operator</div>
                <h1 className="mt-1 font-display text-2xl uppercase tracking-normal text-white">PILOT</h1>
                <div className="mt-2 font-mono text-[9px] leading-relaxed text-gray-500">
                  The human pilot is permanent. Crafted gear improves combat stats without replacing the pilot body.
                </div>
              </div>

              <div className="space-y-2 py-5">
                {ARENA_PILOT_BODIES.map((body) => {
                  const pilot = ARENA_PILOTS[body];
                  const selected = pilotBody === body;
                  return (
                    <button
                      key={body}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setPilotBody(body)}
                      className="flex w-full items-center gap-3 border bg-black/45 p-2 text-left transition-colors"
                      style={{ borderColor: selected ? hero.accent : "rgba(255,255,255,.1)" }}
                    >
                      <span className="relative h-20 w-16 shrink-0 overflow-hidden bg-black">
                        <Image src={pilot.image} alt="" fill sizes="64px" className="object-cover object-top" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-display text-sm tracking-[0.12em] text-white">{pilot.label}</span>
                        <span className="mt-1 block font-mono text-[7px] leading-relaxed text-gray-500">{pilot.descriptor}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="border-y border-white/10 py-5">
                <div className="flex items-center justify-between font-mono text-[8px] text-gray-500">
                  <span>LOADOUT SYNC</span>
                  <span style={{ color: hero.accent }}>{equippedGearCount}/{ARENA_GEAR_SLOTS.length}</span>
                </div>
                <div className="mt-3 h-1 bg-white/10">
                  <motion.div
                    className="h-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(equippedGearCount / ARENA_GEAR_SLOTS.length) * 100}%` }}
                    style={{ background: hero.accent, boxShadow: `0 0 12px ${hero.accent}` }}
                  />
                </div>
                <div className="mt-3 font-mono text-[8px] leading-relaxed text-gray-500">
                  {equippedGearCount === ARENA_GEAR_SLOTS.length
                    ? `${activePilot.label} has a complete combat loadout.`
                    : "The pilot remains human while equipped gear adds permanent arena modifiers."}
                </div>
              </div>

              <div className="pt-5">
                <div className="font-mono text-[8px] text-gray-500">BOSS ARTIFACTS</div>
                <div className="mt-2 space-y-1.5">
                  {(stats.bossArtifacts ?? []).length ? (
                    stats.bossArtifacts.map((artifact) => (
                      <div key={artifact} className="border border-amber-300/25 bg-amber-300/5 px-3 py-2 font-mono text-[8px] text-amber-200">
                        {artifact.replaceAll("_", " ").toUpperCase()}
                      </div>
                    ))
                  ) : (
                    <div className="font-mono text-[8px] leading-relaxed text-gray-600">Defeat Arena bosses to recover class and combat technology.</div>
                  )}
                </div>
              </div>
            </aside>

            <section className="relative isolate min-h-[610px] overflow-hidden bg-[#030607] lg:min-h-0">
              <div className="absolute inset-0 operative-signal-in">
                <OperativeModel
                  modelUrl={activePilot.model}
                  accent={hero.accent}
                  label={activePilot.label}
                  fallbackImage={activePilot.image}
                />
              </div>
              <TelemetryRing accent={hero.accent} className="left-1/2 top-[48%] z-[1] -translate-x-1/2 -translate-y-1/2" />
              <div className="pointer-events-none absolute inset-0 z-[2] opacity-20 scanlines" />
              <div className="absolute left-6 top-6 z-10 border-l pl-3" style={{ borderColor: hero.accent }}>
                <div className="font-mono text-[8px] text-gray-500">NEURAL ID / {hero.codename}</div>
                <div className="mt-1 font-display text-xl text-white">{activePilot.label}</div>
                <div className="font-mono text-[8px]" style={{ color: hero.accent }}>{activeHero.label} ASSEMBLY PATH</div>
              </div>
              <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/10 bg-black/85 px-6 py-4">
                <div className="flex items-center justify-between gap-4 font-mono text-[8px]">
                  <span className="text-gray-500">ANIMATION LINK</span>
                  <span className="text-cyan-200">IDLE / WALK RIG ONLINE</span>
                </div>
              </div>
            </section>

            <aside className="border-l border-white/10 bg-black/78 p-5 lg:overflow-y-auto app-scroll">
              <div className="mb-4 border-b border-white/10 pb-4">
                <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">Physical suit links</div>
                <div className="mt-1 font-display text-xl text-white">GEAR ASSEMBLY</div>
              </div>
              <div className="space-y-2">
                {ARENA_GEAR_SLOTS.map((slot) => {
                  const { label, Icon } = GEAR_SLOT_META[slot];
                  const equippedId = activeLoadout[slot];
                  const candidates = (stats.craftedGear ?? []).filter((id) => ARENA_GEAR_CATALOG[id].slot === slot);
                  return (
                    <div key={slot} className="border border-white/10 bg-black/45 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 font-mono text-[8px] text-gray-500"><Icon className="h-3.5 w-3.5" /> {label}</span>
                        <span className="truncate font-mono text-[8px]" style={{ color: equippedId ? ARENA_GEAR_RARITIES[ARENA_GEAR_CATALOG[equippedId].rarity].color : "#4b5058" }}>
                          {equippedId ? CRAFTING_RECIPES_BY_ID[equippedId].name : "EMPTY"}
                        </span>
                      </div>
                      {candidates.length ? (
                        <div className="mt-2 grid gap-1">
                          {candidates.map((id) => {
                            const rarity = ARENA_GEAR_RARITIES[ARENA_GEAR_CATALOG[id].rarity];
                            const selected = equippedId === id;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => equipArenaGear(hero.archetype, slot, selected ? null : id)}
                                className="flex items-center justify-between border px-2 py-1.5 text-left font-mono text-[8px]"
                                style={{ borderColor: selected ? rarity.color : "rgba(255,255,255,.08)", background: selected ? `${rarity.color}10` : "transparent" }}
                              >
                                <span className="truncate text-white">{CRAFTING_RECIPES_BY_ID[id].name}</span>
                                <span className="ml-2 text-[7px]" style={{ color: rarity.color }}>{selected ? "LINKED" : rarity.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <button type="button" onClick={() => router.push("/skills")} className="mt-2 w-full border border-dashed border-white/10 py-2 font-mono text-[7px] text-gray-600 hover:text-white">
                          FABRICATE IN SYSTEMS
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>
          </motion.section>
        )}

        {activeView === "systems" && (
          <motion.section
            key="systems"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            className="grid min-h-[calc(100vh-116px)] grid-cols-1 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_360px]"
          >
            <section className="p-5 lg:overflow-y-auto lg:p-8 app-scroll">
              <div className="mb-7 border-b border-white/10 pb-5">
                <div className="font-mono text-[8px] uppercase tracking-normal text-cyan-200/65">Progression network</div>
                <h1 className="mt-1 font-display text-2xl uppercase tracking-normal text-white">SYSTEMS</h1>
              </div>

              <div className="divide-y divide-white/10 border-y border-white/10">
                <button type="button" onClick={() => router.push("/skills")} className="flex w-full items-center gap-4 py-5 text-left transition-colors hover:bg-white/[0.025]">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-cyan-300/30 text-cyan-200"><Wrench className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg uppercase tracking-normal text-white">Talent and Crafting Network</div>
                    <div className="mt-1 font-mono text-[9px] text-gray-500">Skills, circular crafting nodes and equipped gear.</div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-600" />
                </button>
                <button type="button" onClick={() => router.push("/garage")} className="flex w-full items-center gap-4 py-5 text-left transition-colors hover:bg-white/[0.025]">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-white/15 text-gray-300"><MousePointer2 className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg uppercase tracking-normal text-white">Cursor Garage</div>
                    <div className="mt-1 font-mono text-[9px] text-gray-500">Select and configure the active control signature.</div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-600" />
                </button>
              </div>

              <div className="mt-8">
                <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-normal text-gray-500"><Boxes className="h-4 w-4" /> Material inventory</div>
                  <div className="font-mono text-[9px] text-white">{totalMaterials} TOTAL</div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                  {MATERIALS.map((material) => (
                    <div key={material.id} className="min-w-0 border border-white/10 bg-black/42 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="h-2 w-2 shrink-0" style={{ background: material.color }} />
                        <span className="font-display text-lg text-white">{materialInventory[material.id] ?? 0}</span>
                      </div>
                      <div className="mt-3 break-words font-mono text-[8px] uppercase tracking-normal text-gray-400">{material.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="border-l border-white/10 bg-black/78 p-5 lg:overflow-y-auto lg:p-6 app-scroll">
              <div className="border-b border-white/10 pb-5">
                <div className="font-mono text-[8px] uppercase tracking-normal text-gray-500">System inventory</div>
                <div className="mt-1 font-display text-2xl uppercase tracking-normal text-white">{hero.codename}</div>
              </div>
              <div className="grid grid-cols-3 border-b border-white/10 py-5 text-center">
                <div><div className="font-display text-xl text-white">{stats.credits}</div><div className="font-mono text-[8px] text-gray-500">CREDITS</div></div>
                <div className="border-x border-white/10"><div className="font-display text-xl text-white">{craftedCount}</div><div className="font-mono text-[8px] text-gray-500">GEAR</div></div>
                <div><div className="font-display text-xl text-white">{stats.skills.length}</div><div className="font-mono text-[8px] text-gray-500">SKILLS</div></div>
              </div>
              <div className="py-5">
                <div className="mb-3 font-mono text-[8px] uppercase tracking-normal text-gray-500">Active pilot</div>
                <div className="flex items-center gap-3 border border-white/10 bg-black/50 p-3">
                  <div className="relative h-16 w-14 shrink-0 overflow-hidden bg-black"><Image src={activePilot.image} alt="" fill sizes="56px" className="object-cover object-top" /></div>
                  <div className="min-w-0"><div className="truncate font-display text-base text-white">{activeHero.label}</div><div className="truncate font-mono text-[8px]" style={{ color: hero.accent }}>{activeHero.role}</div></div>
                </div>
              </div>
              <div className="border-t border-white/10 pt-5">
                <div className="mb-3 flex items-center gap-2 font-mono text-[8px] uppercase tracking-normal text-gray-500"><Hammer className="h-3.5 w-3.5" /> Crafted loadout</div>
                <div className="font-mono text-[10px] leading-relaxed text-gray-400">
                  {craftedCount > 0
                    ? `${equippedGearCount}/${ARENA_GEAR_SLOTS.length} active links on ${activeHero.label}. Equip changes in GEAR.`
                    : "No crafted gear linked yet."}
                </div>
              </div>
            </aside>
          </motion.section>
        )}

        {activeView === "awards" && (
          <motion.section
            key="awards"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            className="min-h-[calc(100vh-116px)] p-5 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:p-8 app-scroll"
          >
            <div className="mb-6 flex items-end justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <div className="font-mono text-[8px] uppercase tracking-normal text-cyan-200/65">Operative record</div>
                <h1 className="mt-1 font-display text-2xl uppercase tracking-normal text-white">AWARDS</h1>
              </div>
              <div className="text-right"><div className="font-display text-3xl text-white">{unlockedAchievements.length}/{ACHIEVEMENTS.length}</div><div className="font-mono text-[8px] text-gray-500">UNLOCKED</div></div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {ACHIEVEMENTS.map((achievement) => {
                const unlocked = unlockedAchievements.includes(achievement.id);
                return (
                  <div key={achievement.id} className="flex min-h-24 items-start gap-3 border border-white/10 bg-black/45 p-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center border ${unlocked ? "border-cyan-300/50 text-cyan-200" : "border-white/10 text-gray-700"}`}>
                      {unlocked ? <Award className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="break-words font-mono text-[10px] uppercase tracking-normal text-white">{achievement.name}</div>
                      <div className="mt-1 font-mono text-[9px] leading-relaxed text-gray-500">{achievement.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}
      </div>
    </main>
  );
}
