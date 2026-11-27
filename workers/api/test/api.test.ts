import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePhoton, photonUrl, normalizeQuery } from '../src/geocode.ts';
import { cleanAvoid, MAX_AVOID, parseValhalla, valhallaBody, validPoint, RouteError } from '../src/route.ts';
import { RateLimiter } from '../src/limits.ts';
import { overpassQuery, neonSqlUrl, TILES, cellId, cellTile } from '../src/obstacles.ts';

test('busca: monta o endereço do Photon com SP e perto de mim', () => {
  const u = new URL(photonUrl('  av   paulista  ', { lat: -23.5613, lon: -46.6565 }));
  assert.equal(u.searchParams.get('q'), 'av paulista');
  assert.equal(u.searchParams.get('lat'), '-23.56');
  assert.equal(u.searchParams.get('lon'), '-46.66');
  assert.equal(u.searchParams.get('bbox'), '-74.1,-33.9,-28.8,5.4');
  assert.equal(normalizeQuery('a'.repeat(500)).length, 120);
});

test('busca: lugar com nome e endereço, rua sem nome e repetidos', () => {
  const lugares = parsePhoton({ features: [
    { geometry: { coordinates: [-46.65, -23.56] }, properties: { osm_type: 'N', osm_id: 1, name: 'MASP', street: 'Avenida Paulista', housenumber: '1578', district: 'Bela Vista', city: 'São Paulo' } },
    { geometry: { coordinates: [-46.65, -23.56] }, properties: { osm_type: 'N', osm_id: 1, name: 'MASP' } },
    { geometry: { coordinates: [-46.40, -23.47] }, properties: { osm_type: 'W', osm_id: 2, street: 'Rua Tal', housenumber: '10', city: 'Itaquaquecetuba' } },
    { geometry: { coordinates: [-46.4, -23.4] }, properties: {} },
    { properties: { name: 'sem ponto' } },
  ] });
  assert.equal(lugares.length, 2);
  assert.deepEqual(lugares[0], { id: 'N1', name: 'MASP', detail: 'Avenida Paulista, 1578 · Bela Vista · São Paulo', lat: -23.56, lon: -46.65 });
  assert.equal(lugares[1].name, 'Rua Tal, 10');
  assert.equal(lugares[1].detail, 'Itaquaquecetuba');
  assert.deepEqual(parsePhoton(null), []);
});

test('rota: pedido pro Valhalla em português, com a direção do carro no recálculo', () => {
  const b = valhallaBody({ lat: -23.5, lon: -46.6, heading: 370 }, { lat: -23.4, lon: -46.5 });
  assert.equal(b.costing, 'auto');
  assert.equal(b.directions_options.language, 'pt-BR');
  assert.equal(b.locations[0].heading, 10);
  assert.equal(b.locations[0].heading_tolerance, 60);
  assert.equal(valhallaBody({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }).locations[0].heading, undefined);
  assert.ok(validPoint({ lat: -23, lon: -46 }));
  assert.ok(!validPoint({ lat: 'x', lon: 1 }));
  assert.ok(!validPoint({ lat: 95, lon: 1 }));
});

test('rota: converte a resposta e os erros do Valhalla', () => {
  const r = parseValhalla({ trip: { summary: { length: 2.345, time: 300.4 }, legs: [{ shape: 'abc', maneuvers: [
    { type: 1, instruction: 'Siga para o norte na Rua A.', verbal_pre_transition_instruction: 'Siga para o norte.', length: 0.2, time: 30, begin_shape_index: 0, street_names: ['Rua A'] },
    { type: 15, instruction: 'Vire à esquerda na Rua B.', length: 1.1, time: 120, begin_shape_index: 5 },
    { type: 26, instruction: 'Entre na rotatória.', length: 0.3, time: 30, begin_shape_index: 9, roundabout_exit_count: 2 },
    { type: 4, instruction: 'Você chegou ao destino.', length: 0, time: 0, begin_shape_index: 20 },
  ] }] } });
  assert.equal(r.distance_m, 2345);
  assert.equal(r.time_s, 300);
  assert.deepEqual(r.maneuvers.map((m) => m.kind), ['depart', 'left', 'roundabout', 'arrive']);
  assert.equal(r.maneuvers[1].speak, 'Vire à esquerda na Rua B.');
  assert.equal(r.maneuvers[2].exit, 2);
  assert.equal(r.maneuvers[0].street, 'Rua A');
  assert.throws(() => parseValhalla({ error_code: 442, error: 'No path' }), (e: unknown) => e instanceof RouteError && e.message === 'sem_caminho');
  assert.throws(() => parseValhalla({ error_code: 171 }), /longe_da_rua/);
  assert.throws(() => parseValhalla({}), /rota_indisponivel/);
});

test('limite por pessoa por minuto', () => {
  const l = new RateLimiter(2, 60_000);
  assert.ok(l.allow('a', 0));
  assert.ok(l.allow('a', 1));
  assert.ok(!l.allow('a', 2));
  assert.ok(l.allow('b', 2));
  assert.ok(l.allow('a', 60_001));
});

test('importação: 12 quadrados cobrem as 3 cidades e a consulta do Overpass é curta', () => {
  const q = overpassQuery(TILES[0]);
  assert.equal(TILES.length, 12);
  assert.match(q, /\[bbox:-23\.4700,-46\.8300,-23\.2900,-46\.6400\]/);
  assert.match(q, /\[timeout:25\]/);
  assert.match(q, /out:csv\(::type,::id,::lat,::lon,traffic_calming,highway,hazard,maxspeed;false;"\\t"\)/);
  assert.match(q, /out center;/);
  // juntos, os quadrados cobrem a caixa toda sem buraco nem sobra (área = soma das áreas)
  const area = TILES.reduce((s, t) => s + (t.north - t.south) * (t.east - t.west), 0);
  assert.ok(Math.abs(area - (24.01 - 23.29) * (46.83 - 46.30)) < 1e-9);
  assert.equal(Math.min(...TILES.map((t) => t.west)), -46.83);
  assert.equal(Math.max(...TILES.map((t) => t.east)), -46.30);
  assert.equal(Math.min(...TILES.map((t) => t.south)), -24.01);
  assert.equal(Math.max(...TILES.map((t) => t.north)), -23.29);
  assert.equal(new Set(TILES.map((t) => t.id)).size, 12);
  for (const t of TILES) assert.match(t.id, /^[a-z_]{1,30}$/);
  assert.equal(neonSqlUrl('postgresql://importador:segredo@ep-x-123-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require'),
    'https://ep-x-123.c-2.sa-east-1.aws.neon.tech/sql');
});

test('rota desviando: manda os pontos a evitar pro Valhalla', () => {
  const de = { lat: -23.55, lon: -46.63 }, para = { lat: -23.50, lon: -46.60 };
  const evitar = cleanAvoid([{ lat: -23.53, lon: -46.62 }, { lat: 'x', lon: 1 }, { lat: -23.55, lon: -46.6301 }], de, para);
  assert.equal(evitar.length, 1, 'ignora inválido e o que fica colado na saída');
  const b = valhallaBody(de, para, evitar) as { exclude_locations?: unknown[] };
  assert.deepEqual(b.exclude_locations, [{ lat: -23.53, lon: -46.62 }]);
  assert.equal((valhallaBody(de, para) as { exclude_locations?: unknown }).exclude_locations, undefined);
});

test('rota desviando: no máximo 40 pontos', () => {
  const de = { lat: -23.55, lon: -46.63 }, para = { lat: -23.40, lon: -46.40 };
  const muitos = Array.from({ length: 100 }, (_, i) => ({ lat: -23.52 + i * 0.001, lon: -46.55 }));
  assert.equal(cleanAvoid(muitos, de, para).length, MAX_AVOID);
  assert.deepEqual(cleanAvoid('nada', de, para), []);
});

test('quadrados marcados: mesmo id que area_cell() do banco e caixa de 0,2°', () => {
  assert.equal(cellId(-8.05, -34.90), 'g409_725');
  const t = cellTile('g409_725')!;
  assert.deepEqual([t.south, t.west, t.north, t.east], [-8.2, -35, -8, -34.8]);
  assert.ok(-8.05 >= t.south && -8.05 < t.north && -34.90 >= t.west && -34.90 < t.east);
  assert.equal(cellTile('oeste_a'), null);
  assert.equal(cellTile('g9999_1'), null);
  assert.match(overpassQuery(t), /\[bbox:-8\.2000,-35\.0000,-8\.0000,-34\.8000\]/);
});

test('proxy do login: acha o endereço do Neon Auth e só repassa cabeçalhos do navegador', async () => {
  const { authTarget, proxyHeaders } = await import('../src/authproxy.ts');
  assert.equal(authTarget('https://great-aphid-3258.clerk.accounts.dev, https://ep-x.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth/'),
    'https://ep-x.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth');
  assert.equal(authTarget('https://great-aphid-3258.clerk.accounts.dev'), null);
  const h = proxyHeaders(new Headers({ cookie: 'a=1', origin: 'https://marcha-gps.vercel.app', 'x-forwarded-host': 'marcha-gps.vercel.app',
    'x-vercel-id': 'x', host: 'api', 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4' }));
  assert.deepEqual([...h.keys()].sort(), ['content-type', 'cookie', 'origin']);
});
