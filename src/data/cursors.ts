export interface Cursor {
  id: number;
  name: string;
  type: 'glow' | 'particles' | 'trail' | 'sharp' | 'fluid' | 'data' | 'flare' | 'glitch' | 'void' | 'dust';
  description: string;
  cost: number;
  color: string;
}

export const CURSORS: Cursor[] = [
  { 
    id: 1, 
    name: "Neon Pulse", 
    type: 'glow', 
    description: "Pulsira u ciklusima (120 BPM) sa suptilnim glow efektom.", 
    cost: 0, 
    color: "#00f2ff" 
  },
  { 
    id: 2, 
    name: "Pixel Blast", 
    type: 'particles', 
    description: "Pri kliku izbacuje 8-bitne fragmente u boji teme.", 
    cost: 500, 
    color: "#ff1a24" 
  },
  { 
    id: 3, 
    name: "Ghost Trail", 
    type: 'trail', 
    description: "Ostavlja 5 prozirnih kopija sebe koje blijede za 200ms.", 
    cost: 800, 
    color: "#bc13fe" 
  },
  { 
    id: 4, 
    name: "Cyber Blade", 
    type: 'sharp', 
    description: "Ultra tanki trokut sa oštrim ivicama i glassmorphism teksturom.", 
    cost: 400, 
    color: "#ffffff" 
  },
  { 
    id: 5, 
    name: "Liquid Mercury", 
    type: 'fluid', 
    description: "Mijenja oblik (morphing) dok se kreće, kao živa.", 
    cost: 1200, 
    color: "#e0e0e0" 
  },
  { 
    id: 6, 
    name: "Data Stream", 
    type: 'data', 
    description: "Ostavlja vertikalni niz binarnih cifara (0,1) dok klizi.", 
    cost: 1000, 
    color: "#00ff88" 
  },
  { 
    id: 7, 
    name: "Solar Flare", 
    type: 'flare', 
    description: "Iz vrha kursora izlazi suptilan dim/plamen koji prati fiziku pokreta.", 
    cost: 1500, 
    color: "#ff8800" 
  },
  { 
    id: 8, 
    name: "Glitch Bit", 
    type: 'glitch', 
    description: "Nasumično se trese i mijenja boju u RGB splitu svake 2 sekunde.", 
    cost: 900, 
    color: "#ff00ff" 
  },
  { 
    id: 9, 
    name: "Void Walker", 
    type: 'void', 
    description: "Invertuje boje pozadine ispod kursora u realnom vremenu.", 
    cost: 2000, 
    color: "#000000" 
  },
  { 
    id: 10, 
    name: "Star Dust", 
    type: 'dust', 
    description: "Ostavlja sitne, svjetlucave čestice koje polako padaju prema dnu ekrana.", 
    cost: 750, 
    color: "#ffd700" 
  }
];
