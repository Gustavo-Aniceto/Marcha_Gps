// Cena ao vivo: mapa 2D cinza-escuro de SP, Guarulhos e Itaquá com o carrinho de quem escolheu aparecer.
// Quem aparece e onde é decidido no banco (visible_cars): aqui só desenha. O seu carro vem do seu GPS
// (só você vê ele aqui do seu jeito; os outros te veem pelas regras da sua visibilidade).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, Map as MapView, Marker } from '../src/map';
import { CarMarker } from '../src/components/CarMarker';
import { db, type VisibleCar } from '../src/lib/db';
import { useSession } from '../src/lib/session';
import { useLocationSharing } from '../src/lib/useLocationSharing';
import { buildMapStyle, REGION_VIEW } from '../src/lib/mapStyle.ts';
import { LAUNCH_CITIES } from '../src/lib/geo.ts';
import { colors, fonts } from '../src/theme/tokens.ts';

type CityFilter = 'todas' | (typeof LAUNCH_CITIES)[number]['id'];

export default function Cena() {
  const router = useRouter();
  const mapStyle = useMemo(() => buildMapStyle('cena'), []);
  const [city, setCity] = useState<CityFilter>('todas');
  const [onlyCrew, setOnlyCrew] = useState(false);
  const [cars, setCars] = useState<VisibleCar[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const { profile } = useSession();
  const share = !!profile && profile.visibility !== 'ghost';
  const { position } = useLocationSharing(share, null);
  const [myCar, setMyCar] = useState<{ color: string; neon: string | null } | null>(null);
  useFocusEffect(useCallback(() => {
    if (!profile) return;
    db.from('cars').select('color, neon').eq('owner_id', profile.id).eq('is_active', true).maybeSingle()
      .then(({ data }) => setMyCar(data as { color: string; neon: string | null } | null));
  }, [profile]));

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data, error } = await db.rpc('visible_cars', { p_city: city === 'todas' ? null : city });
      if (alive && !error) setCars((data ?? []) as VisibleCar[]);
    };
    load();
    const t = setInterval(load, 15_000);
    return () => { alive = false; clearInterval(t); };
  }, [city]);

  const shown = onlyCrew ? cars.filter((c) => c.same_crew) : cars;
  const sel = shown.find((c) => c.user_id === selected) ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <MapView style={{ flex: 1 }} mapStyle={mapStyle} logo={false} compass={false}
               attribution attributionPosition={{ bottom: 8, left: 8 }} onPress={() => setSelected(null)}>
        <Camera initialViewState={{ center: REGION_VIEW.center, zoom: REGION_VIEW.zoom, pitch: 0 }} />
        {position && (
          <Marker id="cena-eu" lngLat={[position.lon, position.lat]}>
            <CarMarker me color={myCar?.color} neon={myCar?.neon} heading={position.heading}
                       label={profile?.visibility === 'ghost' ? 'VOCÊ · FANTASMA' : 'VOCÊ'} />
          </Marker>
        )}
        {shown.map((c) => (
          <Marker key={c.user_id} id={`cena-${c.user_id}`} lngLat={[c.lon, c.lat]}>
            <Pressable onPress={() => setSelected(c.user_id)} accessibilityRole="button" accessibilityLabel={`Ver carro de @${c.username}`}
                       hitSlop={8}>
              <CarMarker color={c.car?.color} neon={c.car?.neon} heading={c.heading} label={`@${c.username}`}
                         sameCrew={c.same_crew} approximate={c.approximate} />
            </Pressable>
          </Marker>
        ))}
      </MapView>

      <View style={s.top}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Voltar">
            <Text style={{ color: colors.holo, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Cena ao vivo</Text>
            <Text style={s.mono}>SP · GUARULHOS · ITAQUÁ · {shown.length + (position ? 1 : 0)} {shown.length + (position ? 1 : 0) === 1 ? 'CARRO' : 'CARROS'}</Text>
          </View>
          <Pressable onPress={() => router.push('/visibilidade')} style={s.chip} accessibilityRole="button">
            <Text style={[s.mono, { color: colors.neon }]}>QUEM ME VÊ</Text>
          </Pressable>
        </View>
        <View style={s.row}>
          {([{ id: 'todas', name: 'Todas' }, ...LAUNCH_CITIES] as { id: CityFilter; name: string }[]).map((c) => (
            <Pressable key={c.id} onPress={() => setCity(c.id)} style={[s.chip, city === c.id && s.chipOn]}
                       accessibilityRole="button" accessibilityState={{ selected: city === c.id }}>
              <Text style={[s.chipText, city === c.id && { color: colors.ink }]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.row}>
          {[{ v: false, l: 'Todos' }, { v: true, l: 'Minhas equipes' }].map((o) => (
            <Pressable key={o.l} onPress={() => setOnlyCrew(o.v)} style={[s.chip, onlyCrew === o.v && s.chipOn]}
                       accessibilityRole="button" accessibilityState={{ selected: onlyCrew === o.v }}>
              <Text style={[s.chipText, onlyCrew === o.v && { color: colors.ink }]}>{o.l}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {sel && (
        <View style={s.card}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>@{sel.username}</Text>
          <Text style={{ color: colors.textDim, fontSize: 13 }}>
            {sel.car ? `${sel.car.make} ${sel.car.model} · ${sel.car.ride_height_cm} cm · aro ${sel.car.rim}` : 'Carro ainda não montado'}
          </Text>
          <Text style={[s.mono, { color: sel.same_crew ? colors.neon : colors.holo }]}>
            {sel.same_crew ? 'SUA EQUIPE · POSIÇÃO EXATA' : sel.approximate ? 'REGIÃO APROXIMADA (~500 M)' : 'POSIÇÃO LIBERADA PELA PESSOA'}
          </Text>
          <Pressable onPress={() => router.push({ pathname: '/perfil/[username]', params: { username: sel.username } })}
                     accessibilityRole="link" style={{ minHeight: 40, justifyContent: 'center' }}>
            <Text style={{ color: colors.neon, fontWeight: '700' }}>Ver perfil ›</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  top: { position: 'absolute', top: 54, left: 12, right: 12, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 6,
            backgroundColor: 'rgba(6,12,22,0.92)', borderWidth: 1, borderColor: colors.lineStrong },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: 1, borderColor: colors.lineStrong },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 18 },
  mono: { fontFamily: fonts.mono, fontSize: 11, color: colors.holo, letterSpacing: 0.6 },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 4, borderWidth: 1,
          borderColor: colors.lineStrong, backgroundColor: 'rgba(6,12,22,0.9)' },
  chipOn: { backgroundColor: colors.neon, borderColor: colors.neon },
  chipText: { color: colors.holo, fontSize: 12, fontWeight: '600' },
  card: { position: 'absolute', left: 12, right: 12, bottom: 28, padding: 14, gap: 4, borderRadius: 8,
          backgroundColor: 'rgba(6,12,22,0.95)', borderWidth: 1, borderColor: colors.lineStrong },
});
