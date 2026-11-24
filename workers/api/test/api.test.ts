import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePhoton, photonUrl, normalizeQuery } from '../src/geocode.ts';
import { parseValhalla, valhallaBody, validPoint, RouteError } from '../src/route.ts';
import { RateLimiter } from '../src/limits.ts';
import { overpassQuery, neonSqlUrl, TILES } from '../src/obstacles.ts';

test('busca: monta o endereço do Photon com SP e perto de mim', () => {
  const u = new URL(photonUrl('  av   paulista  ', { lat: -23.5613, lon: -46.6565 }));
  assert.equal(u.searchParams.get('q'), 'av paulista');
  assert.equal(u.searchParams.get('lat'), '-23.56');
  assert.equal(u.searchParams.get('lon'), '-46.66');
  assert.equal(u.searchParams.get('bbox'), '-53.2,-25.4,-44.1,-19.7');
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

test('importação: faixas cobrem as 3 cidades e a consulta do Overpass é por caixa', () => {
  const q = overpassQuery(TILES[0]);
  assert.match(q, /\[bbox:-24\.0100,-46\.8300,-23\.2900,-46\.6400\]/);
  assert.match(q, /out:csv\(::type,::id,::lat,::lon,traffic_calming,highway,hazard,maxspeed;false;"\\t"\)/);
  assert.match(q, /out center;/);
  // juntas, as faixas cobrem de -46.83 a -46.30 sem buraco
  for (let i = 1; i < TILES.length; i++) assert.equal(TILES[i].west, TILES[i - 1].east);
  assert.equal(TILES[0].west, -46.83);
  assert.equal(TILES[TILES.length - 1].east, -46.30);
  for (const t of TILES) assert.match(t.id, /^[a-z_]{1,30}$/);
  assert.equal(neonSqlUrl('postgresql://importador:segredo@ep-x-123-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require'),
    'https://ep-x-123.c-2.sa-east-1.aws.neon.tech/sql');
});
