// Mapa de navegação: 3D (noite ou dia), câmera de jogo, carros da equipe e avisos do Radar.
// Mapa gratuito: MapLibre + OpenFreeMap (ver src/lib/mapStyle.ts).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, Map as MapView, Marker } from '../../src/map';
import Svg, { Circle, Path } from 'react-native-svg';
import { CarMarker } from '../../src/components/CarMarker';
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

interface Report { id: string; kind: ReportKind; lat: number; lon: number; base_risk: number; status: string }
interface MyCar { color: string; neon: string | null; ride_height_cm: number; suspension: string }

export default function Mapa() {
  const router = useRouter();
  const { profile } = useSession();
  const { camera } = useMapSettings();
  const share = !!profile && profile.visibility !== 'ghost';
  const { position, permission } = useLocationSharing(share, null);
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
    db.from('reports').select('id, kind, lat, lon, base_risk, status')
      .gte('lat', lat - d).lte('lat', lat + d).gte('lon', lon - d).lte('lon', lon + d)
      .limit(500)
      .then(({ data }) => setReports((data ?? []) as Report[]));
  }, [lat == null ? null : Math.round(lat * 200), lon == null ? null : Math.round(lon * 200)]);

  // aviso mais perto (até 250 m) que pega no meu carro
  const alert = useMemo(() => {
    if (!position || !myCar) return null;
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
  }, [position, reports, myCar]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <MapView style={{ flex: 1 }} mapStyle={mapStyle} logo={false} compass={false}
           attribution attributionPosition={{ bottom: 8, left: 8 }}>
        <Camera
          trackUserLocation={camera.threeD ? 'course' : 'default'}
          zoom={cam.zoom}
          pitch={cam.pitch}
          duration={600}
          follow={position}
        />

        {reports.map((r) => (
          <Marker key={r.id} id={`aviso-${r.id}`} lngLat={[r.lon, r.lat]}>
            <View style={[s.report, r.status === 'unconfirmed' && { opacity: 0.55 }]}
                  accessibilityLabel={`${kindInfo(r.kind).label}${r.status === 'unconfirmed' ? ', não confirmado' : ''}`}>
              <Text style={s.reportText}>{kindInfo(r.kind).label.toUpperCase()}</Text>
            </View>
          </Marker>
        ))}

        {cars.filter((c) => c.same_crew).map((c) => (
          <Marker key={c.user_id} id={`carro-${c.user_id}`} lngLat={[c.lon, c.lat]}>
            <CarMarker color={c.car?.color} neon={c.car?.neon} heading={c.heading} label={`@${c.username}`}
                       sameCrew={c.same_crew} approximate={c.approximate} />
          </Marker>
        ))}

        {position && (
          <Marker id="meu-carro" lngLat={[position.lon, position.lat]}>
            <CarMarker me color={myCar?.color} neon={myCar?.neon} heading={position.heading} />
          </Marker>
        )}
      </MapView>

      <View style={s.topBar} pointerEvents="box-none">
        <View style={s.chip}>
          <Text style={s.chipText}>
            {share ? (profile?.visibility === 'scene' ? 'VISÍVEL NA CENA' : 'VISÍVEL PRA EQUIPE') : 'MODO FANTASMA'}
            {' · '}{cars.filter((c) => c.same_crew).length} DA EQUIPE
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

      {permission === 'denied' && (
        <View style={[s.banner, { top: 110 }]}>
          <Text style={s.bannerText}>Sem permissão de localização. Libere nas configurações do celular pra usar o mapa.</Text>
        </View>
      )}

      {alert && (
        <View style={[s.banner, { top: 110 }]} accessibilityLiveRegion="polite">
          <Text style={s.bannerTitle}>{kindInfo(alert.r.kind).label} em {Math.round(alert.dist)} m</Text>
          <Text style={s.bannerText}>
            {alert.c === 'nao_passa' ? 'Seu carro não passa aqui. Desvie.' : myCar?.suspension === 'ar'
              ? 'Raspa: sobe a suspensão antes.' : 'Seu carro raspa aqui. Passa devagar ou desvia.'}
          </Text>
        </View>
      )}

      <Pressable style={s.cenaBtn} onPress={() => router.push('/cena')} accessibilityRole="button"
                 accessibilityLabel="Abrir a Cena ao vivo">
        <Text style={s.chipText}>CENA AO VIVO · {cars.length}</Text>
      </Pressable>

      <Pressable style={s.reportBtn} onPress={() => router.push('/radar')} accessibilityRole="button"
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
  report: { backgroundColor: colors.warn, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  reportText: { fontFamily: fonts.mono, fontSize: 10, color: colors.ink },
  cenaBtn: { position: 'absolute', left: 16, bottom: 24, minHeight: 44, paddingHorizontal: 12, justifyContent: 'center',
             borderRadius: 6, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: 'rgba(6,12,22,0.9)' },
  reportBtn: { position: 'absolute', right: 16, bottom: 24, width: 72, height: 72, borderRadius: 10,
               backgroundColor: colors.warn, alignItems: 'center', justifyContent: 'center' },
});
