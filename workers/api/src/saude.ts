// Saúde do app: erros que o app manda (POST /erro) e a checagem de hora em hora dos serviços.
// Tudo puro aqui (sem rede), pra dar pra testar; quem chama é o index.ts.

export const DATA_API_URL = 'https://ep-dark-night-b607qc86.apirest.c-2.sa-east-1.aws.neon.tech/neondb/rest/v1';

export interface Check {
  service: string;            // nome curto (vai pro banco e pro aviso do master)
  url: string;
  method?: 'GET' | 'HEAD';
  /** status que contam como "no ar" */
  ok: (status: number) => boolean;
}

/** O que a checagem olha. Login de produção entra pela lista de emissores do Clerk (CLERK_ISSUER). */
export function healthChecks(issuers: string[], photonUrl: string): Check[] {
  const checks: Check[] = [
    // sem token a Data API responde 401: quer dizer que está de pé
    { service: 'dados', url: `${DATA_API_URL}/cities?select=id&limit=1`, ok: (s) => s < 500 },
    { service: 'busca', url: photonUrl, ok: (s) => s === 200 },
    { service: 'rotas', url: 'https://valhalla1.openstreetmap.de/status', ok: (s) => s === 200 },
    { service: 'mapa', url: 'https://tiles.openfreemap.org/planet', ok: (s) => s === 200 },
    { service: 'site', url: 'https://marcha-gps.vercel.app/', ok: (s) => s === 200 },
  ];
  for (const iss of issuers) {
    const prod = !/\.clerk\.accounts\.dev$/.test(new URL(iss).hostname);
    checks.push({ service: prod ? 'login_producao' : 'login_teste', url: `${iss}/.well-known/jwks.json`, ok: (s) => s === 200 });
  }
  return checks;
}

export interface ErrorReport {
  message: string;
  stack: string | null;
  screen: string | null;
  version: string | null;
}

const clip = (v: unknown, n: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  return s ? s.slice(0, n) : null;
};

/** Limpa o que o app mandou. Tira token/e-mail que às vezes aparece em mensagem de erro. */
export function cleanError(body: unknown): ErrorReport | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const scrub = (s: string | null) => s && s
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/([?&](?:token|code|codigo|__clerk[^=]*)=)[^&\s]+/gi, '$1[x]');
  const message = scrub(clip(b.message, 500));
  if (!message) return null;
  return {
    message,
    stack: scrub(clip(b.stack, 4000)),
    screen: scrub(clip(b.screen, 200))?.split('?')[0] ?? null,
    version: clip(b.version, 40),
  };
}
