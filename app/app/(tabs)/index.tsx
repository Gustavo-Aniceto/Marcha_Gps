// Mapa de navegação: 3D (noite ou dia), câmera de jogo, carros que visible_cars() libera e avisos do Radar.
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
import { db, type VisibleCar } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';
import { useMapSettings } from '../../src/lib/mapSettings';
import { useLocationSharing } from '../../src/lib/useLocationSharing';
import { cameraFor } from '../../src/lib/mapCamera.ts';
import { clearanceFor } from '../../src/lib/fitment.ts';
import { kindInfo, type ReportKind } from '../../src/lib/reports.ts';
import { haversineM } from '../../src/lib/geo.ts';
import { buildMapStyle } from '../../src/lib/mapStyle.ts';
import { colors, fonts } from '../../src/theme/tokens.ts';

interface Report { id: string; kind: ReportKind; lat: number; lon: number; base_risk: number; status: string; speed_limit: number | null }
interface MyCar { color: string; neon: string | null; ride_height_cm: number; suspension: string }

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

  useFocusEffect(useCallback(() => {
    if (!profile) return;
    db.from('cars').select('color, neon, ride_height_cm, suspension')
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

  // navegando com o mapa solto: volta pro carro sozinho depois de 15 s sem mexer (igual ao Waze)
  useEffect(() => {
    if (following || !navigating) return;
    const t = setTimeout(backToCar, 15_000);
    return () => clearTimeout(t);
  }, [following, navigating, lastGesture, fitKey, backToCar]);
  // começou uma navegação nova: câmera volta pro carro
  useEffect(() => { if (nav.status === 'routing') setFollowing(true); }, [nav.status]);
  const next = nav.update?.next;

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
        {cars.filter((c) => c.user_id !== profile?.id).map((c) => web ? (
          <React.Fragment key={c.user_id}>
            <Marker id={`carro-${c.user_id}`} lngLat={[c.lon, c.lat]} rotation={c.heading ?? 0}>
              <CarMarker color={c.car?.color} neon={c.car?.neon} heading={0} approximate={c.approximate} />
            </Marker>
            <Marker id={`nome-${c.user_id}`} lngLat={[c.lon, c.lat]}>
              <View style={{ paddingBottom: 58 }} pointerEvents="none">
                <Text style={[s.carLabel, c.same_crew && s.carLabelCrew]}>@{c.username}</Text>
              </View>
            </Marker>
          </React.Fragment>
        ) : (
          <Marker key={c.user_id} id={`carro-${c.user_id}`} lngLat={[c.lon, c.lat]}>
            <CarMarker color={c.car?.color} neon={c.car?.neon} heading={c.heading} label={`@${c.username}`}
                       sameCrew={c.same_crew} approximate={c.approximate} />
          </Marker>
        ))}

        {position && (
          <Marker id="meu-carro" lngLat={[position.lon, position.lat]} rotation={web ? position.heading ?? 0 : undefined}>
            <CarMarker me color={myCar?.color} neon={myCar?.neon} heading={web ? 0 : position.heading} />
          </Marker>
        )}
      </MapView>

      {!navigating && (
      <View style={s.topBar} pointerEvents="box-none">
        <View style={s.chip}>
          <Text style={s.chipText}>
            {share ? (profile?.visibility === 'scene' ? 'VISÍVEL NA CENA' : 'VISÍVEL PRA EQUIPE') : 'MODO FANTASMA'}
            {' · '}{cars.filter((c) => c.user_id !== profile?.id).length} NO MAPA
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={s.iconBtn} onPress={() => router.push('/visibilidade')} accessibilityRole="button"
                     accessibilityLabel="Quem vê meu carro">
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.holo} strokeWidth={1.9}>
              <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><Circle cx={12} cy={12} r={3} />
            </Svg>
          </Pressable>
          <Pressable style={s.iconBtn} onPress={() => router.push('/camera-mapa')} accessibilityRole="button"
                     accessibilityLabel="Câmera do mapa"><Text style={s.iconText}>3D</Text></Pressable>
        </View>
      </View>
      )}

      {!navigating && (
        <Pressable style={s.searchBar} onPress={() => router.push('/destino')} accessibilityRole="search"
                   accessibilityLabel="Para onde? Buscar destino">
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.holo} strokeWidth={2}>
            <Circle cx={11} cy={11} r={7} /><Path d="m20 20-3.5-3.5" />
          </Svg>
          <Text style={s.searchText}>Para onde?</Text>
        </Pressable>
      )}

      {navigating && (
        <View style={s.maneuver} accessibilityLiveRegion="polite">
          {nav.status === 'routing' || !next ? (
            <Text style={s.maneuverText}>{nav.status === 'routing'
              ? (!position ? 'Esperando o GPS achar você… (libere a localização se o navegador perguntar)' : 'Calculando a rota…')
              : nav.status === 'arrived' ? 'Você chegou' : 'Siga a rota'}</Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.maneuverIcon}><ManeuverIcon kind={next.maneuver.kind} size={30} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.maneuverDist}>{formatDistance(next.distance_m)}</Text>
                <Text style={s.maneuverText} numberOfLines={2}>{next.maneuver.text}</Text>
              </View>
            </View>
          )}
          {nav.status === 'rerouting' && <Text style={s.rerouting}>RECALCULANDO A ROTA…</Text>}
          {nav.status === 'navigating' && nav.update?.after && next && next.distance_m < 400 && (
            <Text style={s.after} numberOfLines={1}>Depois: {nav.update.after.text}</Text>
          )}
        </View>
      )}

      {(permission === 'denied' || permission === 'unavailable') && (
        <Pressable style={[s.info, { top: navigating ? 150 : 160 }]} onPress={retry} accessibilityRole="button">
          <Text style={[s.infoText, { fontWeight: '700' }]}>
            {permission === 'denied' ? 'Localização bloqueada' : 'Não achei sua localização'}
          </Text>
          <Text style={s.infoText}>
            {permission === 'denied'
              ? 'Libere a localização pra este site: no iPhone, Ajustes > Privacidade > Serviços de Localização > Safari (ou Chrome) > "Durante o uso". No Android, toque no cadeado ao lado do endereço > Permissões > Local. Depois toque aqui.'
              : 'Confira se o GPS do celular está ligado e toque aqui pra tentar de novo.'}
          </Text>
        </Pressable>
      )}

      {following ? (
        <Pressable style={[s.locateBtn, navigating && { bottom: 186 }]} accessibilityRole="button" accessibilityLabel="Ir pra minha localização"
                   onPress={() => { if (!position) retry(); backToCar(); }}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={position ? colors.holo : colors.textMuted} strokeWidth={2}>
            <Circle cx={12} cy={12} r={4} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </Svg>
        </Pressable>
      ) : (
        <Pressable style={[s.backBtn, { bottom: navigating ? 186 : 108 }]} accessibilityRole="button"
                   accessibilityLabel="Voltar pro carro" onPress={() => { if (!position) retry(); backToCar(); }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill={colors.ink}>
            <Path d="M12 2 20 21 12 17 4 21Z" />
          </Svg>
          <Text style={s.backText}>VOLTAR PRO CARRO</Text>
        </Pressable>
      )}

      {navigating && route && (
        <Pressable style={s.routeBtn} accessibilityRole="button" accessibilityLabel="Ver a rota inteira"
                   onPress={() => { setFollowing(false); setFitKey((n) => n + 1); }}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.holo} strokeWidth={2} strokeLinecap="round">
            <Circle cx={6} cy={18} r={2.5} /><Circle cx={18} cy={6} r={2.5} /><Path d="M8 16c4-1 2-7 8-8" strokeDasharray="2 3" />
          </Svg>
        </Pressable>
      )}

      {alert && (
        <View style={[s.banner, { top: navigating ? 150 : 160 }]} accessibilityLiveRegion="polite">
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
        <Pressable style={[s.info, { top: navigating ? 150 : 160 }]} onPress={() => nav.stop()} accessibilityRole="alert">
          <Text style={s.infoText}>{nav.error}</Text>
        </Pressable>
      )}

      {navigating && (
        <View style={s.navPanel}>
          {nav.status === 'arrived' ? (
            <View style={{ flex: 1 }}>
              <Text style={s.navBig}>Chegou!</Text>
              <Text style={s.navSmall} numberOfLines={1}>{nav.destination?.name}</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={s.navBig}>
                {nav.update ? formatDuration(nav.update.remaining_s) : '—'}
                <Text style={s.navSmall}>  {nav.update ? `${formatDistance(nav.update.remaining_m)} · chega ${formatArrival(new Date(), nav.update.remaining_s)}` : ''}</Text>
              </Text>
              <Text style={s.navSmall} numberOfLines={1}>{nav.destination?.name}</Text>
            </View>
          )}
          <Pressable style={s.navBtn} onPress={() => nav.setVoice(!nav.voice)} accessibilityRole="switch"
                     accessibilityState={{ checked: nav.voice }} accessibilityLabel="Voz da navegação">
            <Text style={s.iconText}>{nav.voice ? 'VOZ' : 'MUDO'}</Text>
          </Pressable>
          <Pressable style={[s.navBtn, s.navStop]} onPress={nav.stop} accessibilityRole="button" accessibilityLabel="Encerrar navegação">
            <Text style={s.navStopText}>{nav.status === 'arrived' ? 'FECHAR' : 'SAIR'}</Text>
          </Pressable>
        </View>
      )}

      {!navigating && (
        <Pressable style={s.cenaBtn} onPress={() => router.push('/cena')} accessibilityRole="button"
                   accessibilityLabel="Abrir a Cena ao vivo">
          <Text style={s.chipText}>CENA AO VIVO · {cars.length}</Text>
        </Pressable>
      )}

      <Pressable style={[s.reportBtn, navigating && { bottom: 104 }]} onPress={() => router.push('/radar')} accessibilityRole="button"
                 accessibilityLabel="Avisar buraco, lombada, blitz">
        <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 13 }}>AVISAR</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { position: 'absolute', top: 54, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { backgroundColor: 'rgba(6,12,22,0.9)', borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { fontFamily: fonts.mono, fontSize: 11, color: colors.holo, letterSpacing: 0.6 },
  iconBtn: { width: 44, height: 44, borderRadius: 6, borderWidth: 1, borderColor: colors.lineStrong,
             backgroundColor: 'rgba(6,12,22,0.9)', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.holo, fontFamily: fonts.mono, fontSize: 14 },
  banner: { position: 'absolute', left: 16, right: 16, padding: 12, borderRadius: 6, borderWidth: 1,
            borderColor: colors.warn, backgroundColor: 'rgba(28,18,6,0.94)', gap: 2 },
  bannerTitle: { color: '#FFB070', fontFamily: fonts.display, fontSize: 17 },
  bannerText: { color: colors.warnText, fontSize: 13 },
  locateBtn: { position: 'absolute', right: 16, bottom: 108, width: 48, height: 48, borderRadius: 24, borderWidth: 1,
               borderColor: colors.lineStrong, backgroundColor: 'rgba(6,12,22,0.94)', alignItems: 'center', justifyContent: 'center' },
  searchBar: { position: 'absolute', top: 108, left: 16, right: 16, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10,
               paddingHorizontal: 14, borderRadius: 6, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: 'rgba(6,12,22,0.94)' },
  searchText: { color: colors.textDim, fontSize: 16 },
  maneuver: { position: 'absolute', top: 44, left: 12, right: 12, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8,
              backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.lineStrong, gap: 4 },
  maneuverIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.neon, alignItems: 'center', justifyContent: 'center' },
  maneuverDist: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  maneuverText: { color: colors.textDim, fontSize: 14 },
  rerouting: { color: colors.holo, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1 },
  after: { color: colors.textMuted, fontSize: 13 },
  info: { position: 'absolute', left: 16, right: 16, padding: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.lineStrong,
          backgroundColor: colors.panel },
  infoText: { color: colors.text, fontSize: 14 },
  navPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24,
              flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.panel, borderTopWidth: 1, borderColor: colors.lineStrong },
  navBig: { color: colors.neon, fontFamily: fonts.display, fontSize: 24 },
  navSmall: { color: colors.textMuted, fontSize: 13, fontFamily: undefined },
  navBtn: { minWidth: 56, height: 48, borderRadius: 6, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  navStop: { backgroundColor: colors.danger, borderColor: colors.danger },
  navStopText: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  carLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.holo, backgroundColor: 'rgba(6,12,22,0.88)',
              borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 5, paddingVertical: 1 },
  carLabelCrew: { color: colors.neon, borderColor: colors.neon },
  backBtn: { position: 'absolute', right: 16, height: 46, paddingHorizontal: 14, borderRadius: 23, flexDirection: 'row',
             alignItems: 'center', gap: 8, backgroundColor: colors.holo },
  backText: { color: colors.ink, fontWeight: '800', fontSize: 13, letterSpacing: 0.4 },
  routeBtn: { position: 'absolute', left: 16, bottom: 104, width: 48, height: 48, borderRadius: 24, borderWidth: 1,
              borderColor: colors.lineStrong, backgroundColor: 'rgba(6,12,22,0.94)', alignItems: 'center', justifyContent: 'center' },
  cenaBtn: { position: 'absolute', left: 16, bottom: 24, minHeight: 44, paddingHorizontal: 12, justifyContent: 'center',
             borderRadius: 6, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: 'rgba(6,12,22,0.9)' },
  reportBtn: { position: 'absolute', right: 16, bottom: 24, width: 72, height: 72, borderRadius: 10,
               backgroundColor: colors.warn, alignItems: 'center', justifyContent: 'center' },
});
