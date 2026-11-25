import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorHex, guessSummary, guessToCar, type CarGuess } from '../carGuess.ts';

const g: CarGuess = { e_carro: true, body_type: 'picape', cor: 'Vermelho', marca: 'Volkswagen', modelo: 'Saveiro G5',
  vidro: 'fume', aerofolio: false, rebaixado: true, confianca: 0.92 };

test('palpite da IA vira os campos da garagem', () => {
  assert.deepEqual(guessToCar(g), { body_type: 'picape', color: '#D23B3B', make: 'Volkswagen', model: 'Saveiro G5',
    tint: 'fume', spoiler: false, ride_height_cm: 8 });
  // não rebaixado: não mexe na altura; marca vazia mantém a digitada
  const c = guessToCar({ ...g, rebaixado: false, marca: '', modelo: '' }, { make: 'VW', model: 'Saveiro' });
  assert.equal(c.ride_height_cm, undefined);
  assert.equal(c.make, 'VW');
  assert.equal(c.model, 'Saveiro');
});

test('cor pelo nome (cor desconhecida vira prata)', () => {
  assert.equal(colorHex('azul-bebê'), '#7CC4F5');
  assert.equal(colorHex('Dourado'), '#B9C0CB');
});

test('frase do resultado', () => {
  assert.equal(guessSummary(g, 'Picape'), 'Volkswagen Saveiro G5 · Picape · Vermelho · vidro fumê · rebaixado');
  assert.match(guessSummary({ ...g, confianca: 0.6 }, 'Picape'), /confere se acertei/);
  assert.match(guessSummary({ ...g, confianca: 0.3, marca: '', modelo: '' }, 'Picape'), /^Picape · Vermelho.*não tenho certeza/);
});
