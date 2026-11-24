// Feed: rede social da cena. Postagens (geral ou da equipe) com foto, curtida e comentário,
// e os próximos eventos no topo.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, ErrorText, Pills, Screen } from '../../src/components/ui';
import { Avatar } from '../../src/components/Avatar';
import { PostCard } from '../../src/components/PostCard';
import { db } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';
import { friendlyError } from '../../src/lib/errors.ts';
import { uploadPhoto } from '../../src/lib/photos';
import { loadFeed, type Post } from '../../src/lib/social';
import { kindLabel, whenText } from '../../src/lib/events.ts';
import { readableAccent } from '../../src/lib/contrast.ts';
import { colors, fonts } from '../../src/theme/tokens.ts';

export interface UpcomingEvent {
  id: string; crew_id: string; crew_name: string; crew_color: string; kind: string; title: string;
  starts_at: string; ends_at: string; going: number; i_am_going: boolean; my_media: boolean;
}
interface Crew { id: string; name: string }

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
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: m } = await db.from('crew_members').select('crews(id, name)').eq('user_id', profile.id);
      setCrews(((m ?? []) as unknown as { crews: Crew | null }[]).map((r) => r.crews).filter(Boolean) as Crew[]);
      const { data: ev } = await db.rpc('upcoming_events', { p_limit: 10 });
      setEvents((ev ?? []) as UpcomingEvent[]);
      const list = await loadFeed({ crew: scope === 'geral' ? null : scope });
      setPosts(list);
      setMore(list.length >= 20);
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [profile, scope]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function loadMore() {
    const last = posts[posts.length - 1];
    if (!last) return;
    try {
      const list = await loadFeed({ crew: scope === 'geral' ? null : scope, before: last.created_at });
      setPosts((p) => [...p, ...list]);
      setMore(list.length >= 20);
    } catch (e) { setError(friendlyError(e)); }
  }

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled && r.assets[0]) setPhoto(r.assets[0].uri);
  }

  async function publish() {
    if (!profile) return;
    if (!text.trim() && !photo) { setError('Escreve alguma coisa ou põe uma foto.'); return; }
    setBusy(true); setError(null);
    try {
      const photo_key = photo ? await uploadPhoto(photo, 'post') : null;
      const { error: e } = await db.from('posts').insert({
        author_id: profile.id, crew_id: scope === 'geral' ? null : scope, body: text.trim() || '📸', photo_key,
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

  const scopeName = scope === 'geral' ? 'todo mundo' : crews.find((c) => c.id === scope)?.name ?? 'a equipe';

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 28 }}>Feed</Text>
        {profile && (
          <Pressable onPress={() => router.push({ pathname: '/perfil/[username]', params: { username: profile.username } })}
                     accessibilityRole="link" accessibilityLabel="Meu perfil">
            <Avatar username={profile.username} avatarKey={profile.avatar_key} size={38} ring={colors.neon} />
          </Pressable>
        )}
      </View>

      {events.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {events.map((ev) => {
            const accent = readableAccent(ev.crew_color);
            return (
              <Pressable key={ev.id} onPress={() => router.push({ pathname: '/evento/[id]', params: { id: ev.id } })}
                         style={{ width: 220, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: accent, backgroundColor: colors.panel, gap: 4 }}>
                <Text style={{ color: accent, fontFamily: fonts.mono, fontSize: 10 }}>{ev.crew_name.toUpperCase()} · {kindLabel(ev.kind).toUpperCase()}</Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{ev.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{whenText(new Date(ev.starts_at))} · {ev.going} {ev.going === 1 ? 'vai' : 'vão'}</Text>
                {ev.i_am_going && <Text style={{ color: colors.neon, fontSize: 12, fontWeight: '700' }}>Você vai ✓</Text>}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Pills options={[{ value: 'geral', label: 'Geral' }, ...crews.map((c) => ({ value: c.id, label: c.name }))]}
             value={scope} onChange={setScope} />

      {/* novo post */}
      <View style={{ backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {profile && <Avatar username={profile.username} avatarKey={profile.avatar_key} />}
          <TextInput value={text} onChangeText={setText} multiline maxLength={1000}
                     placeholder={`Fala pra ${scopeName}… rolê, setup, foto do carro`} placeholderTextColor={colors.textMuted}
                     style={{ flex: 1, minHeight: 60, color: colors.text, fontSize: 15, textAlignVertical: 'top' }}
                     accessibilityLabel="Escrever post" />
        </View>
        {photo && (
          <View>
            <Image source={{ uri: photo }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 8 }} accessibilityLabel="Foto escolhida" />
            <Pressable onPress={() => setPhoto(null)} style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: colors.text }}>Tirar</Text>
            </Pressable>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button title={photo ? 'Trocar foto' : '📷 Foto'} variant="secondary" onPress={pickPhoto} /></View>
          <View style={{ flex: 1 }}><Button title="Postar" onPress={publish} loading={busy} /></View>
        </View>
        <ErrorText>{error}</ErrorText>
      </View>

      {loading && posts.length === 0 && <ActivityIndicator color={colors.neon} style={{ marginTop: 20 }} />}
      {!loading && posts.length === 0 && (
        <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20 }}>Nada por aqui ainda. Posta a primeira!</Text>
      )}
      {profile && posts.map((p) => <PostCard key={p.id} post={p} me={profile.id} onChange={load} />)}
      {more && posts.length > 0 && <Button title="Ver mais" variant="secondary" onPress={loadMore} />}
    </Screen>
  );
}
