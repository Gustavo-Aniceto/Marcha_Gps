// Fala com o serviço de rotas (workers/api): busca de lugares e cálculo de rota.
import { authToken } from './db';
import type { RouteResponse } from './nav.ts';

const base = process.env.EXPO_PUBLIC_API_URL;

export interface Place { id: string; name: string; detail: string; lat: number; lon: number }

export class RoutingError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!base) throw new RoutingError('servico_nao_configurado');
  const token = await authToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers });
  } catch {
    throw new RoutingError('sem_internet');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new RoutingError((body as { error?: string }).error ?? 'rota_indisponivel');
  return body as T;
}

export async function searchPlaces(q: string, near?: { lat: number; lon: number } | null): Promise<Place[]> {
  const p = new URLSearchParams({ q });
  if (near) { p.set('lat', String(near.lat)); p.set('lon', String(near.lon)); }
  const { lugares } = await call<{ lugares: Place[] }>(`/buscar?${p}`);
  return lugares;
}

export function fetchRoute(from: { lat: number; lon: number; heading?: number | null }, to: { lat: number; lon: number }) {
  return call<RouteResponse>('/rota', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ de: from, para: to }),
  });
}
