import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invitePage, inviteTexts, normalizeCode } from '../src/convitepage.ts';

test('convite: normaliza o código do link', () => {
  assert.equal(normalizeCode('7k2q-lf9a'), null); // L e F não são hexa (código é 0-9A-F)
  assert.equal(normalizeCode('ab12-cd34'), 'AB12-CD34');
  assert.equal(normalizeCode('AB12CD34'), 'AB12-CD34');
  assert.equal(normalizeCode('xx'), null);
});

test('convite: prévia com quem convidou e a equipe; fundador não mostra o master', () => {
  const t = inviteTexts({ status: 'ok', kind: 'app', inviter: 'dono.c', inviter_name: 'Dono', crew_name: 'Equipe C' });
  assert.equal(t.title, 'Dono (@dono.c) da Equipe C te convidou pro Marcha GPS');
  const f = inviteTexts({ status: 'ok', kind: 'fundador', inviter: null, inviter_name: null, crew_name: null });
  assert.match(f.title, /fundador/);
  assert.equal(inviteTexts({ status: 'usado', kind: null, inviter: null, inviter_name: null, crew_name: null }).headline, 'Esse convite já foi usado.');
});

test('convite: página tem Open Graph, escapa texto e só redireciona convite válido', () => {
  const html = invitePage('AB12-CD34', { status: 'ok', kind: 'app', inviter: 'x<script>', inviter_name: null, crew_name: '"Crew"' });
  assert.match(html, /property="og:image" content="https:\/\/marcha-gps.vercel.app\/og-convite.png"/);
  assert.ok(!html.includes('x<script>'));
  assert.match(html, /inicio\?codigo=AB12-CD34/);
  const bad = invitePage('AB12-CD34', { status: 'vencido', kind: null, inviter: null, inviter_name: null, crew_name: null });
  assert.ok(!bad.includes('http-equiv="refresh"'));
});
