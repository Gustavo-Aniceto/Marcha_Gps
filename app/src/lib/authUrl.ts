// Endereço do login (puro, testado). No navegador é sempre o próprio site + /api/auth.
// EXPO_PUBLIC_AUTH_URL troca isso (ex.: rodando local sem a Vercel na frente).
export const APP_ORIGIN = 'https://marcha-gps.vercel.app';

export function authBaseUrl(origin: string | null | undefined, override?: string | null): string {
  const o = override?.trim();
  if (o) return o.replace(/\/+$/, '');
  const base = origin && /^https?:\/\//.test(origin) ? origin : APP_ORIGIN;
  return `${base.replace(/\/+$/, '')}/api/auth`;
}

/** Erros do login em português (códigos do Better Auth / Neon Auth). */
export function authErrorText(e: unknown): string {
  const raw = e as { code?: string; message?: string; status?: number; error?: { code?: string; message?: string } } | null;
  const code = String(raw?.code ?? raw?.error?.code ?? '').toUpperCase();
  const msg = String(raw?.message ?? raw?.error?.message ?? '');
  if (/INVALID_OTP|INVALID_CODE|OTP_EXPIRED/.test(code) || /invalid otp|expired/i.test(msg)) return 'Código errado ou vencido. Confere no e-mail ou pede outro.';
  if (/TOO_MANY_ATTEMPTS/.test(code) || /too many/i.test(msg) || raw?.status === 429) return 'Muitas tentativas. Espera um pouco e pede um código novo.';
  if (/INVALID_EMAIL/.test(code) || /invalid email/i.test(msg)) return 'Esse e-mail não parece certo.';
  if (/fetch|network|Failed to fetch|NetworkError/i.test(msg)) return 'Sem conexão. Confere a internet e tenta de novo.';
  return 'Não deu pra entrar agora. Tenta de novo.';
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
