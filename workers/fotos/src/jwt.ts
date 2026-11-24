// Confere o token (JWT) do Clerk: assinatura RS256 com a chave pública (JWKS), validade, emissor e usuário.
// Só usa WebCrypto, então roda igual no Cloudflare Worker e no Node (testes).

export interface Jwk { kid?: string; kty: string; n?: string; e?: string; alg?: string; use?: string }
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
  if (header.alg !== 'RS256') throw new AuthError('algoritmo_invalido');

  const jwk = jwks.find((k) => k.kty === 'RSA' && (!header.kid || k.kid === header.kid));
  if (!jwk) throw new AuthError('chave_desconhecida');

  const key = await crypto.subtle.importKey(
    'jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true } as JsonWebKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) throw new AuthError('assinatura_invalida');

  const c = decodeJson<Claims>(p);
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const leeway = opts.leewaySec ?? 30;
  if (typeof c.exp !== 'number' || c.exp + leeway < now) throw new AuthError('token_vencido');
  if (typeof c.nbf === 'number' && c.nbf - leeway > now) throw new AuthError('token_ainda_nao_vale');
  if (c.iss !== opts.issuer) throw new AuthError('emissor_invalido');
  if (typeof c.sub !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(c.sub)) throw new AuthError('usuario_invalido');
  return c;
}
