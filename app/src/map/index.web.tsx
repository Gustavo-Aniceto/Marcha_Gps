// Mapa no navegador: maplibre-gl (mesmo estilo e mesmos dados gratuitos do OpenFreeMap).
// Mesma API usada pelas telas no app nativo: <Map>, <Camera>, <Marker>.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Text, View, type ViewStyle, type StyleProp } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { colors } from '../theme/tokens.ts';
import { lerpAngle, type Glide } from '../lib/glide.ts';
import { snapToRoute, type Route } from '../lib/nav.ts';

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
    m.once('load', () => {
      // céu/neblina no horizonte quando o mapa está inclinado (3D), na cor do fundo do mapa
      try {
        const bg = (mapStyle as { layers?: { paint?: Record<string, string> }[] }).layers?.[0]?.paint?.['background-color'] ?? '#0B1222';
        (m as unknown as { setSky?: (s: Record<string, unknown>) => void }).setSky?.({
          'sky-color': bg, 'horizon-color': bg, 'fog-color': bg,
          'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.4,
        });
      } catch { /* versão sem céu */ }
      setMap(m);
    });
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
  /** false = a pessoa está mexendo no mapa: não puxa a câmera de volta pro carro */
  following?: boolean;
  /** a pessoa arrastou, girou ou deu zoom com o dedo */
  onUserGesture?: () => void;
  /** mostra estes pontos inteiros na tela (ex.: a rota toda); muda `fitKey` pra repetir */
  fitCoords?: { lat: number; lon: number }[] | null;
  fitKey?: number;
  /** empurra o carro pra baixo da tela (px de folga em cima), pra ver mais caminho à frente */
  padTop?: number;
  /** posição suave do carro (lib/glide): a câmera anda junto com o carrinho a cada quadro, sem trancos */
  glide?: Glide | null;
}

export function Camera({ zoom, pitch, duration = 600, trackUserLocation, initialViewState, follow,
  following = true, onUserGesture, fitCoords, fitKey, padTop = 0, glide }: CameraProps) {
  const map = useContext(MapCtx);
  const started = useRef(false);
  const gesture = useRef(onUserGesture);
  gesture.current = onUserGesture;
  const busy = useRef(false); // dedo no mapa: a câmera não briga com a pessoa
  const live = useRef({ following, trackUserLocation, zoom, pitch, padTop });
  live.current = { following, trackUserLocation, zoom, pitch, padTop };

  useEffect(() => {
    if (!map || started.current || !initialViewState) return;
    started.current = true;
    map.jumpTo({ center: [initialViewState.center[0], initialViewState.center[1]],
                 zoom: initialViewState.zoom ?? map.getZoom(), pitch: initialViewState.pitch ?? 0 });
  }, [map, initialViewState]);

  // dedo no mapa (arrastar, pinça, girar): só conta quando veio da pessoa, não da câmera
  useEffect(() => {
    if (!map) return;
    const onStart = (e: { originalEvent?: Event }) => { if (e.originalEvent) { busy.current = true; gesture.current?.(); } };
    const evs = ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart'] as const;
    for (const ev of evs) map.on(ev, onStart);
    return () => { for (const ev of evs) map.off(ev, onStart); };
  }, [map]);

  // voltou a seguir o carro ("Voltar pro carro", fim da visão da rota): volta deslizando, não pulando
  const catchUp = useRef<{ start: number; center: maplibregl.LngLat } | null>(null);
  useEffect(() => {
    if (!map || !following) return;
    busy.current = false;
    catchUp.current = { start: performance.now(), center: map.getCenter() };
  }, [map, following]);

  // com glide: um quadro por vez, câmera e carrinho lendo a mesma posição
  useEffect(() => {
    if (!map || !glide) return;
    let raf = 0;
    let last = performance.now();
    const cam = { bearing: map.getBearing(), zoom: map.getZoom(), pitch: map.getPitch(), pad: map.getPadding().top ?? 0 };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(100, Math.max(0, now - last)); last = now;
      const s = live.current;
      if (!s.following || !s.trackUserLocation || busy.current || map.isMoving()) {
        cam.bearing = map.getBearing(); cam.zoom = map.getZoom(); cam.pitch = map.getPitch(); cam.pad = map.getPadding().top ?? 0;
        return;
      }
      const p = glide.at(now);
      if (!p) return;
      const a = 1 - Math.exp(-dt / 300); // amortece giro/zoom (~0,3 s), sem chacoalhar com o GPS
      const wantBearing = s.trackUserLocation === 'course' && p.heading != null ? p.heading : cam.bearing;
      const wantZoom = s.zoom ?? cam.zoom, wantPitch = s.pitch ?? cam.pitch, wantPad = s.padTop ?? 0;
      const settling = Math.abs(((wantBearing - cam.bearing + 540) % 360) - 180) > 0.05 || Math.abs(wantZoom - cam.zoom) > 0.001
        || Math.abs(wantPitch - cam.pitch) > 0.05 || Math.abs(wantPad - cam.pad) > 0.5;
      const cu = catchUp.current;
      if (!settling && !cu && !glide.moving(now) && map.getCenter().distanceTo(new maplibregl.LngLat(p.lon, p.lat)) < 0.05) return;
      cam.bearing = lerpAngle(cam.bearing, wantBearing, a) ?? cam.bearing;
      cam.zoom += (wantZoom - cam.zoom) * a;
      cam.pitch += (wantPitch - cam.pitch) * a;
      cam.pad += (wantPad - cam.pad) * a;
      let lon = p.lon, lat = p.lat;
      if (cu) {
        const k = Math.min(1, (now - cu.start) / 700);
        const e = 1 - (1 - k) ** 3;
        lon = cu.center.lng + (lon - cu.center.lng) * e;
        lat = cu.center.lat + (lat - cu.center.lat) * e;
        if (k >= 1) catchUp.current = null;
      }
      map.jumpTo({ center: [lon, lat], bearing: cam.bearing, zoom: cam.zoom, pitch: cam.pitch,
                   padding: { top: cam.pad, bottom: 0, left: 0, right: 0 } });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [map, glide]);

  useEffect(() => {
    if (!map || !following || glide) return;
    map.easeTo({ zoom: zoom ?? map.getZoom(), pitch: pitch ?? map.getPitch(), duration });
  }, [map, zoom, pitch, duration, following, glide]);

  const lat = follow?.lat, lon = follow?.lon, heading = follow?.heading;
  useEffect(() => {
    if (!map || glide || !following || !trackUserLocation || lat == null || lon == null) return;
    const bearing = trackUserLocation === 'course' && heading != null ? heading : map.getBearing();
    map.easeTo({ center: [lon, lat], bearing, zoom: zoom ?? map.getZoom(), pitch: pitch ?? map.getPitch(), duration,
                 padding: { top: padTop, bottom: 0, left: 0, right: 0 } });
  }, [map, trackUserLocation, lat, lon, heading, following, padTop]);

  useEffect(() => {
    if (!map || !fitCoords || fitCoords.length < 2) return;
    const b = new maplibregl.LngLatBounds();
    for (const c of fitCoords) b.extend([c.lon, c.lat]);
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    map.fitBounds(b, { padding: { top: 150, bottom: 190, left: 50, right: 50 }, pitch: 0, bearing: 0, duration: 800, maxZoom: 17 });
  }, [map, fitKey]);

  return null;
}

interface MarkerProps {
  id?: string; lngLat: [number, number]; children: React.ReactNode;
  /** direção em graus; com ela o desenho gira junto com o mapa e deita no 3D (como no Waze) */
  rotation?: number | null;
  /** posição suave (lib/glide): o carrinho desliza entre as leituras do GPS em vez de pular */
  glide?: Glide | null;
}

export function Marker({ lngLat, children, rotation, glide }: MarkerProps) {
  const map = useContext(MapCtx);
  const [el] = useState(() => document.createElement('div'));
  const marker = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    const turns = rotation !== undefined;
    marker.current = new maplibregl.Marker({
      element: el, anchor: 'center',
      ...(turns ? { rotationAlignment: 'map' as const, pitchAlignment: 'map' as const, rotation: rotation ?? 0 } : {}),
    }).setLngLat(lngLat).addTo(map);
    return () => { marker.current?.remove(); marker.current = null; };
  }, [map]);

  useEffect(() => { if (!glide) marker.current?.setLngLat(lngLat); }, [lngLat[0], lngLat[1], glide]);
  useEffect(() => { if (!glide && rotation != null) marker.current?.setRotation(rotation); }, [rotation, glide]);

  useEffect(() => {
    if (!map || !glide) return;
    const turns = rotation !== undefined;
    let raf = 0, seen = -1, wasMoving = false;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const moving = glide.moving(now);
      if (!moving && !wasMoving && seen === glide.version) return; // parado e já desenhado
      wasMoving = moving; seen = glide.version;
      const p = glide.at(now);
      if (!p || !marker.current) return;
      marker.current.setLngLat([p.lon, p.lat]);
      if (turns) marker.current.setRotation(p.heading ?? 0);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [map, glide]);

  return createPortal(children, el);
}

/**
 * Linha da rota da navegação (some e volta sozinha quando o tema do mapa troca).
 * Com `route` + `trim`, o pedaço que já ficou pra trás do carro some (como nos apps de trânsito).
 */
export function RouteLine({ coords, route, trim }: { coords: { lat: number; lon: number }[]; route?: Route | null; trim?: Glide | null }) {
  const map = useContext(MapCtx);
  const data = useRef<GeoJSON.Feature>({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } });
  data.current = {
    type: 'Feature', properties: {},
    geometry: { type: 'LineString', coordinates: coords.map((c) => [c.lon, c.lat]) },
  };

  useEffect(() => {
    if (!map) return;
    const ensure = () => {
      if (!map.isStyleLoaded()) return;
      const src = map.getSource('rota') as maplibregl.GeoJSONSource | undefined;
      if (src) { src.setData(data.current); return; }
      map.addSource('rota', { type: 'geojson', data: data.current });
      map.addLayer({ id: 'rota-borda', type: 'line', source: 'rota',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': colors.routeCasing, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 7, 16, 14, 19, 26] } });
      map.addLayer({ id: 'rota-linha', type: 'line', source: 'rota',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': colors.route, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4.5, 16, 9.5, 19, 19] } });
    };
    ensure();
    map.on('styledata', ensure);
    return () => {
      map.off('styledata', ensure);
      try {
        if (map.getLayer('rota-linha')) map.removeLayer('rota-linha');
        if (map.getLayer('rota-borda')) map.removeLayer('rota-borda');
        if (map.getSource('rota')) map.removeSource('rota');
      } catch { /* mapa já foi desmontado */ }
    };
  }, [map]);

  // rota nova (recálculo): só troca os dados
  useEffect(() => {
    const src = map?.getSource('rota') as maplibregl.GeoJSONSource | undefined;
    src?.setData(data.current);
  }, [map, coords]);

  // apaga o que já foi andado, ~5 vezes por segundo, seguindo o mesmo carrinho que desliza
  useEffect(() => {
    if (!map || !route || !trim || route.coords.length < 2) return;
    let hint = 0, lastSeg = -1, lastLat = 0, lastLon = 0;
    const id = setInterval(() => {
      const p = trim.at(performance.now());
      const src = map.getSource('rota') as maplibregl.GeoJSONSource | undefined;
      if (!p || !src) return;
      const snap = snapToRoute(route, p, hint);
      if (snap.off > 40) return; // fora da rota: deixa a linha inteira
      hint = snap.seg;
      if (snap.seg === lastSeg && Math.abs(snap.point.lat - lastLat) < 1e-6 && Math.abs(snap.point.lon - lastLon) < 1e-6) return;
      lastSeg = snap.seg; lastLat = snap.point.lat; lastLon = snap.point.lon;
      const rest = route.coords.slice(snap.seg + 1).map((c) => [c.lon, c.lat]);
      src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[snap.point.lon, snap.point.lat], ...rest] } });
    }, 200);
    return () => clearInterval(id);
  }, [map, route, trim]);

  return null;
}
