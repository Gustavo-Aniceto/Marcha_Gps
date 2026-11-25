// Movimento suave do carrinho entre uma leitura do GPS e a próxima.
// O GPS do celular chega ~1 vez por segundo; sem isso o carro "pula" a cada leitura.
// O carro desliza do ponto onde está até a leitura nova, no mesmo tempo que levou entre as duas
// últimas leituras (fica ~1 leitura atrás do real, mas sem trancos). Mapa e carrinho leem daqui
// a cada quadro, então andam juntos.
import { angleDiff, distM, snapToRoute, type Route } from './nav.ts';

export interface GlidePoint { lat: number; lon: number; heading: number | null }

export const TELEPORT_M = 200;     // pulou mais que isso (GPS voltou, túnel): vai direto, sem deslizar
export const STILL_M = 2;          // mexeu menos que isso: é o GPS "tremendo" parado, ignora
export const MIN_GLIDE_MS = 250;
export const MAX_GLIDE_MS = 3000;
export const FIRST_GLIDE_MS = 1000;

/** diferença de ângulo pelo lado mais curto (-180..180) */
export function turn(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function lerpAngle(a: number | null, b: number | null, k: number): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return (a + turn(a, b) * k + 360) % 360;
}

export interface GlideOptions { maxMs?: number; teleportM?: number }

export class Glide {
  private maxMs: number;
  private teleportM: number;
  constructor(opts: GlideOptions = {}) {
    this.maxMs = opts.maxMs ?? MAX_GLIDE_MS;
    this.teleportM = opts.teleportM ?? TELEPORT_M;
  }
  private from: GlidePoint | null = null;
  private to: GlidePoint | null = null;
  private t0 = 0;
  private dur = 0;
  private lastFixAt: number | null = null;
  /** muda a cada leitura aceita (quem desenha pode pular quadros parados) */
  version = 0;

  /** leitura nova do GPS; `now` em ms (performance.now() ou Date.now(), sempre o mesmo relógio) */
  push(p: GlidePoint, now: number): void {
    const interval = this.lastFixAt == null ? FIRST_GLIDE_MS : now - this.lastFixAt;
    this.lastFixAt = now;
    if (!this.to) { this.from = this.to = p; this.dur = 0; this.t0 = now; this.version++; return; }
    const cur = this.at(now)!;
    const d = distM(cur, p);
    if (d > this.teleportM) { this.from = this.to = p; this.dur = 0; this.t0 = now; this.version++; return; }
    if (distM(this.to, p) < STILL_M) {
      // parado: só deixa a direção girar se ela mudou de verdade
      if (p.heading == null || this.to.heading == null || Math.abs(turn(this.to.heading, p.heading)) < 3) return;
      this.from = cur; this.to = { ...this.to, heading: p.heading };
    } else {
      this.from = cur; this.to = { ...p, heading: p.heading ?? cur.heading };
    }
    this.t0 = now;
    this.dur = Math.min(this.maxMs, Math.max(MIN_GLIDE_MS, interval));
    this.version++;
  }

  /** onde o carrinho deve estar desenhado agora */
  at(now: number): GlidePoint | null {
    if (!this.from || !this.to) return null;
    const k = this.dur <= 0 ? 1 : Math.min(1, Math.max(0, (now - this.t0) / this.dur));
    return {
      lat: this.from.lat + (this.to.lat - this.from.lat) * k,
      lon: this.from.lon + (this.to.lon - this.from.lon) * k,
      heading: lerpAngle(this.from.heading, this.to.heading, k),
    };
  }

  /** ainda está deslizando (vale a pena redesenhar) */
  moving(now: number): boolean {
    return !!this.to && this.dur > 0 && now - this.t0 < this.dur;
  }
}

export const SNAP_MAX_M = 25;      // navegando, até essa distância da rota o carrinho anda em cima da linha

/**
 * Onde desenhar o carro: navegando e perto da rota, em cima da linha roxa e virado pra ela
 * (como nos apps de trânsito); longe da rota (saiu, GPS ruim), no ponto do GPS.
 */
export function displayPoint(p: GlidePoint & { accuracy?: number | null }, route: Route | null, hint = 0): GlidePoint {
  const raw = { lat: p.lat, lon: p.lon, heading: p.heading };
  if (!route || route.coords.length < 2) return raw;
  const s = snapToRoute(route, p, hint);
  if (s.off > Math.max(SNAP_MAX_M, Math.min(40, p.accuracy ?? 0))) return raw;
  // andando ao contrário da rota: mantém a direção real
  const heading = p.heading != null && angleDiff(p.heading, s.segBearing) > 90 ? p.heading : Math.round(s.segBearing) % 360;
  return { lat: s.point.lat, lon: s.point.lon, heading };
}
