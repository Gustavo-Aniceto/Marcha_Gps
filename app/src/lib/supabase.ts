import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no app/.env');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

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
  id: string;
  username: string;
  is_master: boolean;
  invites_left: number;
  visibility: 'ghost' | 'crew' | 'scene';
  precise_for_scene: boolean;
  delay_minutes: 0 | 2 | 5;
}
