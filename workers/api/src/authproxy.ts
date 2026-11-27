// O login do Neon Auth guarda a sessão num cookie. Se o app falasse direto com o endereço do Neon,
// o Safari (iPhone) bloquearia esse cookie (é de outro site). Por isso o app fala com
// marcha-gps.vercel.app/api/auth/* (mesmo site), a Vercel repassa pra cá e daqui vai pro Neon.
// O Neon recusa x-forwarded-host (INVALID_HOSTNAME): só passam os cabeçalhos do navegador.
const PROXY_KEEP = ['accept', 'accept-language', 'content-type', 'cookie', 'origin', 'referer', 'user-agent'];
export function authTarget(raw: string): string | null {
  return raw.split(',').map((x) => x.trim().replace(/\/+$/, '')).find((u) => /\.neonauth\./.test(u)) ?? null;
}
export function proxyHeaders(src: Headers): Headers {
  const out = new Headers();
  for (const k of PROXY_KEEP) { const v = src.get(k); if (v) out.set(k, v); }
  return out;
}
