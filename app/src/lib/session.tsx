// Sessão: login pelo Clerk + perfil no banco (Neon).
// Logado no Clerk mas sem perfil = ainda não entrou com convite.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth, useClerk } from '@clerk/expo';
import { db, setTokenGetter, type Profile } from './db';

interface SessionState {
  loading: boolean;
  signedIn: boolean;
  userId: string | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth({ treatPendingAsSignedOut: false });
  const { signOut } = useClerk();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Todo pedido ao banco leva o token do Clerk (o token já traz "role": "authenticated").
  useEffect(() => {
    setTokenGetter(async () => (isSignedIn ? await getToken() : null));
  }, [isSignedIn, getToken]);

  const loadProfile = useCallback(async () => {
    if (!isSignedIn || !userId) { setProfile(null); setProfileLoaded(true); return; }
    const { data } = await db
      .from('profiles')
      .select('id, username, is_master, invites_left, visibility, precise_for_scene, delay_minutes')
      .eq('id', userId)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
    setProfileLoaded(true);
  }, [isSignedIn, userId]);

  useEffect(() => {
    if (!isLoaded) return;
    setProfileLoaded(false);
    loadProfile();
  }, [isLoaded, loadProfile]);

  const value: SessionState = {
    loading: !isLoaded || !profileLoaded,
    signedIn: !!isSignedIn,
    userId: userId ?? null,
    profile,
    refreshProfile: loadProfile,
    signOut: async () => { await signOut(); setProfile(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession fora do SessionProvider');
  return v;
}
