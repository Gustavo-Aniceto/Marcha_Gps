// Cliente da Data API do Neon (é um PostgREST, então usa o cliente PostgREST padrão).
// O token do Clerk vai em cada requisição; as regras de acesso ficam no banco (RLS + funções).
import 'react-native-url-polyfill/auto';
import { PostgrestClient } from '@supabase/postgrest-js';

const url = process.env.EXPO_PUBLIC_NEON_DATA_API_URL;
if (!url) throw new Error('Configure EXPO_PUBLIC_NEON_DATA_API_URL no app/.env');

type TokenGetter = () => Promise<string | null>;
let getToken: TokenGetter = async () => null;

/** Chamado pelo SessionProvider com o getToken() do Clerk. */
export function setTokenGetter(fn: TokenGetter) {
  getToken = fn;
}

/** Token do Clerk pra outros serviços (ex.: fotos). */
export function authToken(): Promise<string | null> {
  return getToken();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Token do Clerk; logo depois de abrir o app ele pode demorar um instante: espera um pouco antes de ir sem. */
async function tokenSoon(): Promise<string | null> {
  for (let i = 0; i < 6; i++) {
    const t = await getToken().catch(() => null);
    if (t) return t;
    await sleep(250);
  }
  return null;
}

async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const send = async () => {
    const token = await tokenSoon();
    const headers = new Headers(init?.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };
  const res = await send();
  // às vezes o banco não reconhece o login na hora (token chegando junto com várias chamadas):
  // tenta de novo uma vez, com o token renovado, antes de mostrar erro
  if (res.status === 400 || res.status === 401) {
    const body = await res.clone().text().catch(() => '');
    if (/not_authenticated|JWT expired|jwt expired/i.test(body)) {
      await sleep(400);
      return send();
    }
  }
  return res;
}

export const db = new PostgrestClient(url, { fetch: authFetch });

// Formatos que voltam das funções do banco
export interface VisibleCar {
  user_id: string;
  username: string;
  lat: number;
  lon: number;
  heading: number | null;
  approximate: boolean;
  same_crew: boolean;
  updated_at: string;
  car: {
    make: string; model: string; color: string; ride_height_cm: number; suspension: string;
    rim: number; wheel_position: string; camber_deg: number; tint: string; spoiler: boolean; neon: string | null;
    body_type?: string;
  } | null;
  /** equipes que vocês dois fazem parte (verificados) */
  crews?: string[] | null;
}

export interface Profile {
  id: string; // ID do usuário no Clerk
  username: string;
  is_master: boolean;
  invites_left: number;
  visibility: 'ghost' | 'crew' | 'scene';
  precise_for_scene: boolean;
  delay_minutes: 0 | 2 | 5;
  avatar_key: string | null;
  display_name?: string | null;
  bio?: string | null;
  notify_prefs?: { equipes: boolean; eventos: boolean; social: boolean } | null;
  joined_at?: string | null;
}
