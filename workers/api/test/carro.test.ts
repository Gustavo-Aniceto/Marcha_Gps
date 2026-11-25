import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY_IDS, COLOR_NAMES, parseGuess, validPhotos, visionRequest } from '../src/carro.ts';
import { BODIES, CAR_COLORS } from '../../../app/src/lib/carBodies.ts';

const jpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

test('carro: listas iguais às do app (tipo e cor)', () => {
  assert.deepEqual([...BODY_IDS], BODIES.map((b) => b.id));
  assert.deepEqual([...COLOR_NAMES], CAR_COLORS.map(([, n]) => n));
});

test('carro: aceita de 1 a 3 fotos em data URI e recusa o resto', () => {
  assert.deepEqual(validPhotos({ fotos: [jpg] }), [jpg]);
  assert.equal(validPhotos({ fotos: [] }), null);
  assert.equal(validPhotos({ fotos: [jpg, jpg, jpg, jpg] }), null);
  assert.equal(validPhotos({ fotos: ['https://exemplo.com/a.jpg'] }), null);
  assert.equal(validPhotos({ fotos: ['data:image/gif;base64,R0lGOD'] }), null);
  assert.equal(validPhotos({ fotos: ['data:image/jpeg;base64,' + 'A'.repeat(1_500_000)] }), null);
  assert.equal(validPhotos(null), null);
});

test('carro: pedido pro modelo leva todas as fotos e pede JSON no formato', () => {
  const r = visionRequest([jpg, jpg]);
  const user = r.messages[1].content as { type: string }[];
  assert.equal(user.filter((c) => c.type === 'image_url').length, 2);
  assert.equal(r.response_format.type, 'json_schema');
  assert.deepEqual(r.response_format.json_schema.schema.properties.body_type.enum, [...BODY_IDS]);
  assert.equal(r.chat_template_kwargs.enable_thinking, false);
});

test('carro: lê a resposta do modelo em vários formatos', () => {
  const ok = { e_carro: true, body_type: 'picape', cor: 'Vermelho', marca: 'Volkswagen', modelo: 'Saveiro G5',
    vidro: 'fume', aerofolio: false, rebaixado: true, confianca: 0.9 };
  assert.deepEqual(parseGuess({ response: ok }), ok);
  assert.deepEqual(parseGuess({ response: JSON.stringify(ok) }), ok);
  assert.deepEqual(parseGuess({ choices: [{ message: { content: 'Aqui:\n```json\n' + JSON.stringify(ok) + '\n```' } }] }), ok);
});

test('carro: resposta estranha vira palpite seguro', () => {
  const g = parseGuess({ response: { body_type: 'foguete', cor: 'Dourado', marca: '<script>x', confianca: 7 } })!;
  assert.equal(g.body_type, 'hatch');
  assert.equal(g.cor, 'Prata');
  assert.equal(g.marca, 'scriptx');
  assert.equal(g.confianca, 1);
  assert.equal(g.e_carro, true);
  assert.equal(parseGuess({ response: 'não sei' }), null);
  assert.equal(parseGuess(null), null);
  assert.equal(parseGuess({ response: { e_carro: false } })!.e_carro, false);
});
