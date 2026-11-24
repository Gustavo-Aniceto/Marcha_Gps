// Mapa no navegador: maplibre-gl (mesmo estilo e mesmos dados gratuitos do OpenFreeMap).
// Mesma API usada pelas telas no app nativo: <Map>, <Camera>, <Marker>.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Text, View, type ViewStyle, type StyleProp } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { colors } from '../theme/tokens.ts';

const MapCtx = createContext<maplibregl.Map | null>(null);

interface MapProps {
  style?: StyleProp<ViewStyle>;
  mapStyle: unknown;
  logo?: boolean;
  compass?: boolean;
  attribution?: boolean;
  attributionPosition?: { bottom?: number; left?: number; top?: number; right?: number };
  onPress?: () => void;
  children?: React.ReactNode;
}

export function Map({ style, mapStyle, compass, onPress, children }: MapProps) {
  const holder = useRef<View>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState(false);
  const press = useRef(onPress);
  press.current = onPress;

  useEffect(() => {
    const el = holder.current as unknown as HTMLElement | null;
    if (!el) return;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: el,
        style: mapStyle as maplibregl.StyleSpecification,
        attributionControl: { compact: true },
        pitchWithRotate: true,
      });
    } catch {
      // navegador sem WebGL (aceleração de vídeo desligada, modo economia extrema etc.)
      setFailed(true);
      return;
    }
    if (compass) m.addControl(new maplibregl.NavigationControl({ showZoom: false }), 'top-right');
    m.on('click', (e) => {
      // clique em cima de um carrinho não fecha o card
      if ((e.originalEvent.target as HTMLElement | null)?.closest('.maplibregl-marker')) return;
      press.current?.();
    });
    m.once('load', () => setMap(m));
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el);
    return () => { ro.disconnect(); m.remove(); setMap(null); };
  }, []);

  // troca de tema (noite/dia) sem recriar o mapa
  const styleUsed = useRef(mapStyle);
  useEffect(() => {
    if (!map || styleUsed.current === mapStyle) return;
    styleUsed.current = mapStyle;
    map.setStyle(mapStyle as maplibregl.StyleSpecification);
  }, [map, mapStyle]);

  if (failed) {
    return (
      <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg }, style]}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>Mapa não abriu neste navegador</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6 }}>
          Ele precisa de aceleração gráfica (WebGL). Tente pelo Chrome ou Safari atualizado, fora do modo economia de bateria.
        </Text>
      </View>
    );
  }

  return (
    <View ref={holder} style={[{ flex: 1, overflow: 'hidden' }, style]}>
      <MapCtx.Provider value={map}>{map ? children : null}</MapCtx.Provider>
    </View>
  );
}

interface CameraProps {
  zoom?: number;
  pitch?: number;
  duration?: number;
  trackUserLocation?: 'default' | 'heading' | 'course' | boolean;
  initialViewState?: { center: [number, number] | readonly [number, number]; zoom?: number; pitch?: number };
  /** posição do usuário (no navegador a câmera segue por aqui) */
  follow?: { lat: number; lon: number; heading: number | null } | null;
}

export function Camera({ zoom, pitch, duration = 600, trackUserLocation, initialViewState, follow }: CameraProps) {
  const map = useContext(MapCtx);
  const started = useRef(false);

  useEffect(() => {
    if (!map || started.current || !initialViewState) return;
    started.current = true;
    map.jumpTo({ center: [initialViewState.center[0], initialViewState.center[1]],
                 zoom: initialViewState.zoom ?? map.getZoom(), pitch: initialViewState.pitch ?? 0 });
  }, [map, initialViewState]);

  useEffect(() => {
    if (!map) return;
    map.easeTo({ zoom: zoom ?? map.getZoom(), pitch: pitch ?? map.getPitch(), duration });
  }, [map, zoom, pitch, duration]);

  const lat = follow?.lat, lon = follow?.lon, heading = follow?.heading;
  useEffect(() => {
    if (!map || !trackUserLocation || lat == null || lon == null) return;
    const bearing = trackUserLocation === 'course' && heading != null ? heading : map.getBearing();
    map.easeTo({ center: [lon, lat], bearing, zoom: zoom ?? map.getZoom(), pitch: pitch ?? map.getPitch(), duration });
  }, [map, trackUserLocation, lat, lon, heading]);

  return null;
}

interface MarkerProps { id?: string; lngLat: [number, number]; children: React.ReactNode }

export function Marker({ lngLat, children }: MarkerProps) {
  const map = useContext(MapCtx);
  const [el] = useState(() => document.createElement('div'));
  const marker = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    marker.current = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map);
    return () => { marker.current?.remove(); marker.current = null; };
  }, [map]);

  useEffect(() => { marker.current?.setLngLat(lngLat); }, [lngLat[0], lngLat[1]]);

  return createPortal(children, el);
}
