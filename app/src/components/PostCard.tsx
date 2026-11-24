// Post do feed: autor (foto, @, carro), texto, foto, curtir, comentar, compartilhar, apagar.
import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from './Avatar';
import { photoUrl } from '../lib/photos';
import { ago, deletePost, toggleLike, type Post } from '../lib/social';
import { shareText } from '../lib/share';
import { readableAccent } from '../lib/contrast.ts';
import { colors, fonts } from '../theme/tokens.ts';

export function PostCard({ post, me, onChange, detail }: { post: Post; me: string; onChange: () => void; detail?: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(post);
  const [confirmDelete, setConfirmDelete] = useState(false);
  React.useEffect(() => setP(post), [post]);
  const img = photoUrl(p.photo_key);
  const openProfile = () => router.push({ pathname: '/perfil/[username]', params: { username: p.username } });
  const openPost = () => { if (!detail) router.push({ pathname: '/post/[id]', params: { id: p.id } }); };

  async function like() {
    const before = p;
    setP({ ...p, liked_by_me: !p.liked_by_me, likes: p.likes + (p.liked_by_me ? -1 : 1) }); // muda na hora
    try { await toggleLike(before, me); } catch { setP(before); }
  }

  return (
    <View style={{ backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
        <Pressable onPress={openProfile} accessibilityRole="link" accessibilityLabel={`Perfil de @${p.username}`}>
          <Avatar username={p.username} avatarKey={p.avatar_key} />
        </Pressable>
        <Pressable onPress={openProfile} style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>@{p.username}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {[p.author_car, ago(p.created_at)].filter(Boolean).join(' · ')}
          </Text>
        </Pressable>
        {p.crew_name && (
          <Text style={{ color: readableAccent(p.crew_color ?? colors.neon), fontFamily: fonts.mono, fontSize: 10,
                         borderWidth: 1, borderColor: readableAccent(p.crew_color ?? colors.neon), paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
            {p.crew_name.toUpperCase()}
          </Text>
        )}
      </View>

      <Pressable onPress={openPost} disabled={detail}>
        {!!p.body && <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21, paddingHorizontal: 12, paddingBottom: img ? 10 : 4 }}>{p.body}</Text>}
        {img && <Image source={{ uri: img }} style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.panelAlt }}
                       resizeMode="cover" accessibilityLabel={`Foto de @${p.username}`} />}
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
        <Action label={`${p.liked_by_me ? '♥' : '♡'} ${p.likes || ''}`} active={p.liked_by_me} onPress={like}
                a11y={p.liked_by_me ? 'Descurtir' : 'Curtir'} />
        <Action label={`💬 ${p.comments || ''}`} onPress={openPost} a11y="Comentários" />
        <Action label="↗" onPress={() => shareText(`@${p.username} no Marcha GPS: ${p.body}`)} a11y="Compartilhar" />
        <View style={{ flex: 1 }} />
        {p.mine && (confirmDelete ? (
          <>
            <Action label="Apagar mesmo" danger onPress={async () => { await deletePost(p.id).catch(() => {}); onChange(); }} a11y="Confirmar apagar" />
            <Action label="Não" onPress={() => setConfirmDelete(false)} a11y="Cancelar" />
          </>
        ) : <Action label="Apagar" onPress={() => setConfirmDelete(true)} a11y="Apagar post" />)}
      </View>
    </View>
  );
}

function Action({ label, onPress, active, danger, a11y }: { label: string; onPress: () => void; active?: boolean; danger?: boolean; a11y: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y}
               style={{ minHeight: 44, minWidth: 52, paddingHorizontal: 10, justifyContent: 'center' }}>
      <Text style={{ color: danger ? colors.danger : active ? colors.neon : colors.textDim, fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
