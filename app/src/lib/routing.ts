// Fala com o serviço de rotas (workers/api): busca de lugares e cálculo de rota.
import { authToken } from './db';
import type { RouteResponse } from './nav.ts';
import type { CarGuess } from './carGuess.ts';

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

/** `evitar`: pontos (lombadas/valetas) que a rota deve desviar, se der. */
export function fetchRoute(from: { lat: number; lon: number; heading?: number | null }, to: { lat: number; lon: number },
  evitar: { lat: number; lon: number }[] = []) {
  return call<RouteResponse>('/rota', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(evitar.length ? { de: from, para: to, evitar } : { de: from, para: to }),
  });
}

export interface InviteCheck { status: 'ok' | 'nao_existe' | 'usado' | 'vencido'; kind: 'fundador' | 'app' | 'equipe' | null; crew_name: string | null }

/** Confere o convite antes do login (o serviço de rotas responde sem login, com limite por IP). */
export async function checkInvite(code: string): Promise<InviteCheck> {
  if (!base) throw new RoutingError('servico_nao_configurado');
  let res: Response;
  try {
    res = await fetch(`${base}/convite?codigo=${encodeURIComponent(code)}`);
  } catch {
    throw new RoutingError('sem_internet');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new RoutingError((body as { error?: string }).error ?? 'convite_indisponivel');
  return body as InviteCheck;
}

/** IA olha as fotos (data URI JPEG) e diz tipo, cor, marca e modelo do carro. */
export function analyzeCar(photos: string[]) {
  return call<CarGuess>('/carro/analisar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fotos: photos }),
  });
}

/** Mensagem pros erros do "montar pelas fotos". */
export function carErrorText(code: string): string {
  switch (code) {
    case 'nao_e_carro': return 'Não achei um carro nessa foto. Manda uma foto do carro inteiro, de lado ou de frente.';
    case 'nao_reconheci': return 'Não consegui reconhecer o carro. Tenta outra foto, com o carro inteiro e boa luz.';
    case 'muitas_analises': return 'Muitas tentativas seguidas. Espera um pouco e tenta de novo.';
    case 'fotos_invalidas': return 'Foto não aceita. Usa foto JPG ou PNG (até 3).';
    case 'sem_internet': return 'Sem internet. Confere a conexão e tenta de novo.';
    case 'nao_autenticado': case 'token_vencido': return 'Sua sessão expirou. Entre de novo.';
    default: return 'A montagem automática está fora agora. Monta manualmente aqui embaixo ou tenta mais tarde.';
  }
}

// Tabela FIPE: primeiro pelo serviço (com cache); se a API pública barrar o servidor, o app pede direto.
import { fipeDirectUrl, parseFipeRaw, type FipeItem, type FipeKind, type FipeValor } from './fipe.ts';

async function fipe<T>(kind: FipeKind, path: string, marca = '', modelo = '', ano = ''): Promise<T> {
  try {
    return await call<T>(path);
  } catch (e) {
    const code = e instanceof RoutingError ? e.message : '';
    if (code !== 'fipe_ocupada' && code !== 'fipe_indisponivel') throw e;
    const url = fipeDirectUrl(kind, marca, modelo, ano);
    if (!url) throw e;
    let res: Response;
    try { res = await fetch(url, { headers: { accept: 'application/json' } }); } catch { throw new RoutingError('sem_internet'); }
    if (res.status === 429) throw new RoutingError('fipe_ocupada');
    const parsed = res.ok ? parseFipeRaw(kind, await res.json().catch(() => null)) : null;
    if (!parsed) throw new RoutingError('fipe_indisponivel');
    return parsed as T;
  }
}

const q = encodeURIComponent;
export const fipeMarcas = () => fipe<FipeItem[]>('marcas', '/fipe/marcas');
export const fipeModelos = (marca: string) => fipe<FipeItem[]>('modelos', `/fipe/modelos?marca=${q(marca)}`, marca);
export const fipeAnos = (marca: string, modelo: string) =>
  fipe<FipeItem[]>('anos', `/fipe/anos?marca=${q(marca)}&modelo=${q(modelo)}`, marca, modelo);
export const fipeValor = (marca: string, modelo: string, ano: string) =>
  fipe<FipeValor>('valor', `/fipe/valor?marca=${q(marca)}&modelo=${q(modelo)}&ano=${q(ano)}`, marca, modelo, ano);
