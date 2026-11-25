// Mapa no celular (app nativo): MapLibre React Native.
// No navegador o Metro usa index.web.tsx, com a mesma API.
import React from 'react';
import { Camera as NativeCamera, GeoJSONSource, Layer, Map as NativeMap, Marker as NativeMarker } from '@maplibre/maplibre-react-native';
import { colors } from '../theme/tokens.ts';

type NativeCameraProps = React.ComponentProps<typeof NativeCamera>;

interface ExtraCameraProps {
  /** só a versão web usa (no app a câmera segue o GPS sozinha) */
  follow?: { lat: number; lon: number; heading: number | null } | null;
  /** false = a pessoa está mexendo no mapa: a câmera para de seguir o carro */
  following?: boolean;
  onUserGesture?: () => void;
  fitCoords?: { lat: number; lon: number }[] | null;
  fitKey?: number;
  padTop?: number;
}

/** Mesma câmera do MapLibre, com as opções extras da versão web. */
export function Camera({ follow: _follow, following = true, onUserGesture: _g, fitCoords, fitKey: _k, padTop = 0, ...props }:
  NativeCameraProps & ExtraCameraProps) {
  if (fitCoords && fitCoords.length >= 2 && !following) {
    const lons = fitCoords.map((c) => c.lon), lats = fitCoords.map((c) => c.lat);
    return <NativeCamera bounds={[Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] as never} />;
  }
  return <NativeCamera {...props} trackUserLocation={following ? props.trackUserLocation : undefined}
                       padding={{ paddingTop: padTop, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 } as never} />;
}

type NativeMapProps = React.ComponentProps<typeof NativeMap>;

/** Mapa nativo; aceita o estilo gerado por buildMapStyle (objeto) ou uma URL. */
export function Map({ mapStyle, ...props }: Omit<NativeMapProps, 'mapStyle'> & { mapStyle: string | Record<string, unknown> }) {
  return <NativeMap {...props} mapStyle={mapStyle as NativeMapProps['mapStyle']} />;
}

/** Marcador; `rotation` só é usado na versão web (no app o desenho já gira sozinho). */
export function Marker({ rotation: _r, ...props }: React.ComponentProps<typeof NativeMarker> & { rotation?: number | null }) {
  return <NativeMarker {...props} />;
}

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
             paint={{ 'line-color': colors.routeCasing, 'line-width': 14 } as never} />
      <Layer id="rota-linha" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' } as never}
             paint={{ 'line-color': colors.route, 'line-width': 9 } as never} />
    </GeoJSONSource>
  );
}
