// Serviço de fotos do Marcha GPS (Cloudflare Worker + R2).
//   POST /upload?tipo=media|carro|post   (corpo = a imagem; Authorization: Bearer <token do Clerk>)
//        -> { key }  a chave que o app grava no banco
//   GET  /img/<key>                         -> a imagem (chave impossível de adivinhar)
import { AuthError, authSources, verifyFromSources, type Jwk } from './jwt';
import { preflight, withCors } from './cors';
import { KEY_RE, KINDS, MAX_BYTES, extFor, keyFor, looksLikeImage, type Kind } from './uploads';

interface R2Object { body: ReadableStream; httpMetadata?: { contentType?: string } }
interface R2Bucket {
  put(key: string, value: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
}
export interface Env {
  FOTOS: R2Bucket;
  AUTH_URLS?: string; // endereços de login aceitos (Neon Auth), separados por vírgula
  CLERK_ISSUER?: string; // antigo (Clerk); vale enquanto AUTH_URLS não existir
}

// chaves públicas de cada login aceito, guardadas por 10 min
const jwksCache = new Map<string, { keys: Jwk[]; at: number }>();
async function getJwks(jwksUrl: string): Promise<Jwk[]> {
  const hit = jwksCache.get(jwksUrl);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.keys;
  const res = await fetch(jwksUrl);
  if (!res.ok) throw new Error('jwks_indisponivel');
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache.set(jwksUrl, { keys: body.keys, at: Date.now() });
  return body.keys;
}
const authRaw = (env: { AUTH_URLS?: string; CLERK_ISSUER?: string }) => env.AUTH_URLS ?? env.CLERK_ISSUER ?? '';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return preflight();
    return withCors(await handle(req, env));
  },
};

async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === 'GET' && url.pathname.startsWith('/img/')) {
    const key = decodeURIComponent(url.pathname.slice('/img/'.length));
    if (!KEY_RE.test(key)) return json({ error: 'chave_invalida' }, 400);
    const obj = await env.FOTOS.get(key);
    if (!obj) return json({ error: 'nao_encontrada' }, 404);
    return new Response(obj.body, {
      headers: {
        'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  }

  if (req.method === 'POST' && url.pathname === '/upload') {
    if (!authRaw(env)) return json({ error: 'servico_nao_configurado' }, 503);
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    let sub: string;
    try {
      const claims = await verifyFromSources(token, authSources(authRaw(env)), getJwks);
      sub = claims.sub;
    } catch (e) {
      return json({ error: e instanceof AuthError ? e.message : 'nao_autenticado' }, 401);
    }

    const kind = url.searchParams.get('tipo') as Kind;
    if (!KINDS.includes(kind)) return json({ error: 'tipo_invalido' }, 400);
    const ext = extFor(req.headers.get('content-type'));
    if (!ext) return json({ error: 'formato_invalido' }, 415);
    const len = Number(req.headers.get('content-length') ?? '0');
    if (len > MAX_BYTES) return json({ error: 'arquivo_grande' }, 413);

    const buf = await req.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return json({ error: 'arquivo_grande' }, 413);
    if (!looksLikeImage(new Uint8Array(buf), ext)) return json({ error: 'nao_e_imagem' }, 415);

    const key = keyFor(kind, sub, crypto.randomUUID(), ext);
    await env.FOTOS.put(key, buf, {
      httpMetadata: { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` },
      customMetadata: { user: sub, at: new Date().toISOString() },
    });
    return json({ key });
  }

  return json({ error: 'nao_encontrado' }, 404);
}
