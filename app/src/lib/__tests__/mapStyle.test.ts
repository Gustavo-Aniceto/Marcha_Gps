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

test('mapa limpo como nos apps de trânsito: prédios planos em todos os temas e rua menor com contorno no GPS', () => {
  const layers = (t: MapTheme) => (buildMapStyle(t) as { layers: L[] }).layers;
  for (const t of ['noite', 'dia', 'cena'] as MapTheme[]) {
    assert.ok(!layers(t).some((l) => l.type === 'fill-extrusion'), t);
    assert.ok(layers(t).some((l) => l.id === 'predios'), t);
  }
  assert.ok(layers('noite').some((l) => l.id === 'ruas-menores-contorno'));
  assert.ok(!layers('cena').some((l) => l.id === 'ruas-menores-contorno'));
});

test('cena é escura e sem nomes de lugares (fica limpa pra ver os carros)', () => {
  const s = buildMapStyle('cena') as { layers: L[] };
  assert.ok(!s.layers.some((l) => l.id === 'lugares'));
  assert.equal(PALETTES.cena.background.toUpperCase(), '#191A1C');
});
