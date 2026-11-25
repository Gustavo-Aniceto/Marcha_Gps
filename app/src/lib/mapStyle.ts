// Estilos do mapa (formato MapLibre), com os mapas gratuitos do OpenFreeMap (dados do OpenStreetMap).
//   noite: escuro azulado, ruas cinza e rodovias azuis (visual de app de trânsito que o público já conhece)
//   dia:   claro, ruas brancas com contorno
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
  buildingTop: string;   // prédio alto fica mais claro (degradê pela altura)
  glow: string | null;   // brilho em volta das avenidas (null = sem)
  motorway: string;      // rodovias e marginais
  label: string;
  labelHalo: string;
  poi: string | null; // null = sem nomes de lugares
  threeD: boolean;
}

export const PALETTES: Record<MapTheme, Palette> = {
  // GPS à noite no visual que o público já conhece: fundo grafite azulado, ruas cinza, rodovias azuladas
  noite: {
    background: '#232833', water: '#1F3854', park: '#244330', roadMinor: '#3E4553', roadMajor: '#5C6473',
    roadCasing: '#1A1E26', building: '#2A303B', buildingTop: '#363D4B', glow: null, motorway: '#7389AB',
    label: '#D5DAE3', labelHalo: '#232833', poi: '#9AA4B5', threeD: true,
  },
  dia: {
    background: '#EEEEEA', water: '#A9D3F2', park: '#C9E6BC', roadMinor: '#FFFFFF', roadMajor: '#FFFFFF',
    roadCasing: '#CACAC4', building: '#E2E2DB', buildingTop: '#D2D2CA', glow: null, motorway: '#FFE29A',
    label: '#454A53', labelHalo: '#FFFFFF', poi: '#5B6475', threeD: true,
  },
  cena: {
    background: '#191A1C', water: '#0F1012', park: '#1E2022', roadMinor: '#2B2D31', roadMajor: '#45484E',
    roadCasing: '#141517', building: '#202225', buildingTop: '#2A2C30', glow: null, motorway: '#55585F',
    label: '#8C9097', labelHalo: '#101113', poi: null, threeD: false,
  },
};

type Layer = Record<string, unknown> & { id: string; type: string };

const MAJOR = ['primary', 'secondary', 'tertiary'];
const MOTORWAY = ['motorway', 'trunk'];
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
    ...(p.glow ? [{
      // brilho neon embaixo das avenidas e rodovias
      id: 'ruas-brilho', type: 'line', source: SOURCE, 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', [...MAJOR, ...MOTORWAY]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.glow, 'line-opacity': 0.35, 'line-blur': ['interpolate', ['linear'], ['zoom'], 10, 2, 16, 8],
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 3, 14, 14, 18, 48],
      },
    }] : []),
    {
      id: 'ruas-contorno', type: 'line', source: SOURCE, 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', [...MAJOR, ...MOTORWAY]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.roadCasing,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 1.5, 14, 8, 18, 30],
      },
    },
    ...(theme !== 'cena' ? [{
      // contorno das ruas menores (rua branca/cinza com borda, como no app de trânsito)
      id: 'ruas-menores-contorno', type: 'line', source: SOURCE, 'source-layer': 'transportation', minzoom: 14,
      filter: ['in', ['get', 'class'], ['literal', MINOR]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': p.roadCasing, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 14, 3.5, 18, 18] },
    }] : []),
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
    {
      id: 'rodovias', type: 'line', source: SOURCE, 'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', MOTORWAY]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.motorway,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 1.5, 14, 8, 18, 30],
      },
    },
    p.threeD
      ? {
          // prédios em bloco (o "3D meio 2D")
          id: 'predios-3d', type: 'fill-extrusion', source: SOURCE, 'source-layer': 'building', minzoom: 14,
          filter: ['!', ['has', 'hide_3d']],
          paint: {
            'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6],
              0, p.building, 60, p.buildingTop],
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.75,
            'fill-extrusion-vertical-gradient': true,
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
