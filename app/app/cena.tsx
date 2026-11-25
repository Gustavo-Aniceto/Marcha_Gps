// Cena ao vivo: mapa 2D cinza-escuro com o carrinho de quem escolheu aparecer. Tocar num carro abre o cartão do perfil (ProfileSheet).
// Quem aparece e onde é decidido no banco (visible_cars): aqui só desenha. O seu carro vem do seu GPS
// (só você vê ele aqui do seu jeito; os outros te veem pelas regras da sua visibilidade).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, Map as MapView, Marker } from '../src/map';
import { CarMarker } from '../src/components/CarMarker';
import { ProfileSheet } from '../src/components/ProfileSheet';
import { Glide } from '../src/lib/glide.ts';
import { db, type VisibleCar } from '../src/lib/db';
import { useSession } from '../src/lib/session';
import { useLocationSharing } from '../src/lib/useLocationSharing';
import { buildMapStyle, REGION_VIEW } from '../src/lib/mapStyle.ts';
import { colors, fonts } from '../src/theme/tokens.ts';


export default function Cena() {
  const router = useRouter();
  const mapStyle = useMemo(() => buildMapStyle('cena'), []);
  const [onlyCrew, setOnlyCrew] = useState(false);
  const [cars, setCars] = useState<VisibleCar[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const { profile } = useSession();
  const share = !!profile && profile.visibility !== 'ghost';
  const { position } = useLocationSharing(share, null);
  const glide = useMemo(() => new Glide(), []);
  useEffect(() => { if (position) glide.push(position, performance.now()); }, [position]);
  const [myCar, setMyCar] = useState<{ color: string; neon: string | null; body_type: string; tint: string; spoiler: boolean } | null>(null);
  useFocusEffect(useCallback(() => {
    if (!profile) return;
    db.from('cars').select('color, neon, body_type, tint, spoiler').eq('owner_id', profile.id).eq('is_active', true).maybeSingle()
      .then(({ data }) => setMyCar(data as typeof myCar));
  }, [profile]));

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data, error } = await db.rpc('visible_cars', { p_city: null });
      if (alive && !error) setCars((data ?? []) as VisibleCar[]);
    };
    load();
    const t = setInterval(load, 15_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const shown = onlyCrew ? cars.filter((c) => c.same_crew) : cars;
  const sel = shown.find((c) => c.user_id === selected) ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <MapView style={{ flex: 1 }} mapStyle={mapStyle} logo={false} compass={false}
               attribution attributionPosition={{ bottom: 8, left: 8 }} onPress={() => setSelected(null)}>
        <Camera initialViewState={{ center: REGION_VIEW.center, zoom: REGION_VIEW.zoom, pitch: 0 }} />
        {position && (
          <Marker id="cena-eu" lngLat={[position.lon, position.lat]} glide={glide}>
            <Pressable onPress={() => setSelected('eu')} accessibilityRole="button" accessibilityLabel="Ver o seu perfil" hitSlop={8}>
              <CarMarker me color={myCar?.color} neon={myCar?.neon} heading={position.heading}
                         body={myCar?.body_type} tint={myCar?.tint} spoiler={myCar?.spoiler}
                         label={`@${profile?.username ?? 'você'}${profile?.visibility === 'ghost' ? ' · fantasma' : ' · você'}`} sameCrew />
            </Pressable>
          </Marker>
        )}
        {shown.map((c) => (
          <Marker key={c.user_id} id={`cena-${c.user_id}`} lngLat={[c.lon, c.lat]}>
            <Pressable onPress={() => setSelected(c.user_id)} accessibilityRole="button" accessibilityLabel={`Ver perfil de @${c.username}`}
                       hitSlop={8}>
              <CarMarker color={c.car?.color} neon={c.car?.neon} heading={c.heading} label={`@${c.username}`}
                         body={c.car?.body_type} tint={c.car?.tint} spoiler={c.car?.spoiler}
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
            <Text style={s.mono}>{shown.length + (position ? 1 : 0)} {shown.length + (position ? 1 : 0) === 1 ? 'CARRO' : 'CARROS'}</Text>
          </View>
          <Pressable onPress={() => router.push('/visibilidade')} style={s.chip} accessibilityRole="button">
            <Text style={[s.mono, { color: colors.neon }]}>QUEM ME VÊ</Text>
          </Pressable>
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
        <ProfileSheet key={sel.user_id} username={sel.username} car={sel.car} updatedAt={sel.updated_at}
                      statusHighlight={sel.same_crew} onClose={() => setSelected(null)} bottom={28}
                      status={sel.same_crew ? 'SUA EQUIPE · POSIÇÃO EXATA' : sel.approximate ? 'REGIÃO APROXIMADA (~500 M)' : 'POSIÇÃO LIBERADA PELA PESSOA'} />
      )}
      {selected === 'eu' && profile && (
        <ProfileSheet key="eu" username={profile.username} car={myCar} statusHighlight onClose={() => setSelected(null)} bottom={28}
                      status={profile.visibility === 'ghost' ? 'MODO FANTASMA · SÓ VOCÊ SE VÊ' : 'VOCÊ NO MAPA'} />
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
});
