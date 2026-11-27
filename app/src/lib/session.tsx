// Sessão: login pelo Neon Auth + perfil no banco (Neon).
// Logado mas sem perfil = ainda não entrou com convite (ou é conta antiga do Clerk: aí reconecta pelo e-mail).
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authClient, currentUser, sessionToken, type AuthUser } from './auth';
import { db, setTokenGetter, type Profile } from './db';

interface SessionState {
  loading: boolean;
  signedIn: boolean;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  /** Relê quem está logado (depois de entrar com o código ou voltar do Google). */
  refreshAuth: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

// Todo pedido ao banco leva o token do login (o token já traz "role": "authenticated").
setTokenGetter(sessionToken);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const refreshAuth = useCallback(async () => {
    const u = await currentUser();
    setUser((old) => (old?.id === u?.id && old?.email === u?.email ? old : u));
    setAuthLoaded(true);
  }, []);

  // ao abrir (inclusive voltando do Google: o SDK troca o código da volta pela sessão) e ao voltar pro app
  useEffect(() => {
    refreshAuth();
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const onFocus = () => { refreshAuth(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshAuth]);

  const loadProfile = useCallback(async () => {
    if (!user) { setProfile(null); setProfileLoaded(true); return; }
    // o próprio perfil vem por função: a tabela só mostra nome e id dos outros
    let { data } = await db.rpc('my_profile').maybeSingle();
    if (!data) {
      // conta antiga (login do Clerk): mesmo e-mail verificado = mesma pessoa, traz perfil, carro e equipe
      const { data: claim } = await db.rpc('claim_legacy_account');
      if (claim === 'recuperada') ({ data } = await db.rpc('my_profile').maybeSingle());
    }
    setProfile((data as Profile | null) ?? null);
    setProfileLoaded(true);
  }, [user]);

  useEffect(() => {
    if (!authLoaded) return;
    setProfileLoaded(false);
    loadProfile();
  }, [authLoaded, loadProfile]);

  const value: SessionState = {
    loading: !authLoaded || !profileLoaded,
    signedIn: !!user,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    profile,
    refreshAuth,
    refreshProfile: loadProfile,
    signOut: async () => {
      try { await authClient.signOut(); } catch { /* sem rede: sai do mesmo jeito aqui */ }
      setProfile(null);
      setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession fora do SessionProvider');
  return v;
}
