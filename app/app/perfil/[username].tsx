// Perfil de alguém da cena: foto, @, carro montado na garagem e os posts.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, ErrorText, Screen } from '../../src/components/ui';
import { Avatar } from '../../src/components/Avatar';
import { CarMarker } from '../../src/components/CarMarker';
import { PostCard } from '../../src/components/PostCard';
import { db } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';
import { friendlyError } from '../../src/lib/errors.ts';
import { uploadPhoto } from '../../src/lib/photos';
import { loadFeed, type Post } from '../../src/lib/social';
import { colors, fonts } from '../../src/theme/tokens.ts';

interface PublicProfile {
  id: string; username: string; avatar_key: string | null; joined_at: string; posts: number; mine: boolean;
  car: { make: string; model: string; year: number | null; color: string; ride_height_cm: number; suspension: string;
         rim: number; neon: string | null; spoiler: boolean } | null;
}

const SUSP: Record<string, string> = { original: 'Original', fixa: 'Fixa', rosca: 'Rosca', ar: 'A ar' };

export default function Perfil() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { profile, refreshProfile } = useSession();
  const [p, setP] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!username) return;
    const { data } = await db.rpc('public_profile', { p_username: username }).maybeSingle();
    if (!data) { setMissing(true); return; }
    const pp = data as PublicProfile;
    setP(pp);
    setPosts(await loadFeed({ author: pp.id, limit: 30 }).catch(() => []));
  }, [username]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function changePhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (r.canceled || !r.assets[0]) return;
    setBusy(true); setError(null);
    try {
      const key = await uploadPhoto(r.assets[0].uri, 'post');
      const { error: e } = await db.rpc('set_my_avatar', { p_key: key });
      if (e) throw e;
      await refreshProfile();
      await load();
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: colors.holo, fontSize: 16 }}>‹ Voltar</Text>
      </Pressable>
      {missing && <Text style={{ color: colors.textMuted }}>Perfil não encontrado.</Text>}
      {!p && !missing && <ActivityIndicator color={colors.neon} />}
      {p && (
        <>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Avatar username={p.username} avatarKey={p.avatar_key} size={96} ring={colors.neon} />
            <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 26 }}>@{p.username}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              Na cena desde {new Date(p.joined_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} · {p.posts} {p.posts === 1 ? 'post' : 'posts'}
            </Text>
            {p.mine && <View style={{ width: 200 }}><Button title="Trocar foto" variant="secondary" onPress={changePhoto} loading={busy} /></View>}
            <ErrorText>{error}</ErrorText>
          </View>

          <View style={{ backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14,
                         flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {p.car ? (
              <>
                <CarMarker color={p.car.color} neon={p.car.neon} heading={0} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{p.car.make} {p.car.model}{p.car.year ? ` ${p.car.year}` : ''}</Text>
                  <Text style={{ color: colors.neon, fontFamily: fonts.mono, fontSize: 12 }}>
                    VÃO {p.car.ride_height_cm} CM · ARO {p.car.rim} · {SUSP[p.car.suspension] ?? p.car.suspension}{p.car.neon ? ` · NEON ${p.car.neon.toUpperCase()}` : ''}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={{ color: colors.textMuted, flex: 1 }}>{p.mine ? 'Você ainda não montou seu carro.' : 'Ainda não montou o carro.'}</Text>
            )}
          </View>
          {p.mine && <Button title={p.car ? 'Editar meu carro' : 'Montar meu carro'} variant="secondary" onPress={() => router.push('/(tabs)/garagem')} />}

          <Text style={{ color: colors.textMuted, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1 }}>POSTS</Text>
          {posts.length === 0 && <Text style={{ color: colors.textMuted }}>Nenhum post ainda.</Text>}
          {profile && posts.map((x) => <PostCard key={x.id} post={x} me={profile.id} onChange={load} />)}
        </>
      )}
    </Screen>
  );
}
