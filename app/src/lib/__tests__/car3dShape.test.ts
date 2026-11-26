import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODIES } from '../carBodies.ts';
import {
  BASE, axles, baseFor, clearance, partAt, section, stations, topAt, wheelRadius, wheelZ, type ModelDef,
} from '../car3dShape.ts';
import { MODEL_ENTRIES, resolveModel } from '../carModels.ts';

function check(name: string, d: ModelDef) {
  const h = d.L / 2;
  assert.ok(h <= 2.85, `${name}: cabe no quadro`);
  assert.ok(d.cowlX < h && d.cowlX > d.roofFX && d.roofFX > d.roofRX && d.roofRX >= d.deckX && d.deckX > -h,
    `${name}: ordem frente → trás (${d.cowlX} ${d.roofFX} ${d.roofRX} ${d.deckX})`);
  if (d.bedX != null) assert.ok(d.bedX < d.deckX && d.bedX > -h, `${name}: caçamba atrás da cabine`);
  assert.ok(d.roofY > d.hoodY && d.roofY > d.tailY && d.hoodY >= d.noseY, `${name}: alturas`);
  const { front, rear } = axles(d);
  assert.ok(front < h - 0.3 && rear > -h + 0.25 && front > rear, `${name}: eixos dentro do carro`);
  const rw = wheelRadius(17), gc = clearance(d, 8);
  const st = stations(d, rw - gc, rw + 0.03);
  assert.ok(st.length > 60, `${name}: fatias`);
  for (const s of st) {
    assert.ok(s.bottom < s.belt && s.belt <= s.top + 1e-9, `${name}: fundo < cintura <= topo em x=${s.x}`);
    assert.ok(s.w > 0 && s.wRoof > 0 && s.wRoof <= s.w + 1e-9, `${name}: larguras em x=${s.x}`);
    const sec = section(s, d.boxy);
    for (let i = 1; i < sec.length; i++) assert.ok(sec[i][1] >= sec[i - 1][1] - 1e-9, `${name}: fatia sobe em x=${s.x} ponto ${i}`);
  }
}

test('3D: todo tipo de carroceria tem medidas coerentes', () => {
  for (const b of BODIES) {
    assert.ok(BASE[b.id], `falta ${b.id}`);
    check(b.id, BASE[b.id]);
  }
  assert.equal(baseFor('qualquer'), BASE.hatch);
});

test('3D: todo modelo conhecido tem medidas coerentes', () => {
  assert.ok(MODEL_ENTRIES.length > 60);
  for (const m of MODEL_ENTRIES) check(m.id, m.def);
});

test('3D: rodas, vão e lados', () => {
  assert.ok(wheelRadius(17) > wheelRadius(14));
  assert.equal(wheelRadius(99), wheelRadius(22));
  const d = BASE.hatch;
  assert.ok(clearance(d, 5) < clearance(d, 15));
  assert.equal(clearance(d, 0), 0.05);
  assert.ok(wheelZ(d, 'fora') > wheelZ(d, 'alinhada') && wheelZ(d, 'dentro') < wheelZ(d, 'alinhada'));
  // o fundo sobe em cima da roda (arco do para-lama)
  const rw = wheelRadius(15), st = stations(d, rw - clearance(d, 15), rw + 0.03);
  const atAxle = st.reduce((a, s) => (Math.abs(s.x - axles(d).front) < Math.abs(a.x - axles(d).front) ? s : a));
  const mid = st.reduce((a, s) => (Math.abs(s.x) < Math.abs(a.x) ? s : a));
  assert.ok(atAxle.bottom > mid.bottom + 0.2, 'arco da roda');
});

test('3D: vidros e pintura nos lugares certos', () => {
  const d = BASE.seda;
  const st = stations(d, 0.2, 0.33);
  const at = (x: number) => st.reduce((a, s) => (Math.abs(s.x - x) < Math.abs(a.x - x) ? s : a));
  const ws = (d.cowlX + d.roofFX) / 2, roof = (d.roofFX + d.roofRX) / 2, hood = (d.cowlX + d.L / 2) / 2;
  assert.equal(partAt(d, ws, 5, at(ws)), 'glass', 'para-brisa');
  assert.equal(partAt(d, roof, 5, at(roof)), 'paint', 'teto');
  assert.equal(partAt(d, hood, 5, at(hood)), 'paint', 'capô');
  assert.equal(partAt(d, roof, 3, at(roof)), 'glass', 'vidro lateral');
  assert.equal(partAt(d, hood, 3, at(hood)), 'paint', 'lateral do capô');
  assert.equal(partAt(d, roof, 0, at(roof)), 'dark', 'fundo');
  const p = BASE.picape;
  const bed = (p.bedX! - p.L / 2) / 2;
  assert.equal(partAt(p, bed, 5, stations(p, 0.2, 0.33).reduce((a, s) => (Math.abs(s.x - bed) < Math.abs(a.x - bed) ? s : a))), 'bed', 'caçamba');
  assert.ok(topAt(d, 0) > topAt(d, d.L / 2 - 0.1), 'teto mais alto que o capô');
});

test('3D: escolhe o modelo pela marca, modelo e ano', () => {
  assert.equal(resolveModel({ body: 'hatch', make: 'VW', model: 'Gol', year: 1990 }).id, 'gol_g1');
  assert.equal(resolveModel({ body: 'hatch', make: 'Volkswagen', model: 'Gol', year: 1998 }).id, 'gol_g2');
  assert.equal(resolveModel({ body: 'hatch', make: 'VW', model: 'Gol', version: '1.0 Mi Total Flex 8V 4p', year: 2012 }).id, 'gol_g5');
  assert.equal(resolveModel({ body: 'hatch', make: 'VW', model: 'Gol' }).id, 'gol_g7', 'sem ano: genérico');
  assert.equal(resolveModel({ body: 'seda', make: 'GM - Chevrolet', model: 'Opala', version: 'Diplomata 4.1' }).id, 'opala');
  assert.equal(resolveModel({ body: 'esportivo', make: 'Chevrolet', model: 'Opala', version: 'SS Coupé' }).id, 'opala_cp');
  assert.equal(resolveModel({ body: 'hatch', make: 'Fiat', model: 'Uno Mille', year: 2005 }).id, 'uno_old');
  assert.equal(resolveModel({ body: 'seda', make: 'Hyundai', model: 'HB20S' }).id, 'hb20s');
  assert.equal(resolveModel({ body: 'hatch', make: 'Hyundai', model: 'HB20' }).id, 'hb20');
  assert.equal(resolveModel({ body: 'hatch', make: 'VW', model: 'Fusca' }).def.lights, 'round');
  // tipo diferente do modelo: fica com o tipo que a pessoa escolheu
  assert.equal(resolveModel({ body: 'suv', make: 'VW', model: 'Gol' }).id, 'suv');
  assert.equal(resolveModel({ body: 'van' }).label, null);
  // comprimento muda: as posições acompanham
  const golf = resolveModel({ body: 'hatch', make: 'VW', model: 'Golf' }).def;
  assert.ok(golf.deckX < BASE.hatch.deckX && golf.cowlX > BASE.hatch.cowlX);
});
