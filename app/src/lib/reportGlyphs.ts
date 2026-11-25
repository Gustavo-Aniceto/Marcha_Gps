// Desenho de cada tipo de aviso num quadro 24x24 (traço escuro sobre o círculo laranja).
// Uma fonte só pros dois jeitos de desenhar: o ícone de tela (ReportIcon, react-native-svg)
// e o ícone do mapa no navegador (desenhado em canvas, vira camada do mapa — bem mais leve
// que um elemento HTML por aviso).
import type { ReportKind } from './reports.ts';

export type GlyphPart =
  | { t: 'path'; d: string; fill?: boolean }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx: number }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: boolean };

export const GLYPHS: Record<string, GlyphPart[]> = {
  radar: [
    { t: 'rect', x: 4, y: 7, w: 12, h: 8, rx: 1.5 },
    { t: 'circle', cx: 10, cy: 11, r: 2.2 },
    { t: 'path', d: 'M16 9.5 20 8v6l-4-1.5M10 15v5M7 20h6' },
  ],
  lombada: [
    { t: 'path', d: 'M2 17h4c1.5 0 2.5-6 6-6s4.5 6 6 6h4' },
    { t: 'path', d: 'M9 8.5 12 6l3 2.5' },
  ],
  valeta: [
    { t: 'path', d: 'M2 9h5c1.5 0 2.5 7 5 7s3.5-7 5-7h5' },
    { t: 'path', d: 'M9 19.5 12 22l3-2.5' },
  ],
  buraco: [
    { t: 'path', d: 'M2 15h20' },
    { t: 'path', d: 'M7 15c0 3 2 4.5 5 4.5s5-1.5 5-4.5', fill: true },
    { t: 'path', d: 'M9 11.5l1-2M14 9.5l1 2' },
  ],
  rua_ruim: [
    { t: 'path', d: 'M3 18h18M5 6h14' },
    { t: 'path', d: 'M8 6l2 4-3 3 3 5M15 6l-1 3 3 4-2 5' },
  ],
  rampa: [
    { t: 'path', d: 'M3 19h18L14 9H3z' },
    { t: 'path', d: 'M6 15h3' },
  ],
  blitz: [
    { t: 'path', d: 'M7 18v-5a5 5 0 0 1 10 0v5' },
    { t: 'path', d: 'M5 18h14M12 3v2M4.5 6.5l1.5 1.5M19.5 6.5 18 8' },
  ],
  alagamento: [
    { t: 'path', d: 'M12 3s-4 4.5-4 7.5a4 4 0 0 0 8 0C16 7.5 12 3 12 3z' },
    { t: 'path', d: 'M3 18c2 0 2-1.5 4.5-1.5S10 18 12 18s2-1.5 4.5-1.5S19 18 21 18' },
  ],
  sonorizador: [{ t: 'path', d: 'M6 5v14M10 5v14M14 5v14M18 5v14' }],
  faixa_elevada: [
    { t: 'path', d: 'M2 18h4c1.5 0 2.5-5 6-5s4.5 5 6 5h4' },
    { t: 'path', d: 'M9 9v2M12 7v3M15 9v2' },
  ],
};

const FALLBACK: GlyphPart[] = [{ t: 'circle', cx: 12, cy: 12, r: 3, fill: true }];

export function glyphFor(kind: ReportKind | string): GlyphPart[] {
  return GLYPHS[kind] ?? FALLBACK;
}

/** Nome da imagem no mapa: tipo + velocidade do radar (a placa vai junto no mesmo desenho). */
export function reportImageId(kind: string, speedLimit?: number | null): string {
  return `aviso:${kind}:${kind === 'radar' && speedLimit ? speedLimit : 0}`;
}

export function parseReportImageId(id: string): { kind: string; speed: number } | null {
  const m = /^aviso:([a-z_]+):(\d+)$/.exec(id);
  return m ? { kind: m[1], speed: Number(m[2]) } : null;
}
