// Gera map-styles/*.json a partir de src/lib/mapStyle.ts (pra abrir/editar no Maputnik).
// Uso: npm run styles
import { writeFileSync } from 'node:fs';
import { buildMapStyle, type MapTheme } from '../src/lib/mapStyle.ts';

for (const t of ['noite', 'dia', 'cena'] as MapTheme[]) {
  writeFileSync(new URL(`../map-styles/${t}.json`, import.meta.url), JSON.stringify(buildMapStyle(t), null, 2) + '\n');
  console.log(`map-styles/${t}.json`);
}
