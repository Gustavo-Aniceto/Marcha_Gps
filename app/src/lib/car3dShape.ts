// Forma do carro em 3D (em metros), lógica pura sem three.js pra dar pra testar.
// O corpo é "fatiado" ao longo do comprimento: em cada fatia (estação) sabemos a altura do capô/teto/
// porta-malas, a linha de cintura (onde começam os vidros), a largura embaixo e no teto e o fundo
// (que sobe nos arcos das rodas). O car3d.ts liga as fatias numa superfície lisa e pinta cada parte
// (lataria, vidros, para-brisa, caçamba).
// x negativo = traseira, positivo = frente; y a partir do fundo da carroceria; z = lado.

export type LightStyle = 'square' | 'round' | 'slim' | 'big';
export type TailStyle = 'wide' | 'tall' | 'round';

export interface ModelDef {
  body: string;
  L: number; W: number;
  wb: number; fo: number;          // entre-eixos e balanço dianteiro
  noseY: number;                   // altura do topo da frente (para-choque/grade)
  hoodY: number;                   // altura do capô no pé do para-brisa
  cowlX: number;                   // pé do para-brisa
  roofFX: number; roofRX: number; roofY: number;
  deckX: number; deckY: number;    // base do vidro traseiro / tampa
  tailY: number;                   // topo da traseira
  rF: number; rR: number;          // canto arredondado visto de cima (frente / trás)
  tumble: number;                  // largura do teto / largura do carro
  boxy: number;                    // 0 = arredondado, 1 = quadradão
  sideRear?: number;               // onde acaba o vidro lateral (x); sedã acaba antes da coluna C
  bedX?: number;                   // picape: início da caçamba (x, atrás da cabine)
  lights: LightStyle;
  tail: TailStyle;
}

export const BASE: Record<string, ModelDef> = {
  hatch: { body: 'hatch', L: 3.9, W: 1.66, wb: 2.47, fo: 0.78, noseY: 0.6, hoodY: 0.78, cowlX: 0.72, roofFX: -0.08,
           roofRX: -1.3, roofY: 1.2, deckX: -1.76, deckY: 0.88, tailY: 0.82, rF: 0.42, rR: 0.3, tumble: 0.8, boxy: 0.4,
           lights: 'square', tail: 'tall' },
  seda: { body: 'seda', L: 4.4, W: 1.7, wb: 2.6, fo: 0.86, noseY: 0.6, hoodY: 0.78, cowlX: 0.95, roofFX: 0.12,
          roofRX: -0.98, roofY: 1.2, deckX: -1.5, deckY: 0.86, tailY: 0.84, rF: 0.42, rR: 0.32, tumble: 0.8, boxy: 0.4,
          sideRear: -1.02, lights: 'square', tail: 'wide' },
  perua: { body: 'perua', L: 4.35, W: 1.7, wb: 2.55, fo: 0.84, noseY: 0.6, hoodY: 0.78, cowlX: 0.9, roofFX: 0.08,
           roofRX: -1.85, roofY: 1.24, deckX: -2.08, deckY: 0.95, tailY: 0.86, rF: 0.42, rR: 0.22, tumble: 0.82, boxy: 0.45,
           sideRear: -1.95, lights: 'square', tail: 'tall' },
  picape: { body: 'picape', L: 4.45, W: 1.7, wb: 2.73, fo: 0.8, noseY: 0.62, hoodY: 0.8, cowlX: 1.0, roofFX: 0.18,
            roofRX: -0.42, roofY: 1.22, deckX: -0.5, deckY: 1.12, tailY: 0.86, rF: 0.42, rR: 0.12, tumble: 0.82, boxy: 0.5,
            bedX: -0.56, lights: 'square', tail: 'tall' },
  picape_grande: { body: 'picape_grande', L: 5.3, W: 1.86, wb: 3.1, fo: 0.92, noseY: 0.95, hoodY: 1.06, cowlX: 1.35,
                   roofFX: 0.52, roofRX: -0.62, roofY: 1.56, deckX: -0.7, deckY: 1.45, tailY: 1.08, rF: 0.3, rR: 0.12,
                   tumble: 0.84, boxy: 0.7, bedX: -0.78, lights: 'big', tail: 'tall' },
  suv: { body: 'suv', L: 4.3, W: 1.78, wb: 2.6, fo: 0.86, noseY: 0.82, hoodY: 0.96, cowlX: 0.95, roofFX: 0.15,
         roofRX: -1.72, roofY: 1.46, deckX: -1.98, deckY: 1.06, tailY: 0.98, rF: 0.38, rR: 0.26, tumble: 0.84, boxy: 0.6,
         sideRear: -1.84, lights: 'slim', tail: 'tall' },
  esportivo: { body: 'esportivo', L: 4.3, W: 1.8, wb: 2.6, fo: 0.9, noseY: 0.48, hoodY: 0.64, cowlX: 0.82, roofFX: -0.12,
               roofRX: -0.78, roofY: 1.03, deckX: -1.55, deckY: 0.72, tailY: 0.7, rF: 0.5, rR: 0.36, tumble: 0.74, boxy: 0.25,
               lights: 'slim', tail: 'wide' },
  van: { body: 'van', L: 4.5, W: 1.75, wb: 2.4, fo: 0.95, noseY: 0.95, hoodY: 1.0, cowlX: 2.0, roofFX: 1.78,
         roofRX: -2.1, roofY: 1.72, deckX: -2.2, deckY: 1.02, tailY: 0.96, rF: 0.32, rR: 0.2, tumble: 0.9, boxy: 0.7,
         sideRear: -2.0, lights: 'square', tail: 'tall' },
};

export function baseFor(body: string | null | undefined): ModelDef {
  return BASE[body ?? 'hatch'] ?? BASE.hatch;
}

/** Raio da roda com pneu (m) pelo aro. */
export function wheelRadius(rim: number | null | undefined): number {
  const r = Math.min(Math.max(rim ?? 15, 13), 22);
  return (r * 0.0254) / 2 + 0.12;
}

/** Vão (fundo da carroceria até o chão) pela altura da garagem: rebaixado chega bem perto. */
export function clearance(def: ModelDef, rideHeightCm: number | null | undefined): number {
  const base = def.body === 'picape_grande' ? 0.26 : def.body === 'suv' ? 0.21 : def.body === 'esportivo' ? 0.13 : 0.16;
  const cm = rideHeightCm ?? 15;
  return Math.max(0.05, base * (cm / 15));
}

/** z do centro do pneu: roda pra fora/alinhada/pra dentro. */
export function wheelZ(def: ModelDef, position: string | null | undefined): number {
  return def.W / 2 - 0.13 + (position === 'fora' ? 0.05 : position === 'dentro' ? -0.04 : 0);
}

export const axles = (d: ModelDef) => ({ front: d.L / 2 - d.fo, rear: d.L / 2 - d.fo - d.wb });

// curva suave entre pontos-chave (cosseno): fica plana em cada ponto, sem "dente"
function keyed(keys: [number, number][], x: number): number {
  const k = [...keys].sort((a, b) => a[0] - b[0]);
  if (x <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (x <= k[i][0]) {
      const [x0, y0] = k[i - 1], [x1, y1] = k[i];
      const t = x1 === x0 ? 1 : (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * (1 - Math.cos(Math.PI * t)) / 2;
    }
  }
  return k[k.length - 1][1];
}

/** Altura da parte de cima (capô, para-brisa, teto, vidro traseiro, tampa) no ponto x. */
export function topAt(d: ModelDef, x: number): number {
  const h = d.L / 2;
  const keys: [number, number][] = [
    [h, d.noseY], [h - 0.22, d.noseY + (d.hoodY - d.noseY) * 0.35], [d.cowlX, d.hoodY],
    [d.roofFX, d.roofY], [d.roofRX, d.roofY],
  ];
  if (d.bedX != null) {
    // picape: cabine reta atrás e caçamba na altura das bordas
    keys.push([d.deckX, d.deckY], [d.bedX, d.tailY], [-h + 0.06, d.tailY], [-h, d.tailY - 0.04]);
  } else {
    keys.push([d.deckX, d.deckY], [-h + 0.1, d.tailY], [-h, d.tailY - 0.06]);
  }
  return keyed(keys, x);
}

/** Linha de cintura (base dos vidros laterais), nunca acima do topo. */
export function beltAt(d: ModelDef, x: number): number {
  const front = d.hoodY + 0.04, rear = Math.max(d.deckY, d.tailY) + 0.04;
  const t = Math.min(1, Math.max(0, (d.cowlX - x) / Math.max(0.1, d.cowlX - d.deckX)));
  return Math.min(topAt(d, x), front + (rear - front) * t);
}

/** Meia largura do corpo no ponto x (cantos arredondados vistos de cima). */
export function halfWidthAt(d: ModelDef, x: number): number {
  const h = d.L / 2, w = d.W / 2;
  const f = (dx: number, r: number) => (dx <= 0 || r <= 0 ? 1 : 0.6 + 0.4 * Math.sqrt(Math.max(0, 1 - (dx / r) ** 2)));
  return w * Math.min(f(x - (h - d.rF), d.rF), f(-h + d.rR - x, d.rR));
}

/** Fundo da carroceria no ponto x: sobe nos arcos das rodas (dá o formato do para-lama). */
export function bottomAt(d: ModelDef, x: number, wheelCenterY: number, archR: number): number {
  const h = d.L / 2;
  let y = 0.06 + Math.max(0, Math.abs(x) - (h - 0.25)) * 0.35;  // pontas sobem um pouco
  for (const ax of [axles(d).front, axles(d).rear]) {
    const dx = Math.abs(x - ax);
    if (dx < archR) y = Math.max(y, wheelCenterY + Math.sqrt(archR * archR - dx * dx));
  }
  return y;
}

export interface Station {
  x: number; bottom: number; belt: number; top: number;
  w: number;      // meia largura do corpo
  wRoof: number;  // meia largura do teto
}

/** As fatias do carro, com cortes extras nas bordas dos vidros (pra pintura não "vazar"). */
export function stations(d: ModelDef, wheelCenterY: number, archR: number, n = 64): Station[] {
  const h = d.L / 2;
  const xs = new Set<number>();
  for (let i = 0; i <= n; i++) xs.add(+(-h + (d.L * i) / n).toFixed(4));
  const edges = glassEdges(d);
  for (const e of [edges.wsFront, edges.wsRear, edges.rgFront, edges.rgRear, edges.sideFront, edges.sideRear, d.bedX ?? NaN]) {
    if (Number.isFinite(e) && Math.abs(e) < h) { xs.add(+(e - 0.003).toFixed(4)); xs.add(+(e + 0.003).toFixed(4)); }
  }
  const { front, rear } = axles(d);
  for (const ax of [front, rear]) for (let k = -6; k <= 6; k++) {
    const x = ax + (archR * k) / 6;
    if (Math.abs(x) < h) xs.add(+x.toFixed(4));
  }
  return [...xs].sort((a, b) => a - b).map((x) => {
    const top = topAt(d, x);
    const belt = beltAt(d, x);
    const w = halfWidthAt(d, x);
    const g = Math.min(1, Math.max(0, (top - belt) / 0.18));
    return { x, top, belt, w, wRoof: w * (1 - (1 - d.tumble) * g), bottom: Math.min(bottomAt(d, x, wheelCenterY, archR), belt - 0.08) };
  });
}

/** Onde começam/acabam para-brisa, vidro traseiro e vidros laterais (x). */
export function glassEdges(d: ModelDef) {
  const m = 0.06;
  return {
    wsFront: d.cowlX - m, wsRear: d.roofFX + m * 0.5,              // para-brisa
    rgFront: d.roofRX - m * 0.5, rgRear: d.deckX + m,              // vidro de trás
    sideFront: d.cowlX - 0.16, sideRear: d.sideRear ?? (d.bedX != null ? d.deckX + 0.06 : d.deckX + 0.16),
  };
}

/**
 * Contorno de um lado da fatia (z >= 0), de baixo pra cima: 7 pontos [z, y].
 * 0 fundo · 1 saia · 2 lateral · 3 cintura · 4 topo do vidro lateral · 5 borda do teto · 6 meio do teto
 */
export function section(s: Station, boxy: number): [number, number][] {
  const rr = 0.04 + 0.07 * (1 - boxy);
  const bulge = 1 - 0.03 * (1 - boxy);
  const yTopEdge = Math.min(s.top, Math.max(s.belt, s.top - rr * 0.7));
  const y2 = Math.min(s.belt, Math.max(s.bottom + 0.1, s.belt - 0.05));
  const y1 = Math.max(s.bottom, Math.min(y2, s.bottom + 0.06 + 0.06 * (1 - boxy)));
  return [
    [s.w * 0.86, s.bottom],
    [s.w * bulge, y1],
    [s.w, y2],
    [s.w * (0.985 - 0.01 * (1 - boxy)), s.belt],
    [s.wRoof, yTopEdge],
    [Math.max(0.05, s.wRoof - rr), s.top],
    [0, s.top + 0.012 * (1 - boxy)],
  ];
}

export type Part = 'paint' | 'glass' | 'dark' | 'bed';

/** Cor de cada faixa (entre o ponto k e k+1 da fatia) no ponto x. */
export function partAt(d: ModelDef, x: number, k: number, s: Station): Part {
  const e = glassEdges(d);
  const hasGreenhouse = s.top - s.belt > 0.12;
  if (k === 0) return 'dark';
  if (k === 3) return hasGreenhouse && x < e.sideFront && x > e.sideRear ? 'glass' : 'paint';
  if (k === 5) {
    if (d.bedX != null && x < d.bedX) return 'bed';
    if (x < e.wsFront && x > e.wsRear) return 'glass';
    if (d.bedX == null && x < e.rgFront && x > e.rgRear) return 'glass';
    return 'paint';
  }
  return 'paint';
}
