import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, readableAccent, inkOn, isHex } from '../contrast.ts';
import { colors } from '../../theme/tokens.ts';

test('contraste preto e branco é 21', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#FFFFFF')), 21);
});

test('cor clara da equipe fica como está', () => {
  assert.equal(readableAccent('#c6ff3d'), '#C6FF3D');
});

test('cor escura é clareada até dar pra ler no fundo', () => {
  const c = readableAccent('#5B2A86');
  assert.notEqual(c, '#5B2A86');
  assert.ok(contrastRatio(c, colors.bg) >= 4.5);
});

test('texto do botão: escuro em cor clara, branco em cor escura', () => {
  assert.equal(inkOn('#C6FF3D'), colors.ink);
  assert.equal(inkOn('#5B2A86'), '#FFFFFF');
});

test('valida hex', () => {
  assert.ok(isHex('#3FA0FF'));
  assert.ok(!isHex('azul'));
  assert.throws(() => readableAccent('azul'));
});
