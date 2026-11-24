// Estilos do mapa (formato MapLibre), com os mapas gratuitos do OpenFreeMap (dados do OpenStreetMap).
//   noite: 3D azul-escuro (rolê à noite)
//   dia:   3D claro
//   cena:  2D cinza-escuro, pra ver os carros da galera na Cena ao vivo
// Pra trocar de servidor de mapas (ex.: nossos próprios tiles), mude só TILES_URL/GLYPHS_URL.

export type MapTheme = 'noite' | 'dia' | 'cena';

export const TILES_URL = 'https://tiles.openfreemap.org/planet';
export const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const SOURCE = 'openmaptiles';
export const SOURCE_LAYERS = [
  'park', 'landuse', 'landcover', 'waterway', 'water', 'aeroway', 'transportation', 'building',
  'boundary', 'water_name', 'poi', 'transportation_name', 'aerodrome_label', 'place',
] as const;

interface Palette {
  background: string;
  water: string;
  park: string;
  roadMinor: string;
  roadMajor: string;
  roadCasing: string;
  building: string;
  label: string;
  labelHalo: string;
  poi: string | null; // null = sem nomes de lugares
  threeD: boolean;
}

export const PALETTES: Record<MapTheme, Palette> = {
  noite: {
    background: '#2E3350', water: '#1B2238', park: '#34425A', roadMinor: '#6B7391', roadMajor: '#A3A9BF',
    roadCasing: '#262A40', building: '#454C6E', label: '#D7DAE6', labelHalo: '#1C2033', poi: '#F0B45A', threeD: true,
  },
  dia: {
    background: '#F2EFE9', water: '#AAD3EB', park: '#C9EBB4', roadMinor: '#FFFFFF', roadMajor: '#B9C3DC',
    roadCasing: '#D8D4CC', building: '#E9E4D8', label: '#4A4F5C', labelHalo: '#FFFFFF', poi: '#C4762A', threeD: true,
  },
  cena: {
    background: '#191A1C', water: '#0F1012', park: '#1E2022', roadMinor: '#2B2D31', roadMajor: '#45484E',
    roadCasing: '#141517', building: '#202225', label: '#8C9097', labelHalo: '#101113', poi: null, threeD: false,
  },
};

type Layer = Record<string, unknown> & { id: string; type: string };

const MAJOR = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
const MINOR = ['minor', 'service', 'track'];

export function buildMapStyle(theme: MapTheme): Record<string, unknown> {
  const p = PALETTES[theme];
  const font = (bold = false) => [bold ? 'Noto Sans Bold' : 'Noto Sans Regular'];

  const layers: Layer[] = [
    { id: 'fundo', type: 'background', paint: { 'background-color': p.background } },
    { id: 'parques', type: 'fill', source: SOURCE, 'source-layer': 'park', paint: { 'fill-color': p.park } },
    {
      id: 'verde', type: 'fill', source: SOURCE, 'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood']]],
      paint: { 'fill-color': p.park, 'fill-opacity': 0.7 },
    },
    { id: 'agua', type: 'fill', source: SOURCE, 'source-layer': 'water', paint: { 'fill-color': p.water } },
    {
      id: 'aeroporto', type: 'fill', source: SOURCE, 'source-layer': 'aeroway',
      filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': p.roadCasing, 'fill-opacity': 0.6 },
    },
    {
      id: 'ruas-contorno', type: 'line', source: SOURCE, 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', MAJOR]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.roadCasing,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 1.5, 14, 8, 18, 30],
      },
    },
    {
      id: 'ruas-menores', type: 'line', source: SOURCE, 'source-layer': 'transportation', minzoom: 12,
      filter: ['in', ['get', 'class'], ['literal', MINOR]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.roadMinor,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 0.5, 14, 2, 18, 14],
      },
    },
    {
      id: 'ruas-principais', type: 'line', source: SOURCE, 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', MAJOR]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.roadMajor,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 1, 14, 6, 18, 24],
      },
    },
    p.threeD
      ? {
          // prédios em bloco (o "3D meio 2D")
          id: 'predios-3d', type: 'fill-extrusion', source: SOURCE, 'source-layer': 'building', minzoom: 14,
          filter: ['!', ['has', 'hide_3d']],
          paint: {
            'fill-extrusion-color': p.building,
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.92,
          },
        }
      : {
          id: 'predios', type: 'fill', source: SOURCE, 'source-layer': 'building', minzoom: 15,
          paint: { 'fill-color': p.building },
        },
    {
      id: 'nomes-ruas', type: 'symbol', source: SOURCE, 'source-layer': 'transportation_name', minzoom: 14,
      layout: {
        'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': font(),
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 18, 13],
        'text-transform': theme === 'cena' ? 'uppercase' : 'none', 'text-letter-spacing': 0.05,
      },
      paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.2 },
    },
    {
      id: 'bairros-cidades', type: 'symbol', source: SOURCE, 'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'suburb', 'neighbourhood', 'quarter']]],
      layout: {
        'text-field': ['get', 'name'], 'text-font': font(true),
        'text-size': ['match', ['get', 'class'], ['city', 'town'], 15, 11],
        'text-transform': 'uppercase', 'text-letter-spacing': 0.12, 'text-max-width': 8,
      },
      paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.5 },
    },
  ];

  if (p.poi) {
    layers.push({
      id: 'lugares', type: 'symbol', source: SOURCE, 'source-layer': 'poi', minzoom: 16,
      filter: ['<=', ['coalesce', ['get', 'rank'], 99], 20],
      layout: { 'text-field': ['get', 'name'], 'text-font': font(), 'text-size': 11, 'text-max-width': 9 },
      paint: { 'text-color': p.poi, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.2 },
    });
  }

  return {
    version: 8,
    name: `marcha-${theme}`,
    sources: { [SOURCE]: { type: 'vector', url: TILES_URL } },
    glyphs: GLYPHS_URL,
    layers,
  };
}

/** Centro e zoom pra ver SP, Guarulhos e Itaquá juntos. */
export const REGION_VIEW = { center: [-46.53, -23.49] as [number, number], zoom: 10.2 };
