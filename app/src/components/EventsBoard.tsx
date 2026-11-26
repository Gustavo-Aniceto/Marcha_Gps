// Painel de eventos: lista com capa, data, título, equipe, cidade, local e descrição.
// Botões: confirmar presença (set_rsvp) e, se a pessoa não é da equipe, pedir pra entrar (request_join_crew).
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Body, Button, ErrorText, Pills } from './ui';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { db } from '../lib/db';
import { friendlyError } from '../lib/errors.ts';
import { photoUrl } from '../lib/photos';
import { whenText } from '../lib/events.ts';
import { readableAccent } from '../lib/contrast.ts';
import { colors, fonts } from '../theme/tokens.ts';

export interface BoardEvent {
  id: string; title: string; starts_at: string; ends_at: string; cover_key: string | null; description: string | null;
  place_name: string | null; lat: number; lon: number; crew_id: string; crew_name: string; crew_color: string;
  crew_avatar: string | null; city: string | null; visibility: string; going: number; i_am_going: boolean;
  i_am_member: boolean; my_join_request: string | null;
}

const MONTH = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const WEEK = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

/** Ações do evento (presença e pedir pra entrar), usadas na lista e na página do evento. */
export function useEventActions(onDone: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(key: string, fn: string, args: Record<string, unknown>) {
    setBusy(key); setError(null);
    const { error: e } = await db.rpc(fn, args);
    setBusy(null);
    if (e) { setError(friendlyError(e)); return; }
    onDone();
  }
  return {
    busy, error,
    rsvp: (ev: BoardEvent) => run(`rsvp-${ev.id}`, 'set_rsvp', { p_event: ev.id, p_going: !ev.i_am_going }),
    join: (ev: BoardEvent) => run(`join-${ev.id}`, 'request_join_crew', { p_crew: ev.crew_id, p_message: `Vi o evento "${ev.title}" no app.` }),
  };
}

export function EventCard({ ev, actions, onOpen }: { ev: BoardEvent; actions: ReturnType<typeof useEventActions>; onOpen?: () => void }) {
  const d = new Date(ev.starts_at);
  const accent = readableAccent(ev.crew_color);
  const cover = photoUrl(ev.cover_key);
  const ended = new Date(ev.ends_at).getTime() < Date.now();
  return (
    <View style={[s.card, { borderColor: ev.i_am_going ? accent : colors.line }]}>
      <Pressable onPress={onOpen} disabled={!onOpen} accessibilityRole="link" accessibilityLabel={`Abrir evento ${ev.title}`}>
        <View style={s.cover}>
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={`Capa do evento ${ev.title}`} />
            : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.panelAlt, justifyContent: 'center', overflow: 'hidden' }]}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: ev.crew_color, opacity: 0.18 }]} />
                <Text style={{ width: 1400, color: accent, opacity: 0.22, fontSize: 44, fontWeight: '900', marginLeft: 10,
                               transform: [{ rotate: '-6deg' }] }}>{ev.title.toUpperCase()}</Text>
              </View>
            )}
          {/* data em destaque, como num ingresso */}
          <View style={s.date}>
            <Text style={s.dateWeek}>{WEEK[d.getDay()]}</Text>
            <Text style={s.dateDay}>{d.getDate()}</Text>
            <Text style={s.dateMonth}>{MONTH[d.getMonth()]}</Text>
          </View>
          {ev.visibility !== 'open' && <Text style={s.badge}>SÓ MEMBROS</Text>}
          {ended && <Text style={[s.badge, { left: undefined, right: 10 }]}>ACABOU</Text>}
        </View>
        <View style={{ padding: 14, gap: 6 }}>
          <Text style={s.title} numberOfLines={2}>{ev.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Avatar username={ev.crew_name} avatarKey={ev.crew_avatar} size={22} ring={accent} />
            <Text style={{ color: accent, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>{ev.crew_name}</Text>
          </View>
          <View style={s.metaRow}><Icon name="clock" size={14} color={colors.textMuted} /><Text style={s.meta}>{whenText(d)}</Text>
            {ev.city ? <><Icon name="pin" size={14} color={colors.textMuted} /><Text style={s.meta}>{ev.city}</Text></> : null}</View>
          {ev.place_name ? <View style={s.metaRow}><Icon name="flag" size={14} color={colors.textMuted} /><Text style={[s.meta, { flexShrink: 1 }]} numberOfLines={2}>{ev.place_name}</Text></View> : null}
          {ev.description ? <Text style={{ color: colors.textDim }} numberOfLines={3}>{ev.description}</Text> : null}
          <Text style={[s.meta, { fontFamily: fonts.mono }]}>{ev.going} {ev.going === 1 ? 'CONFIRMADO' : 'CONFIRMADOS'}</Text>
        </View>
      </Pressable>
      {!ended && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
          <Button title={ev.i_am_going ? '✓ Presença confirmada (desfazer)' : 'Confirmar presença'} color={ev.crew_color}
                  variant={ev.i_am_going ? 'secondary' : 'primary'} loading={actions.busy === `rsvp-${ev.id}`}
                  onPress={() => actions.rsvp(ev)} />
          {!ev.i_am_member && (
            ev.my_join_request === 'pending'
              ? <Text style={[s.meta, { textAlign: 'center' }]}>Pedido pra entrar na {ev.crew_name} enviado. O fundador responde.</Text>
              : <Button title={`Pedir pra entrar na ${ev.crew_name}`} variant="secondary" color={ev.crew_color}
                        loading={actions.busy === `join-${ev.id}`} onPress={() => actions.join(ev)} />
          )}
        </View>
      )}
    </View>
  );
}

export function EventsBoard() {
  const router = useRouter();
  const [scope, setScope] = useState<'todos' | 'minhas' | 'vou'>('todos');
  const [list, setList] = useState<BoardEvent[] | null>(null);
  const load = useCallback(async () => {
    const { data } = await db.rpc('events_board', { p_scope: scope });
    setList((data ?? []) as BoardEvent[]);
  }, [scope]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const actions = useEventActions(load);

  return (
    <View style={{ gap: 12 }}>
      <Pills options={[{ value: 'todos', label: 'Todos' }, { value: 'minhas', label: 'Minhas equipes' }, { value: 'vou', label: 'Vou' }]}
             value={scope} onChange={(v) => { setScope(v as typeof scope); setList(null); }} />
      <ErrorText>{actions.error}</ErrorText>
      {list === null ? <ActivityIndicator color={colors.neon} /> : list.length === 0 ? (
        <Body dim>{scope === 'vou' ? 'Você ainda não confirmou presença em nenhum evento.'
          : scope === 'minhas' ? 'Suas equipes não marcaram evento ainda.' : 'Nenhum evento marcado por enquanto.'}</Body>
      ) : list.map((ev) => (
        <EventCard key={ev.id} ev={ev} actions={actions}
                   onOpen={() => router.push({ pathname: '/evento/[id]', params: { id: ev.id } })} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, backgroundColor: colors.panel, overflow: 'hidden' },
  cover: { height: 150, backgroundColor: colors.panelAlt },
  date: { position: 'absolute', left: 10, bottom: 10, width: 54, borderRadius: 14, backgroundColor: 'rgba(10,12,16,0.88)',
          alignItems: 'center', paddingVertical: 4, borderWidth: 1, borderColor: colors.lineStrong },
  dateWeek: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  dateDay: { color: colors.text, fontSize: 22, fontWeight: '900', lineHeight: 24 },
  dateMonth: { color: colors.neon, fontSize: 11, fontWeight: '800' },
  badge: { position: 'absolute', left: 10, top: 10, color: colors.text, backgroundColor: 'rgba(10,12,16,0.85)', fontSize: 11,
           fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  title: { color: colors.text, fontSize: 19, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
});
