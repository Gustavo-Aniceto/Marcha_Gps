// Comboio: mapa com quem está no comboio e o destino, lista de quem está junto / chegou / ficou pra
// trás, e os botões (entrar, ir pro destino, sair, encerrar). As posições vêm do banco
// (convoy_state: só pra quem está dentro, sem zona privada, sem bloqueado). Nada de velocidade.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Map as MapView, Marker } from '../../src/map';
import { CarMarker } from '../../src/components/CarMarker';
import { Button, Card, ErrorText, Mono, Title } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import { db } from '../../src/lib/db';
import { friendlyError } from '../../src/lib/errors.ts';
import { buildMapStyle } from '../../src/lib/mapStyle.ts';
import { convoyAlert, convoyRows, fmtKm, STATUS_TEXT, type ConvoyRow } from '../../src/lib/convoy.ts';
import { readableAccent } from '../../src/lib/contrast.ts';
import { useNavigation } from '../../src/lib/navigation';
import { lastKnownPosition } from '../../src/lib/lastPosition';
import { colors, fonts } from '../../src/theme/tokens.ts';

interface Member {
  username: string; avatar_key: string | null; me: boolean; lat: number | null; lon: number | null;
  heading: number | null; updated_at: string | null;
  car: { color?: string; neon?: string | null; body_type?: string; tint?: string; spoiler?: boolean } | null;
}
interface State {
  id: string; crew_id: string; title: string; dest_lat: number; dest_lon: number; dest_name: string | null;
  created_at: string; active: boolean; crew_name: string; crew_color: string; created_by: string;
  joined: boolean; can_end: boolean; members: Member[];
}

export default function Comboio() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mapStyle = useMemo(() => buildMapStyle('cena'), []);
  const [st, setSt] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const [tick, setTick] = useState(Date.now());

  const load = useCallback(async () => {
    const { data, error: e } = await db.rpc('convoy_state', { p_convoy: id });
    if (e) { setError(e.message.includes('forbidden') ? 'Esse comboio é de outra equipe.' : friendlyError(e)); return; }
    setSt((prev) => { if (!prev) setFitKey((k) => k + 1); return data as State; });
    setTick(Date.now());
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const rows: ConvoyRow[] = useMemo(() => (st ? convoyRows(st.members, { lat: st.dest_lat, lon: st.dest_lon }, tick) : []), [st, tick]);
  const alert = convoyAlert(rows);
  const accent = st ? readableAccent(st.crew_color) : colors.neon;
  const fit = useMemo(() => {
    if (!st) return null;
    const pts = st.members.filter((m) => m.lat != null).map((m) => ({ lat: m.lat!, lon: m.lon! }));
    const me = lastKnownPosition();
    return [{ lat: st.dest_lat, lon: st.dest_lon }, ...pts, ...(me ? [me] : [])];
  }, [fitKey, !!st]);

  async function act(fn: string) {
    setBusy(true); setError(null);
    const { error: e } = await db.rpc(fn, { p_convoy: id });
    setBusy(false);
    if (e) setError(e.message.includes('convoy_ended') ? 'Esse comboio já acabou.' : friendlyError(e));
    await load();
  }

  function goToDest() {
    if (!st) return;
    nav.start({ id: `comboio-${st.id}`, name: st.dest_name ?? st.title, detail: `Comboio · ${st.crew_name}`,
                lat: st.dest_lat, lon: st.dest_lon }, lastKnownPosition());
    router.push('/');
  }

  if (!st) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: insets.top + 20, gap: 12 }}>
        <Title back="/equipes">Comboio</Title>
        {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.neon} />}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ height: '46%' }}>
        <MapView style={{ flex: 1 }} mapStyle={mapStyle} logo={false} compass={false} attribution attributionPosition={{ bottom: 8, left: 8 }}>
          <Camera initialViewState={{ center: [st.dest_lon, st.dest_lat], zoom: 13, pitch: 0 }} fitCoords={fit} fitKey={fitKey}
                  fitPadding={{ top: insets.top + 80, bottom: 40, left: 40, right: 40 }} />
          <Marker id="comboio-destino" lngLat={[st.dest_lon, st.dest_lat]}>
            <View style={s.dest} accessibilityLabel={`Destino: ${st.dest_name ?? st.title}`}>
              <Icon name="flag" size={20} color={colors.ink} />
            </View>
          </Marker>
          {st.members.filter((m) => m.lat != null).map((m) => (
            <Marker key={m.username} id={`comboio-${m.username}`} lngLat={[m.lon!, m.lat!]}>
              <CarMarker me={m.me} color={m.car?.color} neon={m.car?.neon} heading={m.heading} label={`@${m.username}`}
                         body={m.car?.body_type} tint={m.car?.tint} spoiler={m.car?.spoiler} sameCrew />
            </Marker>
          ))}
        </MapView>
        <View style={[s.top, { top: insets.top + 10 }]}>
          <Title back="/equipes">{st.title}</Title>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}>
        <View style={{ gap: 4 }}>
          <Mono color={accent}>{`COMBOIO · ${st.crew_name.toUpperCase()}`}</Mono>
          <Text style={s.destText}>{st.dest_name ?? 'Destino no mapa'}</Text>
          <Text style={{ color: colors.textDim }}>
            Começou @{st.created_by} · {st.members.length} {st.members.length === 1 ? 'carro' : 'carros'}{st.active ? '' : ' · encerrado'}
          </Text>
        </View>

        {!!alert && st.joined && (
          <Card accent={colors.warn} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="alert" size={22} color={colors.warn} />
            <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{alert}. Segura pra galera alcançar.</Text>
          </Card>
        )}

        {st.active && !st.joined && (
          <Card style={{ gap: 8 }}>
            <Text style={{ color: colors.text }}>
              Entrando, sua posição aparece só pra quem está nesse comboio (mesmo no modo fantasma) até ele acabar ou você sair.
            </Text>
            <Button title="Entrar no comboio" color={st.crew_color} onPress={() => act('join_convoy')} loading={busy} />
          </Card>
        )}
        {st.active && st.joined && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="Ir pro destino" color={st.crew_color} onPress={goToDest} /></View>
            <View style={{ flex: 1 }}><Button title="Sair" variant="secondary" onPress={() => act('leave_convoy')} loading={busy} /></View>
          </View>
        )}
        <ErrorText>{error}</ErrorText>

        {rows.map((r) => {
          const m = st.members.find((x) => x.username === r.username)!;
          const c = r.status === 'atras' ? colors.warn : r.status === 'chegou' ? colors.neon : r.status === 'sem_sinal' ? colors.textMuted : accent;
          return (
            <View key={r.username} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>@{r.username}{m.me ? ' · você' : ''}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {!st.joined ? 'Entre no comboio pra ver onde a galera está'
                    : r.status === 'atras' ? `${fmtKm(r.gap_m!)} atrás · ${fmtKm(r.dist_m!)} do destino`
                    : r.dist_m != null ? `${fmtKm(r.dist_m)} do destino` : 'Sem posição nos últimos 3 min'}
                </Text>
              </View>
              {st.joined && <Mono color={c}>{STATUS_TEXT[r.status]}</Mono>}
            </View>
          );
        })}

        {st.active && st.can_end && (
          <Button title="Encerrar comboio" variant="secondary" onPress={() => act('end_convoy')} loading={busy} />
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  top: { position: 'absolute', left: 12, right: 12, padding: 6, borderRadius: 18, backgroundColor: 'rgba(10,11,13,0.86)' },
  dest: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.neon, alignItems: 'center', justifyContent: 'center',
          borderWidth: 3, borderColor: colors.bg },
  destText: { color: colors.text, fontFamily: fonts.display, fontWeight: '800', fontSize: 20, letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, borderWidth: 1,
         borderColor: colors.line, backgroundColor: colors.panel },
});
