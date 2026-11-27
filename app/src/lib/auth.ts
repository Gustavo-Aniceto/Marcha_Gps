// Login pelo Neon Auth (Better Auth gerenciado pelo Neon; usuários ficam no próprio banco, schema neon_auth).
// O app fala com /api/auth no PRÓPRIO endereço: a Vercel repassa pro marcha-gps-api, que repassa pro Neon.
// Assim o cookie da sessão é "nosso" e o Safari do iPhone não bloqueia (com o endereço do Neon direto, bloqueava).
import { createAuthClient } from '@neon/auth';
import { authBaseUrl } from './authUrl.ts';

export const authClient = createAuthClient(
  authBaseUrl(typeof window !== 'undefined' && window.location ? window.location.origin : null, process.env.EXPO_PUBLIC_AUTH_URL),
);

export interface AuthUser { id: string; email: string | null }

/** Quem está logado agora (null = ninguém). Nunca joga erro: sem rede conta como "não sei", e volta null. */
export async function currentUser(): Promise<AuthUser | null> {
  try {
    const { data } = await authClient.getSession();
    return data?.user ? { id: data.user.id, email: data.user.email ?? null } : null;
  } catch {
    return null;
  }
}

/** Token (JWT) pro banco e pros serviços. O SDK guarda e renova sozinho antes de vencer (15 min). */
export async function sessionToken(): Promise<string | null> {
  try {
    const { data } = await authClient.getSession();
    return data?.session?.token ?? null;
  } catch {
    return null;
  }
}
