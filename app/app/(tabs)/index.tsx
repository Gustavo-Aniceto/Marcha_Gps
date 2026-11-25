// Mapa de navegação no visual de app de trânsito que o público já conhece (barra preta da manobra em cima,
// barra de chegada embaixo, rota roxa, botões redondos), com o carro montado na garagem e os avisos do Radar.
// Como no Waze: arrastar o mapa solta a câmera do carro; "Voltar pro carro" (ou 15 s parado, navegando) volta.
// Mapa gratuito: MapLibre + OpenFreeMap (ver src/lib/mapStyle.ts).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, Map as MapView, Marker, RouteLine } from '../../src/map';
import { ManeuverIcon } from '../../src/components/ManeuverIcon';
import { useNavigation } from '../../src/lib/navigation';
import { rememberPosition } from '../../src/lib/lastPosition';
import { formatArrival, formatDistance, formatDuration, nextObstacle, obstaclesOnRoute } from '../../src/lib/nav.ts';
import Svg, { Circle, Path } from 'react-native-svg';
import { CarMarker } from '../../src/components/CarMarker';
import { ReportIcon } from '../../src/components/ReportIcon';
import { Speedometer } from '../../src/components/Speedometer';
import { isOverLimit, radarAhead, smoothKmh } from '../../src/lib/speed.ts';
import { db, type VisibleCar } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';
import { useMapSettings } from '../../src/lib/mapSettings';
import { useLocationSharing } from '../../src/lib/useLocationSharing';
import { cameraFor } from '../../src/lib/mapCamera.ts';
import { clearanceFor } from '../../src/lib/fitment.ts';
import { kindInfo, type ReportKind } from '../../src/lib/reports.ts';
import { haversineM } from '../../src/lib/geo.ts';
import { buildMapStyle } from '../../src/lib/mapStyle.ts';
import { chrome, colors, fonts } from '../../src/theme/tokens.ts';

interface Report { id: string; kind: ReportKind; lat: number; lon: number; base_risk: number; status: string; speed_limit: number | null }
interface MyCar { color: string; neon: string | null; ride_height_cm: number; suspension: string; body_type: string; tint: string; spoiler: boolean }

export default function Mapa() {
  const router = useRouter();
  const { profile } = useSession();
  const { camera } = useMapSettings();
  const share = !!profile && profile.visibility !== 'ghost';
  const nav = useNavigation();
  const navigating = nav.status !== 'idle';
  const { position, permission, retry } = useLocationSharing(share, null, navigating);
  const [recenter, setRecenter] = useState(0);
  // câmera presa no carro (true) ou solta porque a pessoa está olhando o mapa (false)
  const [following, setFollowing] = useState(true);
  const [lastGesture, setLastGesture] = useState(0);
  const [fitKey, setFitKey] = useState(0);
  const onUserGesture = useCallback(() => { setFollowing(false); setLastGesture(Date.now()); }, []);
  const backToCar = useCallback(() => { setFollowing(true); setRecenter((n) => n + 1); }, []);
  // no navegador o desenho do carro gira junto com o mapa (Marker com rotation); no app, o próprio desenho gira
  const web = Platform.OS === 'web';
  const [routeReports, setRouteReports] = useState<{ item: Report; along: number }[]>([]);
  const [cars, setCars] = useState<VisibleCar[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [myCar, setMyCar] = useState<MyCar | null>(null);
  const cam = cameraFor(camera);
  const mapStyle = useMemo(() => buildMapStyle(camera.theme), [camera.theme]);
  const ui = camera.theme === 'dia' ? chrome.dia : chrome.noite;
  const [menu, setMenu] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!profile) return;
    db.from('cars').select('color, neon, ride_height_cm, suspension, body_type, tint, spoiler')
      .eq('owner_id', profile.id).eq('is_active', true).maybeSingle()
      .then(({ data }) => setMyCar(data as MyCar | null));
  }, [profile]));

  // carros visíveis: atualiza a cada 10 s
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data, error } = await db.rpc('visible_cars', { p_city: null });
      if (alive && !error) setCars((data ?? []) as VisibleCar[]);
    };
    load();
    const t = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // avisos num raio de ~3 km
  const lat = position?.lat, lon = position?.lon;
  useEffect(() => {
    if (lat == null || lon == null) return;
    const d = 0.03;
    db.from('reports').select('id, kind, lat, lon, base_risk, status, speed_limit')
      .gte('lat', lat - d).lte('lat', lat + d).gte('lon', lon - d).lte('lon', lon + d)
      .limit(500)
      .then(({ data }) => setReports((data ?? []) as Report[]));
  }, [lat == null ? null : Math.round(lat * 200), lon == null ? null : Math.round(lon * 200)]);

  // cada leitura do GPS vai pra navegação (segue a rota, recalcula se sair)
  useEffect(() => {
    if (!position) return;
    rememberPosition(position);
    nav.onFix(position);
  }, [position]);

  // obstáculos e radares em cima da rota inteira
  const route = nav.route;
  useEffect(() => {
    if (!route) { setRouteReports([]); return; }
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    for (const c of route.coords) {
      minLat = Math.min(minLat, c.lat); maxLat = Math.max(maxLat, c.lat);
      minLon = Math.min(minLon, c.lon); maxLon = Math.max(maxLon, c.lon);
    }
    const m = 0.002;
    db.from('reports').select('id, kind, lat, lon, base_risk, status, speed_limit')
      .gte('lat', minLat - m).lte('lat', maxLat + m).gte('lon', minLon - m).lte('lon', maxLon + m)
      .limit(5000)
      .then(({ data }) => setRouteReports(obstaclesOnRoute(route, (data ?? []) as Report[])));
  }, [route]);

  // na navegação: o próximo obstáculo da rota (até 300 m) que pega no meu carro, ou radar
  const routeAlert = useMemo(() => {
    const along = nav.update?.snap.along;
    if (!route || along == null) return null;
    const ahead = routeReports.filter((o) => {
      if (o.item.kind === 'radar' || o.item.kind === 'blitz') return true;
      if (!myCar) return o.item.base_risk >= 2;
      return clearanceFor(myCar.ride_height_cm, o.item.base_risk, [], myCar.suspension as never) !== 'passa';
    });
    const n = nextObstacle(ahead, along, 300);
    if (!n) return null;
    const c = n.item.kind === 'radar' || n.item.kind === 'blitz' ? 'aviso'
      : myCar ? clearanceFor(myCar.ride_height_cm, n.item.base_risk, [], myCar.suspension as never) : 'raspa';
    return { r: n.item, dist: n.distance_m, c };
  }, [route, routeReports, nav.update, myCar]);

  // aviso mais perto (até 250 m) que pega no meu carro
  const nearAlert = useMemo(() => {
    if (navigating || !position || !myCar) return null;
    let best: { r: Report; dist: number; c: string } | null = null;
    for (const r of reports) {
      if (r.kind === 'radar' || r.kind === 'blitz') continue;
      const dist = haversineM(position.lat, position.lon, r.lat, r.lon);
      if (dist > 250) continue;
      const c = clearanceFor(myCar.ride_height_cm, r.base_risk, [], myCar.suspension as never);
      if (c === 'passa') continue;
      if (!best || dist < best.dist) best = { r, dist, c };
    }
    return best;
  }, [navigating, position, reports, myCar]);
  const alert = routeAlert ?? nearAlert;

  // velocímetro: sua velocidade (suavizada) e o radar com velocidade logo à frente
  const [kmh, setKmh] = useState<number | null>(null);
  useEffect(() => { if (position) setKmh((k) => smoothKmh(k, position.speed)); }, [position]);
  const speedRadar = useMemo(() => {
    if (!position) return null;
    const along = nav.update?.snap.along;
    if (route && along != null && nav.status === 'navigating') {
      const n = nextObstacle(routeReports.filter((o) => o.item.kind === 'radar' && o.item.speed_limit != null), along, 500);
      return n ? { limit: n.item.speed_limit as number, dist: n.distance_m } : null;
    }
    const r = radarAhead(reports, position, position.heading, 400);
    return r ? { limit: r.radar.speed_limit as number, dist: r.dist } : null;
  }, [position, route, routeReports, nav.update, nav.status, reports]);
  const over = isOverLimit(kmh, speedRadar?.limit);

  // navegando com o mapa solto: volta pro carro sozinho depois de 15 s sem mexer (igual ao Waze)
  useEffect(() => {
    if (following || !navigating) return;
    const t = setTimeout(backToCar, 15_000);
    return () => clearTimeout(t);
  }, [following, navigating, lastGesture, fitKey, backToCar]);
  // começou uma navegação nova: câmera volta pro carro
  useEffect(() => { if (nav.status === 'routing') setFollowing(true); }, [nav.status]);
  const next = nav.update?.next;
  // rua em que você está agora (a da manobra anterior à próxima)
  const street = route && next ? route.maneuvers[next.index - 1]?.street || route.maneuvers[0]?.street || '' : '';
  const others = cars.filter((c) => c.user_id !== profile?.id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <MapView style={{ flex: 1 }} mapStyle={mapStyle} logo={false} compass={false}
           attribution attributionPosition={{ bottom: 8, left: 8 }}>
        <Camera
          key={`camera-${recenter}`}
          trackUserLocation={camera.threeD || navigating ? 'course' : 'default'}
          zoom={navigating ? Math.max(cam.zoom, 16.5) : cam.zoom}
          pitch={cam.pitch}
          duration={600}
          follow={position}
          following={following}
          onUserGesture={onUserGesture}
          fitCoords={route?.coords ?? null}
          fitKey={fitKey}
        />

        {route && <RouteLine coords={route.coords} />}

        {reports.map((r) => (
          <Marker key={r.id} id={`aviso-${r.id}`} lngLat={[r.lon, r.lat]}>
            <ReportIcon kind={r.kind} unconfirmed={r.status === 'unconfirmed'} speedLimit={r.speed_limit} />
          </Marker>
        ))}

        {/* todo mundo que o banco libera (visible_cars cuida de fantasma, equipe, zona privada e atraso) */}
        {others.map((c) => web ? (
          <React.Fragment key={c.user_id}>
            <Marker id={`carro-${c.user_id}`} lngLat={[c.lon, c.lat]} rotation={c.heading ?? 0}>
              <CarMarker color={c.car?.color} neon={c.car?.neon} heading={0} approximate={c.approximate}
                         body={c.car?.body_type} tint={c.car?.tint} spoiler={c.car?.spoiler} />
            </Marker>
            <Marker id={`nome-${c.user_id}`} lngLat={[c.lon, c.lat]}>
              <View style={{ paddingBottom: 60 }} pointerEvents="none">
                <Text style={[s.carLabel, c.same_crew && s.carLabelCrew]}>@{c.username}</Text>
              </View>
            </Marker>
          </React.Fragment>
        ) : (
          <Marker key={c.user_id} id={`carro-${c.user_id}`} lngLat={[c.lon, c.lat]}>
            <CarMarker color={c.car?.color} neon={c.car?.neon} heading={c.heading} label={`@${c.username}`}
                       sameCrew={c.same_crew} approximate={c.approximate}
                       body={c.car?.body_type} tint={c.car?.tint} spoiler={c.car?.spoiler} />
          </Marker>
        ))}

        {position && (
          <Marker id="meu-carro" lngLat={[position.lon, position.lat]} rotation={web ? position.heading ?? 0 : undefined}>
            <CarMarker me color={myCar?.color} neon={myCar?.neon} heading={web ? 0 : position.heading}
                       body={myCar?.body_type} tint={myCar?.tint} spoiler={myCar?.spoiler} />
          </Marker>
        )}
      </MapView>

      {/* ---------- em cima ---------- */}
      {navigating ? (
        <View style={s.maneuver} accessibilityLiveRegion="polite">
          {nav.status === 'routing' || !next ? (
            <Text style={s.maneuverStreet}>{nav.status === 'routing'
              ? (!position ? 'Esperando o GPS achar você… (libere a localização se o navegador perguntar)' : 'Calculando a rota…')
              : nav.status === 'arrived' ? 'Você chegou' : 'Siga a rota'}</Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <ManeuverIcon kind={next.maneuver.kind} size={46} color={chrome.bannerText} />
              <View style={{ flex: 1 }}>
                <Text style={s.maneuverDist}>{formatDistance(next.distance_m)}</Text>
                <Text style={s.maneuverStreet} numberOfLines={1}>{next.maneuver.street || next.maneuver.text}</Text>
              </View>
            </View>
          )}
          {nav.status === 'rerouting' && <Text style={s.rerouting}>Recalculando a rota…</Text>}
          {nav.status === 'navigating' && nav.update?.after && next && next.distance_m < 400 && (
            <Text style={s.after} numberOfLines={1}>Depois: {nav.update.after.text}</Text>
          )}
        </View>
      ) : (
        <>
          <Pressable style={[s.round, s.menuBtn, { backgroundColor: ui.button, borderColor: ui.border }]} onPress={() => setMenu((m) => !m)}
                     accessibilityRole="button" accessibilityLabel="Menu do mapa" accessibilityState={{ expanded: menu }}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={ui.icon} strokeWidth={2.2} strokeLinecap="round">
              <Path d="M4 7h16M4 12h16M4 17h16" />
            </Svg>
          </Pressable>
          <Pressable style={[s.cenaPill, { backgroundColor: ui.button, borderColor: ui.border }]} onPress={() => router.push('/cena')}
                     accessibilityRole="button" accessibilityLabel={`Abrir a Cena ao vivo, ${others.length} carros no mapa`}>
            <View style={[s.dot, { backgroundColor: share ? '#3DDC84' : ui.sub }]} />
            <Text style={[s.cenaText, { color: ui.text }]}>Cena ao vivo · {others.length + (position ? 1 : 0)}</Text>
          </Pressable>
          {menu && (
            <View style={[s.menu, { backgroundColor: ui.panel, borderColor: ui.border }]}>
              <Text style={[s.menuHead, { color: ui.sub }]}>
                {share ? (profile?.visibility === 'scene' ? 'Você aparece na Cena ao vivo' : 'Você aparece só pra sua equipe') : 'Modo fantasma: ninguém te vê'}
              </Text>
              {[
                { l: 'Quem vê meu carro', to: '/visibilidade' },
                { l: 'Visual e câmera do mapa', to: '/camera-mapa' },
                { l: 'Cena ao vivo', to: '/cena' },
                { l: 'Garagem (meu carro)', to: '/garagem' },
              ].map((o) => (
                <Pressable key={o.to} style={s.menuItem} onPress={() => { setMenu(false); router.push(o.to as never); }} accessibilityRole="button">
                  <Text style={[s.menuText, { color: ui.text }]}>{o.l}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      {(permission === 'denied' || permission === 'unavailable') && (
        <Pressable style={[s.info, { top: navigating ? 150 : 108, backgroundColor: ui.panel, borderColor: ui.border }]} onPress={retry} accessibilityRole="button">
          <Text style={[s.infoText, { color: ui.text, fontWeight: '700' }]}>
            {permission === 'denied' ? 'Localização bloqueada' : 'Não achei sua localização'}
          </Text>
          <Text style={[s.infoText, { color: ui.text }]}>
            {permission === 'denied'
              ? 'Libere a localização pra este site: no iPhone, Ajustes > Privacidade > Serviços de Localização > Safari (ou Chrome) > "Durante o uso". No Android, toque no cadeado ao lado do endereço > Permissões > Local. Depois toque aqui.'
              : 'Confira se o GPS do celular está ligado e toque aqui pra tentar de novo.'}
          </Text>
        </Pressable>
      )}

      {alert && (
        <View style={[s.banner, { top: navigating ? 150 : 108 }]} accessibilityLiveRegion="polite">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ReportIcon kind={alert.r.kind} size={36} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.bannerTitle}>
                {kindInfo(alert.r.kind).label}{alert.r.kind === 'radar' && alert.r.speed_limit ? ` ${alert.r.speed_limit} km/h` : ''} em {formatDistance(alert.dist)}
              </Text>
              <Text style={s.bannerText}>
                {alert.c === 'aviso' ? (alert.r.kind === 'blitz' ? 'Blitz avisada pela comunidade.' : 'Respeite a velocidade da via.')
                  : alert.c === 'nao_passa' ? 'Seu carro não passa aqui. Desvie.' : myCar?.suspension === 'ar'
                  ? 'Raspa: sobe a suspensão antes.' : 'Seu carro raspa aqui. Passa devagar ou desvia.'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {!!nav.error && nav.status !== 'routing' && (
        <Pressable style={[s.info, { top: navigating ? 150 : 108, backgroundColor: ui.panel, borderColor: ui.border }]} onPress={() => nav.stop()} accessibilityRole="alert">
          <Text style={[s.infoText, { color: ui.text }]}>{nav.error}</Text>
        </Pressable>
      )}

      {/* ---------- embaixo ---------- */}
      {/* nome da rua em que você está (navegando) */}
      {navigating && !!street && nav.status !== 'arrived' && (
        <View style={[s.streetPill, { bottom: BOTTOM_NAV + 10 }]} pointerEvents="none">
          <Text style={s.streetText} numberOfLines={1}>{street}</Text>
        </View>
      )}

      {position && (
        <View style={[s.speedo, { bottom: (navigating ? BOTTOM_NAV : BOTTOM_IDLE) + 12 }]} pointerEvents="none">
          <Speedometer kmh={kmh} limit={speedRadar?.limit} over={over} radarDist={speedRadar?.dist} theme={ui} />
        </View>
      )}

      {/* avisar (amarelo, embaixo à direita) */}
      <Pressable style={[s.reportBtn, { bottom: (navigating ? BOTTOM_NAV : BOTTOM_IDLE) + 12 }]} onPress={() => router.push('/radar')}
                 accessibilityRole="button" accessibilityLabel="Avisar buraco, lombada, radar, blitz">
        <Svg width={34} height={34} viewBox="0 0 24 24">
          <Path d="M12 3.2 22 20.5H2Z" fill="#14171C" stroke="#14171C" strokeWidth={1.4} strokeLinejoin="round" />
          <Path d="M12 10v6M9 13h6" stroke={chrome.report} strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      </Pressable>

      {/* minha localização / voltar pro carro, e ver a rota inteira */}
      {following ? (
        <Pressable style={[s.round, s.sideBtn, { bottom: (navigating ? BOTTOM_NAV : BOTTOM_IDLE) + 86, backgroundColor: ui.button, borderColor: ui.border }]}
                   accessibilityRole="button" accessibilityLabel="Ir pra minha localização"
                   onPress={() => { if (!position) retry(); backToCar(); }}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={position ? chrome.locate : ui.sub} strokeWidth={2.2}>
            <Circle cx={12} cy={12} r={4} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </Svg>
        </Pressable>
      ) : (
        <Pressable style={[s.backBtn, { bottom: (navigating ? BOTTOM_NAV : BOTTOM_IDLE) + 86 }]} accessibilityRole="button"
                   accessibilityLabel="Voltar pro carro" onPress={() => { if (!position) retry(); backToCar(); }}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="#FFFFFF"><Path d="M12 2 20 21 12 17 4 21Z" /></Svg>
          <Text style={s.backText}>Voltar pro carro</Text>
        </Pressable>
      )}
      {navigating && route && (
        <Pressable style={[s.round, s.sideBtn, { bottom: BOTTOM_NAV + 146, backgroundColor: ui.button, borderColor: ui.border }]}
                   accessibilityRole="button" accessibilityLabel="Ver a rota inteira"
                   onPress={() => { setFollowing(false); setFitKey((n) => n + 1); }}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={ui.icon} strokeWidth={2} strokeLinecap="round">
            <Circle cx={6} cy={18} r={2.5} /><Circle cx={18} cy={6} r={2.5} /><Path d="M8 16c4-1 2-7 8-8" strokeDasharray="2 3" />
          </Svg>
        </Pressable>
      )}

      {navigating ? (
        <View style={[s.navPanel, { backgroundColor: ui.panel, borderColor: ui.border }]}>
          <Pressable style={[s.round, s.panelBtn, { backgroundColor: ui.button, borderColor: ui.border }]} onPress={() => router.push('/destino')}
                     accessibilityRole="button" accessibilityLabel="Trocar o destino">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={ui.icon} strokeWidth={2.2} strokeLinecap="round">
              <Circle cx={11} cy={11} r={7} /><Path d="m20 20-3.5-3.5" />
            </Svg>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            {nav.status === 'arrived' ? (
              <>
                <Text style={[s.etaBig, { color: ui.text }]}>Chegou!</Text>
                <Text style={[s.etaSmall, { color: ui.sub }]} numberOfLines={1}>{nav.destination?.name}</Text>
              </>
            ) : (
              <>
                <Text style={[s.etaBig, { color: ui.text }]}>{nav.update ? formatArrival(new Date(), nav.update.remaining_s) : '--:--'}</Text>
                <Text style={[s.etaSmall, { color: ui.sub }]} numberOfLines={1}>
                  {nav.update ? `${formatDuration(nav.update.remaining_s)} · ${formatDistance(nav.update.remaining_m)}` : nav.destination?.name}
                </Text>
              </>
            )}
          </View>
          <Pressable style={[s.round, s.panelBtn, { backgroundColor: ui.button, borderColor: ui.border }]} onPress={() => nav.setVoice(!nav.voice)}
                     accessibilityRole="switch" accessibilityState={{ checked: nav.voice }} accessibilityLabel="Voz da navegação">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={ui.icon} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M4 9v6h4l5 4V5L8 9Z" fill={ui.icon} />
              {nav.voice ? <Path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /> : <Path d="m16 9 5 6M21 9l-5 6" />}
            </Svg>
          </Pressable>
          <Pressable style={[s.round, s.panelBtn, { backgroundColor: colors.danger, borderColor: colors.danger }]} onPress={nav.stop}
                     accessibilityRole="button" accessibilityLabel={nav.status === 'arrived' ? 'Fechar navegação' : 'Encerrar navegação'}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round">
              <Path d="M6 6l12 12M18 6 6 18" />
            </Svg>
          </Pressable>
        </View>
      ) : (
        <Pressable style={[s.searchBar, { backgroundColor: ui.panel, borderColor: ui.border }]} onPress={() => router.push('/destino')}
                   accessibilityRole="search" accessibilityLabel="Para onde? Buscar destino">
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={ui.icon} strokeWidth={2.2} strokeLinecap="round">
            <Circle cx={11} cy={11} r={7} /><Path d="m20 20-3.5-3.5" />
          </Svg>
          <Text style={[s.searchText, { color: ui.sub }]}>Para onde?</Text>
        </Pressable>
      )}
    </View>
  );
}

// altura das barras de baixo (o resto se posiciona em cima delas)
const BOTTOM_NAV = 86;
const BOTTOM_IDLE = 72;

const s = StyleSheet.create({
  round: { alignItems: 'center', justifyContent: 'center', borderWidth: 1,
           shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  menuBtn: { position: 'absolute', top: 48, left: 14, width: 46, height: 46, borderRadius: 23 },
  cenaPill: { position: 'absolute', top: 52, right: 14, height: 38, borderRadius: 19, borderWidth: 1, paddingHorizontal: 14,
              flexDirection: 'row', alignItems: 'center', gap: 8,
              shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  cenaText: { fontSize: 13, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  menu: { position: 'absolute', top: 100, left: 14, width: 250, borderRadius: 14, borderWidth: 1, paddingVertical: 6,
          shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  menuHead: { fontSize: 12, paddingHorizontal: 14, paddingVertical: 8 },
  menuItem: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 14 },
  menuText: { fontSize: 15, fontWeight: '600' },
  maneuver: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 46, paddingBottom: 14, paddingHorizontal: 18,
              backgroundColor: chrome.banner, gap: 4,
              shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 6 },
  maneuverDist: { color: chrome.bannerText, fontSize: 28, fontWeight: '800' },
  maneuverStreet: { color: chrome.street, fontSize: 17, fontWeight: '700' },
  rerouting: { color: chrome.street, fontSize: 13, fontWeight: '600' },
  after: { color: '#B9C0CC', fontSize: 13 },
  info: { position: 'absolute', left: 14, right: 14, padding: 12, borderRadius: 12, borderWidth: 1 },
  infoText: { fontSize: 14 },
  banner: { position: 'absolute', left: 14, right: 14, padding: 12, borderRadius: 12, borderWidth: 1,
            borderColor: colors.warn, backgroundColor: 'rgba(28,18,6,0.95)', gap: 2 },
  bannerTitle: { color: '#FFB070', fontFamily: fonts.display, fontSize: 17 },
  bannerText: { color: colors.warnText, fontSize: 13 },
  streetPill: { position: 'absolute', alignSelf: 'center', maxWidth: '60%', backgroundColor: chrome.banner, borderRadius: 16,
                paddingHorizontal: 14, paddingVertical: 6 },
  streetText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  speedo: { position: 'absolute', left: 14 },
  reportBtn: { position: 'absolute', right: 14, width: 64, height: 64, borderRadius: 32, backgroundColor: chrome.report,
               alignItems: 'center', justifyContent: 'center',
               shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  sideBtn: { position: 'absolute', right: 18, width: 52, height: 52, borderRadius: 26 },
  backBtn: { position: 'absolute', right: 14, height: 46, paddingHorizontal: 16, borderRadius: 23, flexDirection: 'row',
             alignItems: 'center', gap: 8, backgroundColor: chrome.locate,
             shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  backText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  navPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, height: BOTTOM_NAV, paddingHorizontal: 14, paddingBottom: 10,
              flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopLeftRadius: 18, borderTopRightRadius: 18,
              shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: -2 }, elevation: 8 },
  panelBtn: { width: 46, height: 46, borderRadius: 23 },
  etaBig: { fontSize: 26, fontWeight: '800' },
  etaSmall: { fontSize: 13, fontWeight: '600' },
  searchBar: { position: 'absolute', left: 14, right: 14, bottom: 14, height: BOTTOM_IDLE - 20, flexDirection: 'row', alignItems: 'center', gap: 12,
               paddingHorizontal: 18, borderRadius: 26, borderWidth: 1,
               shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  searchText: { fontSize: 17, fontWeight: '600' },
  carLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.holo, backgroundColor: 'rgba(6,12,22,0.88)',
              borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 5, paddingVertical: 1 },
  carLabelCrew: { color: colors.neon, borderColor: colors.neon },
});
