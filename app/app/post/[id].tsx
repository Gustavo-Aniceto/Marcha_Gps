// Um post com os comentários.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, ErrorText, Screen, Title } from '../../src/components/ui';
import { Avatar } from '../../src/components/Avatar';
import { PostCard } from '../../src/components/PostCard';
import { db } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';
import { friendlyError } from '../../src/lib/errors.ts';
import { ago, type Comment, type Post } from '../../src/lib/social';
import { colors } from '../../src/theme/tokens.ts';
import { goBack } from '../../src/lib/goBack';

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useSession();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    // o post vem pelo feed do autor (mesmas regras de quem pode ver)
    const { data: row } = await db.from('posts').select('author_id').eq('id', id).maybeSingle();
    if (!row) { setGone(true); return; }
    const { data: list } = await db.rpc('feed', { p_crew: null, p_before: null, p_limit: 100, p_author: (row as { author_id: string }).author_id });
    setPost(((list ?? []) as Post[]).find((p) => p.id === id) ?? null);
    const { data: c } = await db.rpc('post_comments_of', { p_post: id });
    setComments((c ?? []) as Comment[]);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function send() {
    if (!profile || !text.trim()) return;
    setBusy(true); setError(null);
    const { error: e } = await db.from('post_comments').insert({ post_id: id, author_id: profile.id, body: text.trim() });
    setBusy(false);
    if (e) { setError(friendlyError(e)); return; }
    setText('');
    load();
  }

  async function remove(c: Comment) {
    await db.from('post_comments').delete().eq('id', c.id);
    load();
  }

  return (
    <Screen>
      <Title back>Post</Title>
      {gone && <Text style={{ color: colors.textMuted }}>Esse post foi apagado ou você não tem acesso.</Text>}
      {!post && !gone && <ActivityIndicator color={colors.neon} />}
      {post && profile && <PostCard post={post} me={profile.id} detail onChange={() => goBack(router)} />}

      {post && (
        <View style={{ gap: 12 }}>
          {comments.length === 0 && <Text style={{ color: colors.textMuted }}>Sem comentários ainda.</Text>}
          {comments.map((c) => (
            <View key={c.id} style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => router.push({ pathname: '/perfil/[username]', params: { username: c.username } })}>
                <Avatar username={c.username} avatarKey={c.avatar_key} size={32} />
              </Pressable>
              <View style={{ flex: 1, backgroundColor: colors.panel, borderRadius: 14, padding: 10, gap: 2 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>@{c.username} <Text style={{ color: colors.textMuted, fontWeight: '400', fontSize: 12 }}>{ago(c.created_at)}</Text></Text>
                <Text style={{ color: colors.text, fontSize: 15 }}>{c.body}</Text>
                {(c.mine || post.mine) && (
                  <Pressable onPress={() => remove(c)} accessibilityRole="button" style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>Apagar</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <TextInput value={text} onChangeText={setText} placeholder="Comentar…" placeholderTextColor={colors.textMuted}
                       multiline maxLength={500} accessibilityLabel="Escrever comentário"
                       style={{ flex: 1, minHeight: 44, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.lineStrong,
                                borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.panel }} />
            <View style={{ width: 96 }}><Button title="Enviar" onPress={send} loading={busy} disabled={!text.trim()} /></View>
          </View>
          <ErrorText>{error}</ErrorText>
        </View>
      )}
    </Screen>
  );
}
