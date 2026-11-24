// Serviço de rotas do Marcha GPS (Cloudflare Worker).
//   GET  /buscar?q=texto&lat=&lon=   -> { lugares: Place[] }   (precisa de login)
//   POST /rota { de: {lat, lon, heading?}, para: {lat, lon} } -> Route   (precisa de login)
// Agendado: importa lombadas e radares do OpenStreetMap, uma cidade por vez.
import { AuthError, verifyJwt, type Jwk } from '../../fotos/src/jwt';
import { preflight, withCors } from '../../fotos/src/cors';
import { normalizeQuery, parsePhoton, photonUrl } from './geocode';
import { RouteError, parseValhalla, validPoint, valhallaBody, VALHALLA_URL } from './route';
import { RateLimiter } from './limits';
import { OVERPASS_URLS, TILES, neonSqlUrl, overpassQuery, type Tile } from './obstacles';

interface Env {
  CLERK_ISSUER: string;
  IMPORT_DATABASE_URL?: string; // usuário "importador" do Neon (só pode chamar import_osm_obstacles)
}

const UA = 'MarchaGPS/0.1 (+https://marcha-gps.vercel.app)';
const searchLimit = new RateLimiter(30, 60_000);
const routeLimit = new RateLimiter(20, 60_000);

let jwksCache: { keys: Jwk[]; at: number } | null = null;
async function getJwks(issuer: string): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.at < 10 * 60_000) return jwksCache.keys;
  const res = await fetch(`${issuer}/.well-known/jwks.json`);
  if (!res.ok) throw new Error('jwks_indisponivel');
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache = { keys: body.keys, at: Date.now() };
  return body.keys;
}

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...extra } });

async function userFrom(req: Request, env: Env): Promise<string> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const claims = await verifyJwt(token, await getJwks(env.CLERK_ISSUER), { issuer: env.CLERK_ISSUER });
  return claims.sub;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') return preflight();
    return withCors(await handle(req, env, ctx));
  },

  // De hora em hora: importa a primeira faixa que está vencida (6 dias). Se o Overpass falhar,
  // tenta de novo na hora seguinte. Quase sempre não há nada a fazer e só consulta o banco.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(importNextTile(env));
  },
};

async function handle(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  if (!env.CLERK_ISSUER) return json({ error: 'servico_nao_configurado' }, 503);

  let user: string;
  try {
    user = await userFrom(req, env);
  } catch (e) {
    return json({ error: e instanceof AuthError ? e.message : 'nao_autenticado' }, 401);
  }

  if (req.method === 'GET' && url.pathname === '/buscar') {
    const q = normalizeQuery(url.searchParams.get('q') ?? '');
    if (q.length < 3) return json({ lugares: [] });
    if (!searchLimit.allow(user)) return json({ error: 'muitas_buscas' }, 429);
    const lat = Number(url.searchParams.get('lat')), lon = Number(url.searchParams.get('lon'));
    const target = photonUrl(q, Number.isFinite(lat) && Number.isFinite(lon) && url.searchParams.has('lat') ? { lat, lon } : null);

    // mesma busca perto do mesmo lugar: responde do cache por 1 dia
    const cache = caches.default;
    const key = new Request(target, { method: 'GET' });
    const hit = await cache.match(key);
    if (hit) return json({ lugares: parsePhoton(await hit.json()) });

    const res = await fetch(target, { headers: { 'user-agent': UA, accept: 'application/json' } });
    if (!res.ok) return json({ error: 'busca_indisponivel' }, 502);
    const body = await res.json();
    ctx.waitUntil(cache.put(key, new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400' },
    })));
    return json({ lugares: parsePhoton(body) });
  }

  if (req.method === 'POST' && url.pathname === '/rota') {
    if (!routeLimit.allow(user)) return json({ error: 'muitas_rotas' }, 429);
    let input: { de?: unknown; para?: unknown };
    try { input = await req.json(); } catch { return json({ error: 'pedido_invalido' }, 400); }
    if (!validPoint(input.de) || !validPoint(input.para)) return json({ error: 'pedido_invalido' }, 400);
    const res = await fetch(VALHALLA_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': UA },
      body: JSON.stringify(valhallaBody(input.de as never, input.para)),
    });
    if (res.status === 429) return json({ error: 'servidor_ocupado' }, 503);
    let body: unknown;
    try { body = await res.json(); } catch { return json({ error: 'rota_indisponivel' }, 502); }
    try {
      return json(parseValhalla(body));
    } catch (e) {
      const code = e instanceof RouteError ? e.message : 'rota_indisponivel';
      return json({ error: code }, code === 'rota_indisponivel' ? 502 : 422);
    }
  }

  return json({ error: 'nao_encontrado' }, 404);
}

async function sql(env: Env, query: string, params: unknown[]): Promise<unknown[]> {
  const res = await fetch(neonSqlUrl(env.IMPORT_DATABASE_URL!), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Neon-Connection-String': env.IMPORT_DATABASE_URL! },
    body: JSON.stringify({ query, params }),
  });
  const body = (await res.json().catch(() => ({}))) as { rows?: unknown[]; message?: string };
  if (!res.ok) throw new Error(`banco ${res.status} ${body.message ?? ''}`);
  return body.rows ?? [];
}

async function importNextTile(env: Env): Promise<void> {
  if (!env.IMPORT_DATABASE_URL) return;
  for (const tile of TILES) {
    const [row] = (await sql(env, 'select public.osm_import_due($1) as due', [tile.id])) as { due: boolean }[];
    if (row?.due) { await importTile(tile, env); return; }
  }
}

async function importTile(tile: Tile, env: Env): Promise<void> {
  let csv: string | null = null;
  for (const server of OVERPASS_URLS) {
    try {
      const res = await fetch(server, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
        body: new URLSearchParams({ data: overpassQuery(tile) }),
      });
      const text = await res.text();
      // o Overpass às vezes responde 200 com erro no texto; CSV bom começa com node/way
      if (res.ok && (text === '' || /^(node|way)\t/.test(text))) { csv = text; break; }
      console.log(`overpass ${tile.id} ${server}: ${res.status} ${text.slice(0, 120)}`);
    } catch (e) {
      console.log(`overpass ${tile.id} ${server}: ${(e as Error).message}`);
    }
  }
  if (csv == null) return;
  const rows = await sql(env, 'select public.import_osm_obstacles($1, $2) as novos', [tile.id, csv]);
  console.log(`import ${tile.id}: ${csv.length} bytes, ${JSON.stringify(rows)}`);
}
