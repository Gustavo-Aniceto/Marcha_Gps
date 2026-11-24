// Mapa no celular (app nativo): MapLibre React Native.
// No navegador o Metro usa index.web.tsx, com a mesma API.
import React from 'react';
import { Camera as NativeCamera, Map, Marker } from '@maplibre/maplibre-react-native';

type NativeCameraProps = React.ComponentProps<typeof NativeCamera>;

/** Mesma câmera do MapLibre; `follow` só é usado na versão web (no app a câmera segue o GPS sozinha). */
export function Camera({ follow: _follow, ...props }: NativeCameraProps & { follow?: { lat: number; lon: number; heading: number | null } | null }) {
  return <NativeCamera {...props} />;
}

export { Map, Marker };
