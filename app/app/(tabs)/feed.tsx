// Feed: próximos eventos + postagens (minhas equipes ou geral).
import React, { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Body, Button, Card, ErrorText, Field, Label, Mono, Pills, Screen, Title } from '../../src/components/ui';
import { db } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';
import { friendlyError } from '../../src/lib/errors.ts';
import { photoUrl, uploadPhoto } from '../../src/lib/photos';
import { eventWindow, kindLabel, whenText } from '../../src/lib/events.ts';
import { readableAccent } from '../../src/lib/contrast.ts';
import { colors } from '../../src/theme/tokens.ts';

interface Post {
  id: string; author_id: string; username: string; crew_name: string | null; crew_color: string | null;
  body: string; photo_key: string | null; created_at: string; likes: number; liked_by_me: boolean;
}
export interface UpcomingEvent {
  id: string; crew_id: string; crew_name: string; crew_color: string; kind: string; title: string;
  starts_at: string; ends_at: string; going: number; i_am_going: boolean; my_media: boolean;
}
interface Crew { id: string; name: string }

function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}

export default function Feed() {
  const router = useRouter();
  const { profile } = useSession();
  const [crews, setCrews] = useState<Crew[]>([]);
  const [scope, setScope] = useState<string>('geral'); // 'geral' ou id da equipe
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data: m } = await db.from('crew_members').select('crews(id, name)').eq('user_id', profile.id);
    const list = (m ?? []).map((r: any) => r.crews).filter(Boolean) as Crew[];
    setCrews(list);
    const { data: ev } = await db.rpc('upcoming_events', { p_limit: 10 });
    setEvents((ev ?? []) as UpcomingEvent[]);
    const { data: p } = await db.rpc('feed', { p_crew: scope === 'geral' ? null : scope, p_before: null, p_limit: 30 });
    setPosts((p ?? []) as Post[]);
  }, [profile, scope]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled && r.assets[0]) setPhoto(r.assets[0].uri);
  }

  async function publish() {
    if (!profile) return;
    setBusy(true); setError(null);
    try {
      const photo_key = photo ? await uploadPhoto(photo, 'post') : null;
      const { error: e } = await db.from('posts').insert({
        author_id: profile.id, crew_id: scope === 'geral' ? null : scope, body: text.trim(), photo_key,
      });
      if (e) throw e;
      setText(''); setPhoto(null);
      await load();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleGoing(ev: UpcomingEvent) {
    if (!profile) return;
    const q = ev.i_am_going
      ? db.from('event_rsvps').delete().eq('event_id', ev.id).eq('user_id', profile.id)
      : db.from('event_rsvps').insert({ event_id: ev.id, user_id: profile.id });
    const { error: e } = await q;
    if (e) setError(friendlyError(e)); else load();
  }

  async function toggleLike(p: Post) {
    if (!profile) return;
    const q = p.liked_by_me
      ? db.from('post_likes').delete().eq('post_id', p.id).eq('user_id', profile.id)
      : db.from('post_likes').insert({ post_id: p.id, user_id: profile.id });
    await q;
    load();
  }

  return (
    <Screen>
      <Title>Feed</Title>

      {events.length > 0 && <Label>Próximos eventos</Label>}
      {events.map((ev) => {
        const win = eventWindow(new Date(ev.starts_at), new Date(ev.ends_at));
        const accent = readableAccent(ev.crew_color);
        return (
          <Card key={ev.id} accent={accent}>
            <Mono color={accent}>{ev.crew_name.toUpperCase()} · {kindLabel(ev.kind).toUpperCase()}</Mono>
            <Pressable onPress={() => router.push({ pathname: '/evento/[id]', params: { id: ev.id } })} accessibilityRole="link">
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{ev.title} ›</Text>
            </Pressable>
            <Body dim>{whenText(new Date(ev.starts_at))} · {ev.going} {ev.going === 1 ? 'vai' : 'vão'}</Body>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title={ev.i_am_going ? 'Vou ✓' : 'Vou'} variant={ev.i_am_going ? 'primary' : 'secondary'}
                        color={ev.crew_color} onPress={() => toggleGoing(ev)} />
              </View>
              {win === 'aberto' && !ev.my_media && (
                <View style={{ flex: 1 }}>
                  <Button title="Fazer a mídia" color={ev.crew_color}
                          onPress={() => router.push({ pathname: '/midia/[id]', params: { id: ev.id, titulo: ev.title } })} />
                </View>
              )}
            </View>
            {ev.my_media && <Mono color={colors.neon}>PRESENÇA CONFIRMADA</Mono>}
          </Card>
        );
      })}

      <Pills options={[{ value: 'geral', label: 'Geral' }, ...crews.map((c) => ({ value: c.id, label: c.name }))]}
             value={scope} onChange={setScope} />

      <Card>
        <Field label={scope === 'geral' ? 'Postar pra todo mundo' : `Postar pra ${crews.find((c) => c.id === scope)?.name}`}
               value={text} onChangeText={setText} multiline maxLength={1000} placeholder="Fala aí..." style={{ minHeight: 70 }} />
        {photo && <Image source={{ uri: photo }} style={{ height: 160, borderRadius: 6 }} accessibilityLabel="Foto escolhida" />}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title={photo ? 'Trocar foto' : 'Foto'} variant="secondary" onPress={pickPhoto} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Postar" onPress={publish} loading={busy} disabled={!text.trim()} />
          </View>
        </View>
        <ErrorText>{error}</ErrorText>
      </Card>

      {posts.length === 0 && <Body dim>Nada por aqui ainda. Posta a primeira!</Body>}
      {posts.map((p) => {
        const img = photoUrl(p.photo_key);
        return (
          <Card key={p.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>@{p.username}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{ago(p.created_at)}</Text>
            </View>
            <Body>{p.body}</Body>
            {img && <Image source={{ uri: img }} style={{ height: 200, borderRadius: 6 }} accessibilityLabel={`Foto de @${p.username}`} />}
            <Pressable onPress={() => toggleLike(p)} accessibilityRole="button" accessibilityState={{ selected: p.liked_by_me }}
                       style={{ minHeight: 40, justifyContent: 'center' }}>
              <Text style={{ color: p.liked_by_me ? colors.neon : colors.textDim, fontWeight: '600' }}>
                {p.liked_by_me ? '♥' : '♡'} {p.likes}
              </Text>
            </Pressable>
          </Card>
        );
      })}
    </Screen>
  );
}
