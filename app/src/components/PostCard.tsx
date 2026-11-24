// Post do feed: autor (foto, @, carro), texto, foto, curtir, comentar, compartilhar, apagar.
import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from './Avatar';
import { photoUrl } from '../lib/photos';
import { ago, deletePost, toggleLike, votePoll, type Poll, type Post } from '../lib/social';
import { pollPercents } from '../lib/poll.ts';
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
            {[p.kind === 'carro' ? 'foto do carro' : p.kind === 'enquete' ? 'enquete' : null, p.author_car, ago(p.created_at)].filter(Boolean).join(' · ')}
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
      {p.kind === 'enquete' && p.poll && (
        <PollBox poll={p.poll} mine={p.mine} onVote={async (idx) => {
          const before = p.poll!;
          // muda na hora; se der erro, volta
          const opts = before.options.map((o) => ({ ...o, votes: o.votes - (before.my_vote === o.idx ? 1 : 0) + (o.idx === idx ? 1 : 0) }));
          setP({ ...p, poll: { options: opts, total: before.total + (before.my_vote == null ? 1 : 0), my_vote: idx } });
          try { const fresh = await votePoll(p.id, idx); setP((cur) => ({ ...cur, poll: fresh })); }
          catch { setP((cur) => ({ ...cur, poll: before })); }
        }} />
      )}

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

function PollBox({ poll, mine, onVote }: { poll: Poll; mine: boolean; onVote: (idx: number) => void }) {
  const show = poll.my_vote != null || mine; // resultado aparece depois de votar (o autor sempre vê)
  const pct = pollPercents(poll.options);
  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 6, gap: 8 }}>
      {poll.options.map((o, i) => {
        const chosen = poll.my_vote === o.idx;
        return (
          <Pressable key={o.idx} onPress={() => onVote(o.idx)} accessibilityRole="button"
                     accessibilityState={{ selected: chosen }}
                     accessibilityLabel={`${o.label}${show ? `, ${pct[i]} por cento` : ''}${chosen ? ', seu voto' : ''}`}
                     style={{ minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: chosen ? colors.neon : colors.lineStrong,
                              overflow: 'hidden', justifyContent: 'center' }}>
            {show && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct[i]}%`,
                                    backgroundColor: chosen ? 'rgba(198,255,61,0.22)' : 'rgba(156,200,255,0.14)' }} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 }}>
              <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: chosen ? '700' : '500' }}>{chosen ? '✓ ' : ''}{o.label}</Text>
              {show && <Text style={{ color: chosen ? colors.neon : colors.textDim, fontFamily: fonts.mono, fontSize: 13 }}>{pct[i]}%</Text>}
            </View>
          </Pressable>
        );
      })}
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        {poll.total} {poll.total === 1 ? 'voto' : 'votos'}{poll.my_vote == null ? ' · toque pra votar' : ' · toque em outra pra trocar'}
      </Text>
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
