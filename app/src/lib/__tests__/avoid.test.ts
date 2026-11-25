import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avoidPoints, blockingAhead, hitsCar, offerText, shouldOffer } from '../avoid.ts';

const baixo = { ride_height_cm: 8, suspension: 'fixa' };
const alto = { ride_height_cm: 15, suspension: 'original' };
const ob = (id: string, kind: string, base_risk: number) => ({ id, kind, base_risk, lat: -23.5, lon: -46.6 });

test('só obstáculo físico que pega no carro conta', () => {
  assert.equal(hitsCar(ob('1', 'lombada', 2), baixo), true);
  assert.equal(hitsCar(ob('2', 'lombada', 2), alto), false, 'carro alto passa');
  assert.equal(hitsCar(ob('3', 'radar', 3), baixo), false, 'radar não é altura');
  assert.equal(hitsCar(ob('4', 'blitz', 3), baixo), false);
  assert.equal(hitsCar(ob('5', 'valeta', 0), baixo), false, 'sem risco passa');
});

test('obstáculos à frente: ignora o que já passou e repetido, na ordem da rota', () => {
  const list = [
    { item: ob('a', 'lombada', 3), along: 500 },
    { item: ob('b', 'valeta', 3), along: 100 },
    { item: ob('a', 'lombada', 3), along: 500 },
    { item: ob('c', 'radar', 3), along: 300 },
    { item: ob('d', 'buraco', 3), along: 50 },
  ];
  const r = blockingAhead(list, baixo, 80);
  assert.deepEqual(r.map((o) => o.item.id), ['b', 'a']);
});

test('pontos a evitar: no máximo 40', () => {
  const many = Array.from({ length: 60 }, (_, i) => ({ item: ob(String(i), 'lombada', 3), along: i }));
  assert.equal(avoidPoints(many).length, 40);
});

test('pergunta só se a outra rota desvia de algo e não demora demais', () => {
  // 20 min faltando: aceita até 10 min a mais
  assert.deepEqual(shouldOffer({ blocking: 3, remaining_s: 1200 }, { blocking: 0, time_s: 1500 }), { offer: true, extra_s: 300, avoided: 3 });
  assert.equal(shouldOffer({ blocking: 3, remaining_s: 1200 }, { blocking: 0, time_s: 2000 }).offer, false, '+13 min é demais');
  assert.equal(shouldOffer({ blocking: 2, remaining_s: 600 }, { blocking: 2, time_s: 600 }).offer, false, 'não desvia de nada');
  // viagem curta: sempre aceita até 5 min
  assert.equal(shouldOffer({ blocking: 1, remaining_s: 240 }, { blocking: 0, time_s: 500 }).offer, true);
  // viagem longa: teto de 20 min
  assert.equal(shouldOffer({ blocking: 5, remaining_s: 7200 }, { blocking: 0, time_s: 7200 + 1500 }).offer, false);
});

test('texto da pergunta', () => {
  const t = offerText({ avoided: 3, total: 3, extra_s: 240 });
  assert.equal(t.title, 'Tem 3 obstáculos nesse caminho que pegam no seu carro');
  assert.equal(t.detail, 'Achei outro caminho que desvia de tudo · +4 min');
  assert.match(t.speak, /Quer trocar\?$/);
  assert.equal(offerText({ avoided: 1, total: 2, extra_s: 0 }).detail, 'Achei outro caminho que desvia de 1 · no mesmo tempo');
  assert.equal(offerText({ avoided: 1, total: 1, extra_s: 60 }).title, 'Tem 1 obstáculo nesse caminho que pega no seu carro');
});
