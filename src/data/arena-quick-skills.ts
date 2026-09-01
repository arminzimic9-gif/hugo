export type ArenaQuickSkill = {
  id: string;
  label: string;
  description: string;
  cost: number;
  requires: string[];
};

export const ARENA_QUICK_SKILLS: ArenaQuickSkill[] = [
  {
    id: "precision",
    label: "PRECISION",
    description: "Otvara combat granu i vodi prema Blast Novi.",
    cost: 80,
    requires: ["core"],
  },
  {
    id: "reflexes",
    label: "REFLEXES",
    description: "Otvara force granu i put prema Barrieru i Time Warpu.",
    cost: 100,
    requires: ["core"],
  },
  {
    id: "siphon",
    label: "SIPHON",
    description: "Otvara survival granu i pristup Magnetu i Overdriveu.",
    cost: 100,
    requires: ["core"],
  },
  {
    id: "magnet2",
    label: "MAGNET+",
    description: "Povećava kontrolu nad data core pickupovima.",
    cost: 140,
    requires: ["siphon"],
  },
  {
    id: "shield",
    label: "BARRIER",
    description: "Otključava aktivnu Barrier sposobnost na F.",
    cost: 180,
    requires: ["reflexes"],
  },
  {
    id: "blast",
    label: "BLAST NOVA",
    description: "Otključava aktivnu Blast Nova sposobnost na Q.",
    cost: 200,
    requires: ["precision"],
  },
  {
    id: "timewarp",
    label: "TIME WARP",
    description: "Otključava globalno usporavanje neprijatelja na E.",
    cost: 220,
    requires: ["reflexes"],
  },
  {
    id: "overdrive",
    label: "OVERDRIVE",
    description: "Otključava trostruki rafal na R.",
    cost: 300,
    requires: ["siphon"],
  },
];
