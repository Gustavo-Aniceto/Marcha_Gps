// Página do evento: capa, data, local, descrição, confirmar presença, pedir pra entrar na equipe e a galeria
// de mídias. Admin pode contestar mídia em até 24 h.
import React, { useCallback, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Body, Button, Card, ErrorText, Label, Mono, Screen, Title } from '../../src/components/ui';
import { db } from '../../src/lib/db';
import { friendlyError } from '../../src/lib/errors.ts';
import { photoUrl } from '../../src/lib/photos';
import { eventWindow, kindLabel, whenText } from '../../src/lib/events.ts';
import { readableAccent } from '../../src/lib/contrast.ts';
import { colors } from '../../src/theme/tokens.ts';
import { goBack } from '../../src/lib/goBack';
import { EventCard, useEventActions, type BoardEvent } from '../../src/components/EventsBoard';

interface Ev { id: string; crew_id: string; kind: string; title: string; starts_at: string; ends_at: string; crews: { name: string; color: string } }
interface Media { id: string; user_id: string; photo_path: string; status: string; created_at: string; profiles: { username: string } }

export default function Evento() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ev, setEv] = useState<Ev | null>(null);
  const [board, setBoard] = useState<BoardEvent | null>(null);
  const [going, setGoing] = useState(0);
  const [media, setMedia] = useState<Media[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: d } = await db.rpc('event_detail', { p_event: id });
    setBoard((d as BoardEvent | null) ?? null);
    const { data: e } = await db.from('events').select('id, crew_id, kind, title, starts_at, ends_at, crews(name, color)').eq('id', id).maybeSingle();
    const event = e as unknown as Ev | null;
    setEv(event);
    if (!event) return;
    const { count } = await db.from('event_rsvps').select('user_id', { count: 'exact', head: true }).eq('event_id', id);
    setGoing(count ?? 0);
    const { data: m } = await db.from('event_media')
      .select('id, user_id, photo_path, status, created_at, profiles!event_media_user_id_fkey(username)')
      .eq('event_id', id).order('created_at', { ascending: false });
    setMedia((m ?? []) as unknown as Media[]);
    const { data: adm } = await db.rpc('is_crew_admin', { p_crew: event.crew_id });
    setIsAdmin(adm === true);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function contest(m: Media) {
    setError(null);
    const { error: e } = await db.rpc('contest_event_media', { p_media: m.id });
    if (e) setError(friendlyError(e)); else load();
  }

  const actions = useEventActions(load);
  if (!ev) return <Screen><Body dim>Evento não encontrado ou você não tem acesso.</Body><Button title="Voltar" onPress={() => goBack(router)} /></Screen>;
  const accent = readableAccent(ev.crews.color);
  const win = eventWindow(new Date(ev.starts_at), new Date(ev.ends_at));

  return (
    <Screen>
      <Mono color={accent}>{ev.crews.name.toUpperCase()} · {kindLabel(ev.kind).toUpperCase()}</Mono>
      <Title back>{ev.title}</Title>
      {board ? <EventCard ev={board} actions={actions} /> : null}
      <ErrorText>{actions.error}</ErrorText>
      <Body dim>{whenText(new Date(ev.starts_at))} · {board?.going ?? going} {(board?.going ?? going) === 1 ? 'vai' : 'vão'} · {media.filter((m) => m.status === 'accepted').length} mídias</Body>

      {win === 'aberto' && (
        <Button title="Fazer a mídia" color={ev.crews.color}
                onPress={() => router.push({ pathname: '/midia/[id]', params: { id: ev.id, titulo: ev.title } })} />
      )}

      <Label>Galeria</Label>
      {media.length === 0 && <Body dim>Ninguém fez a mídia ainda.</Body>}
      {media.map((m) => {
        const url = photoUrl(m.photo_path);
        const canContest = isAdmin && m.status === 'accepted' && Date.now() - new Date(m.created_at).getTime() < 24 * 3_600_000;
        return (
          <Card key={m.id} accent={m.status === 'contested' ? colors.warn : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>@{m.profiles.username}</Text>
              <Mono color={m.status === 'contested' ? colors.warn : colors.neon}>{m.status === 'contested' ? 'CONTESTADA' : 'VALEU'}</Mono>
            </View>
            {url ? <Image source={{ uri: url }} style={{ height: 220, borderRadius: 6 }} accessibilityLabel={`Mídia de @${m.profiles.username}`} />
                 : <Body dim>[foto]</Body>}
            {canContest && <Button title="Contestar (tira os 50 XP)" variant="secondary" color={colors.warn} onPress={() => contest(m)} />}
          </Card>
        );
      })}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
