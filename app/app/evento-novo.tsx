// Criar evento (fundador e admins). O banco recusa se a pessoa não for admin da equipe.
// Sem escolher tipo: nome, dia no calendário, horário, local (busca de endereço; não precisa estar lá) e quem vê.
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Body, Button, Card, ErrorText, Field, Label, Mono, Pills, Screen, Title } from '../src/components/ui';
import { db } from '../src/lib/db';
import { useSession } from '../src/lib/session';
import { friendlyError } from '../src/lib/errors.ts';
import { atTime, isPastDay, monthGrid, MONTHS, sameDay, shiftMonth, WEEKDAYS_SHORT, whenText } from '../src/lib/events.ts';
import { searchPlaces, type Place } from '../src/lib/routing';
import { colors } from '../src/theme/tokens.ts';
import { goBack } from '../src/lib/goBack';

type Vis = 'crew' | 'open';
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = [0, 15, 30, 45];

export default function EventoNovo() {
  const router = useRouter();
  const { crew } = useLocalSearchParams<{ crew: string }>();
  const { profile } = useSession();
  const now = new Date();
  const [title, setTitle] = useState('');
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [day, setDay] = useState<Date | null>(null);
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(0);
  const [hours, setHours] = useState(4);
  const [vis, setVis] = useState<Vis>('crew');
  const [place, setPlace] = useState<{ name: string; lat: number; lon: number } | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weeks = useMemo(() => monthGrid(view.year, view.month), [view]);
  const starts = day ? atTime(day, hour, minute) : null;
  const startsPast = starts ? starts.getTime() <= Date.now() : false;
  const canGoBack = view.year > now.getFullYear() || (view.year === now.getFullYear() && view.month > now.getMonth());

  async function search() {
    if (q.trim().length < 3) return;
    setSearching(true); setError(null);
    try { setResults(await searchPlaces(q.trim())); }
    catch { setError('Não consegui buscar esse endereço agora. Tenta de novo.'); }
    finally { setSearching(false); }
  }

  async function here() {
    setError(null);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPlace({ name: 'Onde eu estava quando criei', lat: loc.coords.latitude, lon: loc.coords.longitude });
      setResults([]);
    } catch {
      setError('Não consegui pegar sua localização.');
    }
  }

  async function save() {
    if (!profile || !crew || !place || !starts) return;
    if (startsPast) { setError('Esse horário já passou. Escolha outro.'); return; }
    setBusy(true); setError(null);
    const ends = new Date(starts.getTime() + hours * 3_600_000);
    const { error: e } = await db.from('events').insert({
      crew_id: crew, title: title.trim(), starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      lat: place.lat, lon: place.lon, radius_m: 200, visibility: vis, verified_only: true, created_by: profile.id,
    });
    setBusy(false);
    if (e) setError(friendlyError(e)); else goBack(router);
  }

  return (
    <Screen>
      <Title>Novo evento</Title>
      <Field label="Nome do evento" value={title} onChangeText={setTitle} maxLength={60} placeholder="Ex.: Encontro de sábado" />

      <Label>Dia</Label>
      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => canGoBack && setView(shiftMonth(view.year, view.month, -1))} disabled={!canGoBack}
                     accessibilityRole="button" accessibilityLabel="Mês anterior" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: canGoBack ? colors.holo : colors.textMuted, fontSize: 22, textAlign: 'center' }}>‹</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{MONTHS[view.month]} de {view.year}</Text>
          <Pressable onPress={() => setView(shiftMonth(view.year, view.month, 1))} accessibilityRole="button"
                     accessibilityLabel="Próximo mês" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: colors.holo, fontSize: 22, textAlign: 'center' }}>›</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS_SHORT.map((w, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 12 }}>{w}</Text>
          ))}
        </View>
        {weeks.map((w, wi) => (
          <View key={wi} style={{ flexDirection: 'row' }}>
            {w.map((d, di) => {
              if (!d) return <View key={di} style={{ flex: 1, height: 44 }} />;
              const past = isPastDay(d);
              const on = !!day && sameDay(d, day);
              const today = sameDay(d, now);
              return (
                <Pressable key={di} disabled={past} onPress={() => setDay(d)} accessibilityRole="button"
                           accessibilityState={{ selected: on, disabled: past }}
                           accessibilityLabel={`${d.getDate()} de ${MONTHS[d.getMonth()]}${today ? ', hoje' : ''}`}
                           style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
                                 backgroundColor: on ? colors.neon : 'transparent', borderWidth: today && !on ? 1 : 0, borderColor: colors.holo }}>
                    <Text style={{ color: on ? colors.ink : past ? colors.textMuted : colors.text, fontWeight: on ? '800' : '500',
                                   opacity: past ? 0.4 : 1 }}>{d.getDate()}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      <Label>Horário</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {HOURS.map((h) => {
          const on = h === hour;
          return (
            <Pressable key={h} onPress={() => setHour(h)} accessibilityRole="button" accessibilityState={{ selected: on }}
                       accessibilityLabel={`${h} horas`}
                       style={{ width: '14.6%', minHeight: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
                                borderColor: on ? colors.neon : colors.line, backgroundColor: on ? colors.neon : colors.panel }}>
              <Text style={{ color: on ? colors.ink : colors.text, fontWeight: on ? '800' : '500' }}>{String(h).padStart(2, '0')}h</Text>
            </Pressable>
          );
        })}
      </View>
      <Pills options={MINUTES.map((m) => ({ value: m, label: `:${String(m).padStart(2, '0')}` }))} value={minute} onChange={setMinute} />
      <Label>Dura</Label>
      <Pills options={[2, 3, 4, 6, 8].map((h) => ({ value: h, label: `${h} h` }))} value={hours} onChange={setHours} />
      {starts && <Mono color={startsPast ? colors.danger : colors.holo}>{startsPast ? 'ESSE HORÁRIO JÁ PASSOU' : whenText(starts).toUpperCase()}</Mono>}

      <Label>Local</Label>
      <Card style={{ gap: 8 }}>
        {place ? (
          <>
            <Text style={{ color: colors.neon, fontWeight: '700' }}>📍 {place.name}</Text>
            <Button title="Trocar o local" variant="secondary" onPress={() => setPlace(null)} />
          </>
        ) : (
          <>
            <Body dim>Busque o endereço ou o nome do lugar. Não precisa estar lá.</Body>
            <Field label="Endereço ou lugar" value={q} onChangeText={setQ} placeholder="Ex.: Posto Ipiranga Av. Brasil, Guarulhos"
                   returnKeyType="search" onSubmitEditing={search} />
            <Button title="Buscar" variant="secondary" onPress={search} disabled={q.trim().length < 3} loading={searching} />
            {searching && <ActivityIndicator color={colors.neon} />}
            {results.map((r) => (
              <Pressable key={r.id} onPress={() => { setPlace({ name: `${r.name}${r.detail ? ` · ${r.detail}` : ''}`, lat: r.lat, lon: r.lon }); setResults([]); }}
                         accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderColor: colors.line }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{r.name}</Text>
                {r.detail ? <Text style={{ color: colors.textDim, fontSize: 13 }}>{r.detail}</Text> : null}
              </Pressable>
            ))}
            <Text style={{ color: colors.holo, paddingVertical: 8 }} onPress={here} accessibilityRole="button">Ou usar onde estou agora</Text>
          </>
        )}
      </Card>

      <Label>Quem pode ver</Label>
      <Pills options={[{ value: 'crew', label: 'Só a equipe' }, { value: 'open', label: 'Aberto pra cena' }]}
             value={vis} onChange={(v) => setVis(v as Vis)} />
      <ErrorText>{error}</ErrorText>
      <Button title="Publicar evento" onPress={save} loading={busy}
              disabled={title.trim().length < 2 || !place || !starts || startsPast} />
      <Button title="Cancelar" variant="secondary" onPress={() => goBack(router)} />
    </Screen>
  );
}
