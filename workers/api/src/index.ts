// Serviço de rotas do Marcha GPS (Cloudflare Worker).
//   GET  /buscar?q=texto&lat=&lon=   -> { lugares: Place[] }   (precisa de login)
//   POST /rota { de: {lat, lon, heading?}, para: {lat, lon}, evitar?: [{lat, lon}] } -> Route   (precisa de login)
//   GET  /convite?codigo=XXXX-XXXX -> { status, kind, crew_name }   (sem login, limite por IP)
//   POST /carro/analisar { fotos: [dataURI] } -> CarGuess  (IA com visão monta o carrinho; precisa de login)
//   GET  /fipe/marcas | /fipe/modelos?marca= | /fipe/anos?marca=&modelo= | /fipe/valor?marca=&modelo=&ano=  (tabela FIPE, com cache; precisa de login)
// Agendado: importa lombadas e radares do OpenStreetMap, uma faixa por vez, e os radares oficiais
// (CET, DER, ANTT; src/radares.ts) uma vez por semana.
import { AuthError, issuerList, verifyFromIssuers, type Jwk } from '../../fotos/src/jwt';
import { preflight, withCors } from '../../fotos/src/cors';
import { normalizeQuery, parsePhoton, photonUrl } from './geocode';
import { RouteError, cleanAvoid, parseValhalla, validPoint, valhallaBody, VALHALLA_URL } from './route';
import { RateLimiter } from './limits';
import { OVERPASS_URLS, TILES, neonSqlUrl, overpassQuery, type Tile } from './obstacles';
import { VISION_MODEL, parseGuess, validPhotos, visionRequest } from './carro';
import { fipeTarget, parseFipe } from './fipe';
import { OFFICIAL_SOURCES, OFFICIAL_URLS, anttLatestCsv, decodeText, type OfficialSource } from './radares';

interface Env {
  CLERK_ISSUER: string;
  IMPORT_DATABASE_URL?: string; // usuário "importador" do Neon (só pode chamar import_osm_obstacles)
  AI?: { run(model: string, input: unknown): Promise<unknown> }; // Workers AI (montar carro pela foto)
}

const UA = 'MarchaGPS/0.1 (+https://marcha-gps.vercel.app)';
const searchLimit = new RateLimiter(30, 60_000);
const routeLimit = new RateLimiter(20, 60_000);
const inviteLimit = new RateLimiter(10, 60_000); // por IP: conferir convite não precisa de login
// IA de visão: poucas por pessoa (cota grátis de 10 mil "neurônios" por dia na conta)
const carMinute = new RateLimiter(4, 60_000);
const carDay = new RateLimiter(20, 24 * 60 * 60_000);
const fipeLimit = new RateLimiter(60, 60_000);

// chaves públicas de cada emissor (modo teste e produção do Clerk), guardadas por 10 min
const jwksCache = new Map<string, { keys: Jwk[]; at: number }>();
async function getJwks(issuer: string): Promise<Jwk[]> {
  const hit = jwksCache.get(issuer);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.keys;
  const res = await fetch(`${issuer}/.well-known/jwks.json`);
  if (!res.ok) throw new Error('jwks_indisponivel');
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache.set(issuer, { keys: body.keys, at: Date.now() });
  return body.keys;
}

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...extra } });

async function userFrom(req: Request, env: Env): Promise<string> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const claims = await verifyFromIssuers(token, issuerList(env.CLERK_ISSUER), getJwks);
  return claims.sub;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') return preflight();
    return withCors(await handle(req, env, ctx));
  },

  // De hora em hora: importa o primeiro quadrado que está vencida (6 dias). Se o Overpass falhar,
  // tenta de novo na hora seguinte. Quase sempre não há nada a fazer e só consulta o banco.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(importNextTile(env));
    ctx.waitUntil(importOfficialRadars(env));
  },
};

async function handle(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);

  // Convite antes do login (única rota sem login). Responde só se o código vale, e pra qual equipe.
  if (req.method === 'GET' && url.pathname === '/convite') {
    const ip = req.headers.get('cf-connecting-ip') ?? 'sem-ip';
    if (!inviteLimit.allow(ip)) return json({ error: 'muitas_tentativas' }, 429);
    const code = (url.searchParams.get('codigo') ?? '').toUpperCase().trim();
    if (!/^[0-9A-F]{4}-[0-9A-F]{4}$/.test(code)) return json({ status: 'nao_existe', kind: null, crew_name: null });
    if (!env.IMPORT_DATABASE_URL) return json({ error: 'servico_nao_configurado' }, 503);
    try {
      const [row] = await sql(env, 'select status, kind, crew_name from public.check_invite($1)', [code]);
      return json(row ?? { status: 'nao_existe', kind: null, crew_name: null });
    } catch {
      return json({ error: 'convite_indisponivel' }, 502);
    }
  }

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
    let input: { de?: unknown; para?: unknown; evitar?: unknown };
    try { input = await req.json(); } catch { return json({ error: 'pedido_invalido' }, 400); }
    if (!validPoint(input.de) || !validPoint(input.para)) return json({ error: 'pedido_invalido' }, 400);
    const res = await fetch(VALHALLA_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': UA },
      body: JSON.stringify(valhallaBody(input.de as never, input.para, cleanAvoid(input.evitar, input.de, input.para))),
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

  if (req.method === 'POST' && url.pathname === '/carro/analisar') {
    if (!env.AI) return json({ error: 'servico_nao_configurado' }, 503);
    if (!carMinute.allow(user) || !carDay.allow(user)) return json({ error: 'muitas_analises' }, 429);
    let input: unknown;
    try { input = await req.json(); } catch { return json({ error: 'pedido_invalido' }, 400); }
    const photos = validPhotos(input);
    if (!photos) return json({ error: 'fotos_invalidas' }, 400);
    try {
      const guess = parseGuess(await env.AI.run(VISION_MODEL, visionRequest(photos)));
      if (!guess) return json({ error: 'nao_reconheci' }, 422);
      if (!guess.e_carro) return json({ error: 'nao_e_carro' }, 422);
      return json(guess);
    } catch (e) {
      console.log('ia carro', String(e).slice(0, 300));
      return json({ error: 'ia_indisponivel' }, 502);
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/fipe/')) {
    const target = fipeTarget(url.pathname, url.searchParams);
    if (!target) return json({ error: 'pedido_invalido' }, 400);
    if (!fipeLimit.allow(user)) return json({ error: 'muitas_buscas' }, 429);
    // a API pública aceita poucos pedidos por dia: quase tudo sai do cache
    const cache = caches.default;
    const key = new Request(target.url, { method: 'GET' });
    const hit = await cache.match(key);
    if (hit) return json(parseFipe(url.pathname, await hit.json()));
    const res = await fetch(target.url, { headers: { 'user-agent': UA, accept: 'application/json' } });
    if (res.status === 429) return json({ error: 'fipe_ocupada' }, 503);
    if (!res.ok) return json({ error: 'fipe_indisponivel' }, 502);
    const body = await res.json();
    const parsed = parseFipe(url.pathname, body);
    if (!parsed) return json({ error: 'fipe_indisponivel' }, 502);
    ctx.waitUntil(cache.put(key, new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${target.ttl}` },
    })));
    return json(parsed);
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

// Radares oficiais (CET, DER, ANTT): cada fonte de 6 em 6 dias (mesmo controle das faixas). O banco faz a leitura.
async function importOfficialRadars(env: Env): Promise<void> {
  if (!env.IMPORT_DATABASE_URL) return;
  for (const src of OFFICIAL_SOURCES) {
    const [row] = (await sql(env, 'select public.osm_import_due($1) as due', [`oficial_${src}`])) as { due: boolean }[];
    if (!row?.due) continue;
    try {
      const text = await downloadOfficial(src);
      const [res] = await sql(env, 'select public.import_official_radars($1, $2) as r', [src, text]);
      console.log(`radares ${src}: ${JSON.stringify(res)}`);
    } catch (e) {
      console.log(`radares ${src}: ${(e as Error).message}`.slice(0, 300));
    }
  }
}

async function downloadOfficial(src: OfficialSource): Promise<string> {
  let url = OFFICIAL_URLS[src];
  if (src === 'antt') {
    const pkg = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
    const latest = anttLatestCsv(await pkg.json().catch(() => null));
    if (!latest) throw new Error('antt sem csv');
    url = latest;
  }
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  return decodeText(await res.arrayBuffer());
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
