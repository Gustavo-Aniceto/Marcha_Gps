// Mapa no celular (app nativo): MapLibre React Native.
// No navegador o Metro usa index.web.tsx, com a mesma API.
import React from 'react';
import { Camera as NativeCamera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { colors } from '../theme/tokens.ts';

type NativeCameraProps = React.ComponentProps<typeof NativeCamera>;

/** Mesma câmera do MapLibre; `follow` só é usado na versão web (no app a câmera segue o GPS sozinha). */
export function Camera({ follow: _follow, ...props }: NativeCameraProps & { follow?: { lat: number; lon: number; heading: number | null } | null }) {
  return <NativeCamera {...props} />;
}

export { Map, Marker };

// Linha da rota da navegação
export function RouteLine({ coords }: { coords: { lat: number; lon: number }[] }) {
  if (coords.length < 2) return null;
  const data = {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: coords.map((c) => [c.lon, c.lat]) },
  };
  return (
    <GeoJSONSource id="rota" data={data}>
      <Layer id="rota-borda" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' } as never}
             paint={{ 'line-color': colors.bg, 'line-width': 11, 'line-opacity': 0.85 } as never} />
      <Layer id="rota-linha" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' } as never}
             paint={{ 'line-color': colors.holo, 'line-width': 7 } as never} />
    </GeoJSONSource>
  );
}
