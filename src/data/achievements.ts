export type AchievementDef = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_jump", name: "First Jump", description: "Izvedi prvi uspjesan skok.", icon: "JMP" },
  { id: "no_hit_run", name: "No Hit Run", description: "Zavrsi level bez damage-a.", icon: "NH" },
  { id: "speed_demon", name: "Speed Demon", description: "Zavrsi level rekordno brzo.", icon: "SPD" },
  { id: "operative_ready", name: "Operative Ready", description: "Otkljucaj Operative Level.", icon: "OP5" },
  { id: "laser_survivor", name: "Laser Survivor", description: "Prodji laser sekciju bez pogotka.", icon: "LAS" },
  { id: "time_master", name: "Time Master", description: "Pametno iskoristi Time Freeze/Time Warp.", icon: "TIM" },
  { id: "chaos_survived", name: "Chaos Survived", description: "Prezivi prvi haoticni level.", icon: "CHS" },
  { id: "atomic_trigger", name: "Atomic Trigger", description: "Pokupi Atomic Bomb power-up prvi put.", icon: "ATM" },
  { id: "eye_breaker", name: "Eye Breaker", description: "Aktiviraj Eye Burst efekat.", icon: "EYE" },
  { id: "boss_tester", name: "Boss Tester", description: "Udji u Boss Test Level.", icon: "BST" },
  { id: "boss_destroyed", name: "Boss Destroyed", description: "Pobijedi test boss-a.", icon: "KILL" },
  { id: "storm_rider", name: "Storm Rider", description: "Aktiviraj Lightning storm efekat.", icon: "STRM" },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(
  ACHIEVEMENTS.map((item) => [item.id, item])
) as Record<string, AchievementDef>;
