import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { REPORT_KINDS, pointsText } from '../reports.ts';
import { friendlyError } from '../errors.ts';

const migrations = join(dirname(fileURLToPath(import.meta.url)), '../../../../db/migrations');
const sql = readdirSync(migrations).map((f) => readFileSync(join(migrations, f), 'utf8')).join('\n');

test('pontos do app batem com report_points() do banco', () => {
  const fn = sql.slice(sql.indexOf('function public.report_points'), sql.indexOf('function public.report_ttl'));
  for (const k of REPORT_KINDS) {
    const line = fn.split('\n').find((l) => l.includes(`'${k.kind}'`));
    const pts = line ? Number(/then (\d+)/.exec(line)![1]) : Number(/else (\d+)/.exec(fn)![1]);
    assert.equal(k.points, pts, `pontos de ${k.kind}`);
  }
});

test('todo tipo do app existe no check da tabela reports', () => {
  const check = sql.slice(sql.indexOf('create table public.reports'), sql.indexOf('create table public.report_votes'));
  for (const k of REPORT_KINDS) assert.ok(check.includes(`'${k.kind}'`), k.kind);
});

test('texto dos pontos', () => {
  assert.match(pointsText('blitz'), /^10 pontos .* 1 hora/);
  assert.match(pointsText('lombada'), /^15 pontos/);
});

test('erros do banco viram mensagem em português', () => {
  assert.equal(friendlyError({ message: 'outside_area' }), 'Por enquanto o Marcha GPS funciona só em São Paulo, Guarulhos e Itaquá.');
  assert.equal(friendlyError(new Error('qualquer coisa')), 'Deu ruim. Tenta de novo.');
});
