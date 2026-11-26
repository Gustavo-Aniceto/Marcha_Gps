// Comboio: quem está junto, quem chegou, quem ficou pra trás. Só distância até o destino
// (em linha reta) e há quanto tempo veio a última posição. Nada de velocidade nem "quem chegou primeiro".
import { distM } from './nav.ts';

export interface ConvoyMember {
  username: string;
  me?: boolean;
  lat: number | null;
  lon: number | null;
  updated_at: string | null;
}

export type ConvoyStatus = 'chegou' | 'junto' | 'atras' | 'sem_sinal';

export interface ConvoyRow extends ConvoyMember {
  status: ConvoyStatus;
  /** metros atrás de quem está mais perto do destino (só pra "atras") */
  gap_m: number | null;
  dist_m: number | null;
}

export const ARRIVED_M = 200;     // chegou no destino
export const BEHIND_M = 1500;     // mais de 1,5 km atrás do primeiro = ficou pra trás
export const STALE_MS = 3 * 60_000; // sem posição há 3 min = sem sinal

export function convoyRows(members: ConvoyMember[], dest: { lat: number; lon: number }, now = Date.now()): ConvoyRow[] {
  const dist = members.map((m) => {
    const fresh = m.lat != null && m.lon != null && m.updated_at != null && now - new Date(m.updated_at).getTime() <= STALE_MS;
    return fresh ? distM({ lat: m.lat!, lon: m.lon! }, dest) : null;
  });
  // referência: quem está na estrada mais perto do destino (quem já chegou não puxa a régua)
  const onRoad = dist.filter((d): d is number => d != null && d > ARRIVED_M);
  const lead = onRoad.length ? Math.min(...onRoad) : null;
  return members.map((m, i) => {
    const d = dist[i];
    if (d == null) return { ...m, status: 'sem_sinal', gap_m: null, dist_m: null };
    if (d <= ARRIVED_M) return { ...m, status: 'chegou', gap_m: null, dist_m: Math.round(d) };
    const gap = lead == null ? 0 : d - lead;
    return gap > BEHIND_M
      ? { ...m, status: 'atras', gap_m: Math.round(gap), dist_m: Math.round(d) }
      : { ...m, status: 'junto', gap_m: null, dist_m: Math.round(d) };
  });
}

/** Aviso curto pro mapa: quem ficou pra trás (fora você). */
export function convoyAlert(rows: ConvoyRow[]): string | null {
  const behind = rows.filter((r) => r.status === 'atras' && !r.me);
  if (!behind.length) return null;
  if (behind.length === 1) return `@${behind[0].username} ficou pra trás (${fmtKm(behind[0].gap_m!)})`;
  return `${behind.length} ficaram pra trás`;
}

export function fmtKm(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m / 10) * 10} m`;
}

export const STATUS_TEXT: Record<ConvoyStatus, string> = {
  chegou: 'CHEGOU', junto: 'JUNTO', atras: 'FICOU PRA TRÁS', sem_sinal: 'SEM SINAL',
};
