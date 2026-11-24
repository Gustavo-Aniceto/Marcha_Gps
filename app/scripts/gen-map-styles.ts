// Gera map-styles/*.json a partir de src/lib/mapStyle.ts (pra abrir/editar no Maputnik).
// Uso: npm run styles
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildMapStyle, type MapTheme } from '../src/lib/mapStyle.ts';

// visão inicial só pra prévia no Maputnik (o app controla a câmera sozinho)
const preview: Record<MapTheme, object> = {
  noite: { center: [-46.5333, -23.4628], zoom: 15.6, pitch: 58, bearing: -20 }, // centro de Guarulhos
  dia: { center: [-46.5333, -23.4628], zoom: 15.6, pitch: 58, bearing: -20 },
  cena: { center: [-46.53, -23.49], zoom: 10.6, pitch: 0, bearing: 0 }, // SP + Guarulhos + Itaquá
};

for (const t of ['noite', 'dia', 'cena'] as MapTheme[]) {
  const style = { ...buildMapStyle(t), ...preview[t] };
  writeFileSync(fileURLToPath(new URL(`../map-styles/${t}.json`, import.meta.url).href), JSON.stringify(style, null, 2) + '\n');
  console.log(`map-styles/${t}.json`);
}
