// Confere o token (JWT) do login: Neon Auth (EdDSA / Ed25519) ou Clerk (RS256, enquanto durar a troca).
// Assinatura com a chave pública (JWKS), validade, emissor, público (aud) e usuário.
// Só usa WebCrypto, então roda igual no Cloudflare Worker e no Node (testes).

export interface Jwk { kid?: string; kty: string; n?: string; e?: string; crv?: string; x?: string; alg?: string; use?: string }
export interface Claims { sub: string; iss: string; exp: number; nbf?: number; iat?: number; role?: string; [k: string]: unknown }

export class AuthError extends Error {}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJson<T>(part: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(part))) as T;
  } catch {
    throw new AuthError('token_malformado');
  }
}

export async function verifyJwt(
  token: string,
  jwks: Jwk[],
  opts: { issuer: string; now?: number; leewaySec?: number },
): Promise<Claims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('token_malformado');
  const [h, p, sig] = parts;
  const header = decodeJson<{ alg?: string; kid?: string; typ?: string }>(h);
  const data = new TextEncoder().encode(`${h}.${p}`);
  let ok = false;
  if (header.alg === 'RS256') {
    const jwk = jwks.find((k) => k.kty === 'RSA' && (!header.kid || k.kid === header.kid));
    if (!jwk) throw new AuthError('chave_desconhecida');
    const key = await crypto.subtle.importKey(
      'jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true } as JsonWebKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
    );
    ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), data);
  } else if (header.alg === 'EdDSA') {
    const jwk = jwks.find((k) => k.kty === 'OKP' && k.crv === 'Ed25519' && (!header.kid || k.kid === header.kid));
    if (!jwk) throw new AuthError('chave_desconhecida');
    const key = await crypto.subtle.importKey(
      'jwk', { kty: 'OKP', crv: 'Ed25519', x: jwk.x, ext: true } as JsonWebKey, { name: 'Ed25519' }, false, ['verify'],
    );
    ok = await crypto.subtle.verify({ name: 'Ed25519' }, key, b64urlToBytes(sig), data);
  } else {
    throw new AuthError('algoritmo_invalido');
  }
  if (!ok) throw new AuthError('assinatura_invalida');

  const c = decodeJson<Claims>(p);
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const leeway = opts.leewaySec ?? 30;
  if (typeof c.exp !== 'number' || c.exp + leeway < now) throw new AuthError('token_vencido');
  if (typeof c.nbf === 'number' && c.nbf - leeway > now) throw new AuthError('token_ainda_nao_vale');
  if (c.iss !== opts.issuer) throw new AuthError('emissor_invalido');
  // Neon Auth põe aud = emissor; o Clerk não manda aud. Se vier, tem que ser pra nós.
  if (c.aud !== undefined) {
    const auds = Array.isArray(c.aud) ? c.aud : [c.aud];
    if (!auds.includes(opts.issuer)) throw new AuthError('publico_invalido');
  }
  if (typeof c.sub !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(c.sub)) throw new AuthError('usuario_invalido');
  return c;
}

/** Endereços de login aceitos (AUTH_URLS), separados por vírgula. Ex.: a URL do Neon Auth
 *  (https://ep-xxx.neonauth.../neondb/auth). O emissor do token é a origem da URL e as chaves
 *  ficam em <url>/.well-known/jwks.json (no Clerk a URL já é a origem, então vale igual). */
export interface AuthSource { issuer: string; jwksUrl: string }
export function authSources(raw: string | undefined): AuthSource[] {
  return (raw ?? '').split(',').map((x) => x.trim().replace(/\/+$/, '')).filter(Boolean).flatMap((u) => {
    try { return [{ issuer: new URL(u).origin, jwksUrl: `${u}/.well-known/jwks.json` }]; } catch { return []; }
  });
}

/** Só os emissores (pra checagem de saúde e testes). */
export function issuerList(raw: string | undefined): string[] {
  return authSources(raw).map((s) => s.issuer);
}

/** Lê o emissor do token SEM conferir a assinatura (só pra escolher qual chave baixar). */
export function peekIssuer(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try { const c = decodeJson<{ iss?: unknown }>(parts[1]); return typeof c.iss === 'string' ? c.iss : null; } catch { return null; }
}

/** Confere o token contra o emissor dele, desde que esteja na lista. */
export async function verifyFromIssuers(
  token: string, issuers: string[], jwksOf: (issuer: string) => Promise<Jwk[]>, opts: { now?: number; leewaySec?: number } = {},
): Promise<Claims> {
  const iss = peekIssuer(token);
  if (!iss) throw new AuthError('token_malformado');
  if (!issuers.includes(iss)) throw new AuthError('emissor_invalido');
  return verifyJwt(token, await jwksOf(iss), { ...opts, issuer: iss });
}

/** Confere o token contra a fonte de login do emissor dele (lista AUTH_URLS). */
export async function verifyFromSources(
  token: string, sources: AuthSource[], jwksAt: (jwksUrl: string) => Promise<Jwk[]>, opts: { now?: number; leewaySec?: number } = {},
): Promise<Claims> {
  const iss = peekIssuer(token);
  if (!iss) throw new AuthError('token_malformado');
  const src = sources.find((s) => s.issuer === iss);
  if (!src) throw new AuthError('emissor_invalido');
  return verifyJwt(token, await jwksAt(src.jwksUrl), { ...opts, issuer: iss });
}
