// Peças do desenho do carrinho (vista de cima, frente pra cima), em coordenadas -32..32.
// Puro: o CarMarker transforma em <Svg>, e o script de prévia transforma em arquivo .svg.
import { bodySpec, isLight, shade, type BodySpec } from './carBodies.ts';

export type Part =
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number; fill: string; opacity?: number; stroke?: string; sw?: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; opacity?: number; stroke?: string; sw?: number }
  | { t: 'path'; d: string; fill: string; opacity?: number; stroke?: string; sw?: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; opacity?: number };

export type Tint = 'nenhuma' | 'fume' | 'limo';
const GLASS: Record<Tint, string> = { nenhuma: '#2B4A6F', fume: '#16223A', limo: '#06080D' };

export interface CarLook { body?: string | null; color?: string; tint?: Tint | string | null; spoiler?: boolean | null }

const f = (n: number) => Math.round(n * 100) / 100;

export function carParts(look: CarLook): Part[] {
  const b: BodySpec = bodySpec(look.body);
  const color = look.color && /^#[0-9a-f]{6}$/i.test(look.color) ? look.color : '#B9C0CB';
  const glass = GLASS[(look.tint as Tint) ?? 'nenhuma'] ?? GLASS.nenhuma;
  const light = isLight(color);
  const outline = light ? shade(color, -0.55) : shade(color, -0.6);
  const { w, l } = b;
  const parts: Part[] = [];

  // sombra no chão
  parts.push({ t: 'ellipse', cx: 0, cy: 1.5, rx: w + 1.5, ry: l + 1.2, fill: '#000000', opacity: 0.3 });
  // rodas (saem um pouco pra fora)
  const wh = Math.max(5, l * 0.3), ww = 3.4;
  const fy = -l * 0.62, ry = l * 0.36;
  for (const y of [fy, ry]) for (const s of [-1, 1]) {
    parts.push({ t: 'rect', x: f(s < 0 ? -w - 2 : w - 1.4), y: f(y), w: ww, h: f(wh), rx: 1.2, fill: '#0B0D12' });
  }
  // carroceria
  parts.push({ t: 'rect', x: -w, y: -l, w: 2 * w, h: 2 * l, rx: b.rx, fill: color, stroke: outline, sw: 1 });
  // brilho na lateral esquerda (cara de desenho)
  parts.push({ t: 'rect', x: f(-w + 1.3), y: f(-l + 3), w: 1.8, h: f(2 * l - 6), rx: 0.9, fill: '#FFFFFF', opacity: light ? 0.35 : 0.22 });

  // caçamba
  if (b.bed) {
    const [b0, b1] = b.bed, bw = w - 1.6;
    parts.push({ t: 'rect', x: -bw, y: b0, w: 2 * bw, h: f(b1 - b0), rx: 1.2, fill: shade(color, -0.4), stroke: outline, sw: 0.6 });
    for (let i = 1; i <= 3; i++) {
      const x = -bw + (2 * bw * i) / 4;
      parts.push({ t: 'line', x1: f(x), y1: b0 + 1, x2: f(x), y2: b1 - 1, stroke: shade(color, -0.6), sw: 0.6, opacity: 0.7 });
    }
  }

  // para-brisa (mais estreito na frente)
  const [s0, s1] = b.shield;
  parts.push({ t: 'path', fill: glass, stroke: outline, sw: 0.5,
    d: `M${f(-(w - 2.6))} ${s0} Q0 ${f(s0 - 1.6)} ${f(w - 2.6)} ${s0} L${f(w - 1.4)} ${s1} L${f(-(w - 1.4))} ${s1} Z` });
  // reflexo no vidro
  parts.push({ t: 'path', fill: '#FFFFFF', opacity: 0.25,
    d: `M${f(-(w - 3.4))} ${f(s0 + 0.6)} L${f(-(w - 5.4))} ${f(s0 + 0.4)} L${f(-(w - 3.8))} ${f(s1 - 0.6)} L${f(-(w - 2.4))} ${f(s1 - 0.6)} Z` });

  // vidros laterais
  const [r0, r1] = b.roof;
  for (const s of [-1, 1]) {
    parts.push({ t: 'rect', x: f(s < 0 ? -(w - 0.5) : w - 1.7), y: r0, w: 1.2, h: f(r1 - r0), rx: 0.6, fill: glass });
  }
  // teto (um tom mais claro)
  parts.push({ t: 'rect', x: f(-(w - 1.8)), y: r0, w: f(2 * (w - 1.8)), h: f(r1 - r0), rx: 2, fill: shade(color, light ? -0.06 : 0.16),
    stroke: outline, sw: 0.5 });
  if (b.rails) {
    for (const s of [-1, 1]) parts.push({ t: 'line', x1: f(s * (w - 3.2)), y1: r0 + 1.2, x2: f(s * (w - 3.2)), y2: r1 - 1.2, stroke: '#1A1D24', sw: 1.1 });
    for (const y of [r0 + 3, r1 - 3]) parts.push({ t: 'line', x1: f(-(w - 3.2)), y1: y, x2: f(w - 3.2), y2: y, stroke: '#1A1D24', sw: 0.7, opacity: 0.7 });
  }
  if (b.id === 'van') {
    // teto da van: frisos
    for (let y = r0 + 4; y < r1 - 2; y += 5) parts.push({ t: 'line', x1: f(-(w - 3)), y1: y, x2: f(w - 3), y2: y, stroke: shade(color, -0.25), sw: 0.7 });
  }

  // vidro de trás (mais estreito atrás)
  if (b.rear) {
    const [q0, q1] = b.rear;
    parts.push({ t: 'path', fill: glass, stroke: outline, sw: 0.5,
      d: `M${f(-(w - 1.6))} ${q0} L${f(w - 1.6)} ${q0} L${f(w - 2.6)} ${q1} Q0 ${f(q1 + 0.8)} ${f(-(w - 2.6))} ${q1} Z` });
  }

  // faixas de esportivo (capô e teto)
  if (b.stripes) {
    const sc = light ? '#1A1D24' : '#FFFFFF';
    for (const x of [-2.4, 0.9]) {
      parts.push({ t: 'rect', x, y: f(-l + 1.2), w: 1.5, h: f(s0 - (-l + 1.2) - 0.6), fill: sc, opacity: 0.85 });
      parts.push({ t: 'rect', x, y: r0 + 0.6, w: 1.5, h: f(r1 - r0 - 1.2), fill: sc, opacity: 0.85 });
    }
  }

  // retrovisores
  for (const s of [-1, 1]) {
    parts.push({ t: 'ellipse', cx: f(s * (w + 0.9)), cy: f(s1 - 0.4), rx: 1.4, ry: 0.9, fill: color, stroke: outline, sw: 0.5 });
  }
  // faróis e lanternas
  for (const s of [-1, 1]) {
    parts.push({ t: 'ellipse', cx: f(s * (w - 2.8)), cy: f(-l + 1.2), rx: 1.9, ry: 0.9, fill: '#FFF6D6' });
    parts.push({ t: 'rect', x: f(s < 0 ? -(w - 1.6) : w - 4.4), y: f(l - 1.5), w: 2.8, h: 1.1, rx: 0.5, fill: '#FF3B3B' });
  }
  // aerofólio
  if (look.spoiler && b.id !== 'van' && !b.bed) {
    parts.push({ t: 'rect', x: f(-w - 0.6), y: f(l - 3), w: f(2 * w + 1.2), h: 1.8, rx: 0.6, fill: shade(color, -0.5) });
  }
  return parts;
}

/** Desenho em texto SVG (prévias e testes). */
export function carSvg(look: CarLook, size = 128): string {
  const attrs = (p: Part) => {
    const common = `fill="${'fill' in p ? p.fill : 'none'}"${p.opacity != null ? ` opacity="${p.opacity}"` : ''}${'stroke' in p && p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw ?? 1}"` : ''}`;
    switch (p.t) {
      case 'rect': return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx ?? 0}" ${common}/>`;
      case 'ellipse': return `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" ${common}/>`;
      case 'path': return `<path d="${p.d}" ${common}/>`;
      case 'line': return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${p.stroke}" stroke-width="${p.sw}"${p.opacity != null ? ` opacity="${p.opacity}"` : ''} stroke-linecap="round"/>`;
    }
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-32 -32 64 64">${carParts(look).map(attrs).join('')}</svg>`;
}
