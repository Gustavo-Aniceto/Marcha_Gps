// Tipos de carroceria do carrinho no mapa (vista de cima, frente pra cima) e paleta de cores.
// Cada tipo é descrito por medidas; o desenho fica em components/CarMarker.tsx.

export type BodyType = 'hatch' | 'seda' | 'perua' | 'picape' | 'picape_grande' | 'suv' | 'esportivo' | 'van';

export interface BodySpec {
  id: BodyType;
  label: string;   // nome na garagem
  example: string; // exemplo da cena
  w: number;       // meia largura
  l: number;       // meio comprimento
  rx: number;      // arredondado dos cantos
  shield: [number, number]; // para-brisa: começo e fim (y)
  roof: [number, number];   // teto: começo e fim (y)
  rear: [number, number] | null; // vidro de trás (null = sem)
  bed?: [number, number];   // caçamba (picape)
  rails?: boolean;          // rack no teto (SUV)
  stripes?: boolean;        // faixas no capô (esportivo)
}

// y negativo = frente. Valores pensados pra caber no quadro -32..32.
export const BODIES: BodySpec[] = [
  { id: 'hatch', label: 'Hatch', example: 'Gol, Celta, Palio', w: 9, l: 15, rx: 6,
    shield: [-8, -3], roof: [-3, 7], rear: [7, 10.5] },
  { id: 'seda', label: 'Sedã', example: 'Voyage, Civic, Corolla', w: 9, l: 18.5, rx: 6,
    shield: [-8, -2.5], roof: [-2.5, 7], rear: [7, 10] },
  { id: 'perua', label: 'Perua', example: 'Parati, Quantum, Fielder', w: 9, l: 18.5, rx: 6,
    shield: [-9, -4], roof: [-4, 14], rear: [14, 16.2] },
  { id: 'picape', label: 'Picape', example: 'Saveiro, Strada, Montana', w: 9.2, l: 18.5, rx: 5,
    shield: [-8.5, -4], roof: [-4, 2], rear: [2, 3.5], bed: [5, 17] },
  { id: 'picape_grande', label: 'Picape grande', example: 'Hilux, S10, F-1000', w: 11, l: 21, rx: 5,
    shield: [-10, -5], roof: [-5, 4], rear: [4, 5.5], bed: [7.5, 19.5] },
  { id: 'suv', label: 'SUV', example: 'EcoSport, Tracker, Duster', w: 10.5, l: 17.5, rx: 5,
    shield: [-9, -4], roof: [-4, 11], rear: [11, 14], rails: true },
  { id: 'esportivo', label: 'Esportivo', example: 'Golf GTI, Opala coupê, Calibra', w: 10, l: 17, rx: 7,
    shield: [-4, 1], roof: [1, 7], rear: [7, 10], stripes: true },
  { id: 'van', label: 'Van / Kombi', example: 'Kombi, Sprinter, Doblò', w: 10, l: 20, rx: 6,
    shield: [-17, -13], roof: [-13, 17.5], rear: null },
];

export const DEFAULT_BODY: BodyType = 'hatch';

export function bodySpec(id: string | null | undefined): BodySpec {
  return BODIES.find((b) => b.id === id) ?? BODIES[0];
}

// Cores de carro (a tinta da garagem)
export const CAR_COLORS: [string, string][] = [
  ['#B9C0CB', 'Prata'], ['#2A2D34', 'Preto'], ['#EDEFF2', 'Branco'], ['#5B6270', 'Grafite'],
  ['#D23B3B', 'Vermelho'], ['#7B1E3A', 'Vinho'], ['#F07A22', 'Laranja'], ['#F2C230', 'Amarelo'],
  ['#9BE34A', 'Verde-limão'], ['#3FA66B', 'Verde'], ['#2EC4B6', 'Turquesa'], ['#7CC4F5', 'Azul-bebê'],
  ['#2F6FE0', 'Azul'], ['#8B5CF6', 'Roxo'], ['#F27BB0', 'Rosa'], ['#D8C3A5', 'Bege'], ['#7A4E2D', 'Marrom'],
];

/** Clareia (amount > 0) ou escurece (amount < 0) uma cor #RRGGBB. amount de -1 a 1. */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

/** Cor clara demais? (pra escolher contorno escuro no carro branco/bege) */
export function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.72;
}
