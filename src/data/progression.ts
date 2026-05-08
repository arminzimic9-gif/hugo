export type LevelIntel = {
  title: string;
  subtitle: string;
  objectives: string[];
};

const INTRO_LEVELS: Record<number, LevelIntel> = {
  1: {
    title: "CHAOS INTRO",
    subtitle: "Brz uvod pun prepreka i energije",
    objectives: [
      "Odrzi momentum i cisti putanju.",
      "Nauci ritam skoka i dodge-a.",
      "Zavrsi bez panicnog kretanja.",
    ],
  },
  2: {
    title: "LASER CONTROL",
    subtitle: "Timing sekcija sa laserima i granicama",
    objectives: [
      "Drzi se unutar plave zone.",
      "Preskoci laserske prozore bez kontakta.",
      "Ne ulazi u crvene zone.",
    ],
  },
  3: {
    title: "SNAIL RUN",
    subtitle: "Full-screen tok i veci prostor",
    objectives: [
      "Zadrzi kontrolu pri vecoj brzini.",
      "Sakupljaj kocke uz fluidno kretanje.",
      "Koristi cijeli ekran, ne samo centar.",
    ],
  },
  4: {
    title: "TIME MECHANICS",
    subtitle: "Kratki i balansirani time power-upovi",
    objectives: [
      "Aktiviraj Time Freeze u pravom trenutku.",
      "Ne trosi Time Warp bez potrebe.",
      "Odrzi ritam i pod pritiskom.",
    ],
  },
  5: {
    title: "OPERATIVE LEVEL",
    subtitle: "Misijski level sa checkpoint logikom",
    objectives: [
      "Survive 60 seconds.",
      "Collect 5 energy cores.",
      "Avoid red laser zones.",
      "Reach extraction point.",
    ],
  },
};

function genericInSector(levelInSector: number): LevelIntel {
  if (levelInSector === 11) {
    return {
      title: "BOSS ASSAULT",
      subtitle: "Visefazni duel sa specijalnim napadima",
      objectives: ["Procitaj pattern bossa.", "Kombinuj speed i preciznost.", "Zavrsi bez rasipanja resursa."],
    };
  }
  if (levelInSector % 3 === 0) {
    return {
      title: "GD RUN",
      subtitle: "Platforming i precizni skokovi",
      objectives: ["Odrzi flow kroz prepreke.", "Drzi tempo bez panic spam-a.", "Kontrolisi landinge."],
    };
  }
  if (levelInSector === 7 || levelInSector === 10) {
    return {
      title: "VERTICAL CUBE SHOOTER",
      subtitle: "Arcade sekcija sa pucanjem i boostovima",
      objectives: ["Kontrolisi liniju pucanja.", "Izbjegni mine i zidove.", "Zatvori rutu bez crash-a."],
    };
  }
  return {
    title: "TACTICAL PHASE",
    subtitle: "Kombinacija brzine i target kontrole",
    objectives: ["Kontrolisi combo.", "Cisti putanju efikasno.", "Sacuvaj defensive alate."],
  };
}

export function getLevelIntel(level: number, levelInSector: number): LevelIntel {
  if (INTRO_LEVELS[level]) return INTRO_LEVELS[level];
  return genericInSector(levelInSector);
}

export const OPERATIVE_LEVEL_NAME = "OPERATIVE LEVEL";
