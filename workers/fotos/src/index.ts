// Serviço de fotos do Marcha GPS (Cloudflare Worker + R2).
//   POST /upload?tipo=media|carro|post   (corpo = a imagem; Authorization: Bearer <token do Clerk>)
//        -> { key }  a chave que o app grava no banco
//   GET  /img/<key>                         -> a imagem (chave impossível de adivinhar)
import { AuthError, verifyJwt, type Jwk } from './jwt';
import { KEY_RE, KINDS, MAX_BYTES, extFor, keyFor, looksLikeImage, type Kind } from './uploads';

interface R2Object { body: ReadableStream; httpMetadata?: { contentType?: string } }
interface R2Bucket {
  put(key: string, value: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
}
export interface Env {
  FOTOS: R2Bucket;
  CLERK_ISSUER: string; // ex.: https://xxx.clerk.accounts.dev
}

let jwksCache: { keys: Jwk[]; at: number } | null = null;

async function getJwks(issuer: string): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.at < 10 * 60_000) return jwksCache.keys;
  const res = await fetch(`${issuer}/.well-known/jwks.json`);
  if (!res.ok) throw new Error('jwks_indisponivel');
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache = { keys: body.keys, at: Date.now() };
  return body.keys;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
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
      if (!env.CLERK_ISSUER) return json({ error: 'servico_nao_configurado' }, 503);
      const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
      let sub: string;
      try {
        const claims = await verifyJwt(token, await getJwks(env.CLERK_ISSUER), { issuer: env.CLERK_ISSUER });
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
  },
};
