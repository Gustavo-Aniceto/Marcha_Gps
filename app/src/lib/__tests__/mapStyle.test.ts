import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapStyle, PALETTES, SOURCE, SOURCE_LAYERS, type MapTheme } from '../mapStyle.ts';

const themes: MapTheme[] = ['noite', 'dia', 'cena'];
type L = { id: string; type: string; source?: string; 'source-layer'?: string; layout?: Record<string, unknown> };

for (const theme of themes) {
  test(`estilo ${theme}: estrutura válida`, () => {
    const s = buildMapStyle(theme) as { version: number; layers: L[]; sources: Record<string, unknown>; glyphs: string };
    assert.equal(s.version, 8);
    const ids = s.layers.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length, 'ids repetidos');
    assert.equal(s.layers[0].type, 'background');
    for (const l of s.layers) {
      if (l.type === 'background') continue;
      assert.equal(l.source, SOURCE, l.id);
      assert.ok((SOURCE_LAYERS as readonly string[]).includes(l['source-layer']!), `${l.id}: source-layer`);
    }
    if (s.layers.some((l) => l.type === 'symbol')) assert.match(s.glyphs, /\{fontstack\}.*\{range\}/);
  });

  test(`estilo ${theme}: cores válidas`, () => {
    for (const [k, v] of Object.entries(PALETTES[theme])) {
      if (typeof v === 'string') assert.match(v, /^#[0-9A-F]{6}$/i, `${theme}.${k}`);
    }
  });
}

test('noite e dia têm prédios 3D; cena é 2D', () => {
  const has3d = (t: MapTheme) => (buildMapStyle(t) as { layers: L[] }).layers.some((l) => l.type === 'fill-extrusion');
  assert.ok(has3d('noite'));
  assert.ok(has3d('dia'));
  assert.ok(!has3d('cena'));
});

test('cena é escura e sem nomes de lugares (fica limpa pra ver os carros)', () => {
  const s = buildMapStyle('cena') as { layers: L[] };
  assert.ok(!s.layers.some((l) => l.id === 'lugares'));
  assert.equal(PALETTES.cena.background.toUpperCase(), '#191A1C');
});
