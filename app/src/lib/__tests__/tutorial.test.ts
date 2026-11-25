import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextStep, TUTORIAL } from '../tutorial.ts';
import { GLYPHS, glyphFor, parseReportImageId, reportImageId } from '../reportGlyphs.ts';
import { REPORT_KINDS } from '../reports.ts';

test('tutorial: passos com id único e texto que cabe em tela pequena', () => {
  assert.ok(TUTORIAL.length >= 5);
  assert.equal(new Set(TUTORIAL.map((s) => s.id)).size, TUTORIAL.length);
  for (const s of TUTORIAL) {
    assert.ok(s.title.length > 0 && s.title.length <= 32, s.id);
    assert.ok(s.text.length > 0 && s.text.length <= 260, `${s.id}: ${s.text.length}`);
    assert.ok(s.where.length > 0 && s.icon.startsWith('M'), s.id);
  }
});

test('tutorial: anda até o fim', () => {
  let i: number | null = 0, n = 1;
  while ((i = nextStep(i!)) != null) n++;
  assert.equal(n, TUTORIAL.length);
});

test('avisos no mapa: todo tipo tem desenho e o nome da imagem volta igual', () => {
  for (const k of REPORT_KINDS) assert.ok(GLYPHS[k.kind], `falta desenho de ${k.kind}`);
  assert.equal(glyphFor('desconhecido').length, 1);
  assert.deepEqual(parseReportImageId(reportImageId('radar', 60)), { kind: 'radar', speed: 60 });
  assert.deepEqual(parseReportImageId(reportImageId('lombada', 60)), { kind: 'lombada', speed: 0 });
  assert.equal(parseReportImageId('outra-coisa'), null);
});
