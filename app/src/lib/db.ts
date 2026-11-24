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

async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
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
  } | null;
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
}
