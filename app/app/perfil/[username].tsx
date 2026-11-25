// Perfil de alguém da cena: foto, @, carro montado na garagem e o mural (posts, fotos do carro, enquetes).
// No próprio perfil dá pra postar direto: post, foto do carro ou enquete.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, ErrorText, Pills, Screen } from '../../src/components/ui';
import { Composer } from '../../src/components/Composer';
import { Avatar } from '../../src/components/Avatar';
import { CarMarker } from '../../src/components/CarMarker';
import { PostCard } from '../../src/components/PostCard';
import { db } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';
import { friendlyError } from '../../src/lib/errors.ts';
import { photoUrl, uploadPhoto } from '../../src/lib/photos';
import { loadFeed, type Post, type PostKind } from '../../src/lib/social';
import { readableAccent } from '../../src/lib/contrast.ts';
import { colors, fonts } from '../../src/theme/tokens.ts';
import { goBack } from '../../src/lib/goBack';

interface PublicProfile {
  id: string; username: string; avatar_key: string | null; joined_at: string; posts: number; mine: boolean;
  car: { make: string; model: string; year: number | null; color: string; ride_height_cm: number; suspension: string;
         body_type?: string; tint?: string;
         rim: number; neon: string | null; spoiler: boolean } | null;
}

interface ProfileCrew { crew_id: string; name: string; color: string; role: string }
interface GarageCar { id: string; make: string; model: string; year: number | null; color: string; body_type: string;
                      tint: string; spoiler: boolean; neon: string | null; is_active: boolean }

const SUSP: Record<string, string> = { original: 'Original', fixa: 'Fixa', rosca: 'Rosca', ar: 'A ar' };

type Tab = 'tudo' | PostKind;
const TABS: { value: Tab; label: string }[] = [
  { value: 'tudo', label: 'Tudo' },
  { value: 'carro', label: 'Fotos do carro' },
  { value: 'enquete', label: 'Enquetes' },
];

export default function Perfil() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { profile, refreshProfile } = useSession();
  const [p, setP] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('tudo');
  const [crews, setCrews] = useState<ProfileCrew[]>([]);
  const [garage, setGarage] = useState<GarageCar[]>([]);

  const load = useCallback(async () => {
    if (!username) return;
    const { data } = await db.rpc('public_profile', { p_username: username }).maybeSingle();
    if (!data) { setMissing(true); return; }
    const pp = data as PublicProfile;
    setP(pp);
    // equipes (cada uma tem a sua página) e os outros carros da garagem
    db.rpc('profile_crews', { p_username: username }).then(({ data: c }) => setCrews((c ?? []) as ProfileCrew[]));
    db.rpc('profile_garage', { p_username: username }).then(({ data: g }) => setGarage((g ?? []) as GarageCar[]));
    setPosts(await loadFeed({ author: pp.id, limit: 60, kind: tab === 'tudo' ? null : tab }).catch(() => []));
  }, [username, tab]);

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
      <Pressable onPress={() => goBack(router)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
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
            {crews.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {crews.map((c) => (
                  <Pressable key={c.crew_id} accessibilityRole="link" accessibilityLabel={`Página da equipe ${c.name}`}
                             onPress={() => router.push({ pathname: '/equipe/[id]', params: { id: c.crew_id } })}
                             style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, justifyContent: 'center',
                                      borderColor: readableAccent(c.color) }}>
                    <Text style={{ color: readableAccent(c.color), fontWeight: '700' }}>
                      {c.role === 'founder' ? '★ ' : ''}{c.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={{ backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14,
                         flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {p.car ? (
              <>
                <CarMarker color={p.car.color} neon={p.car.neon} heading={0} body={p.car.body_type} tint={p.car.tint} spoiler={p.car.spoiler} size={96} />
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
          {garage.length > 1 && (
            <>
              <Text style={{ color: colors.textDim, fontWeight: '700' }}>Garagem ({garage.length} carros)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {garage.filter((g) => !g.is_active).map((g) => (
                  <View key={g.id} style={{ width: '31%', alignItems: 'center', padding: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel }}>
                    <CarMarker color={g.color} neon={g.neon} heading={0} body={g.body_type} tint={g.tint} spoiler={g.spoiler} size={56} />
                    <Text style={{ color: colors.textDim, fontSize: 12, textAlign: 'center' }} numberOfLines={2}>{g.make} {g.model}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          {p.mine && <Button title={p.car ? 'Editar meu carro' : 'Montar meu carro'} variant="secondary" onPress={() => router.push('/(tabs)/garagem')} />}

          {p.mine && <Composer onPosted={load} initialMode={tab === 'tudo' ? 'post' : tab} key={`composer-${tab}`} />}

          <Pills options={TABS} value={tab} onChange={setTab} />
          {posts.length === 0 && (
            <Text style={{ color: colors.textMuted }}>
              {tab === 'carro' ? 'Nenhuma foto do carro ainda.' : tab === 'enquete' ? 'Nenhuma enquete ainda.' : 'Nenhum post ainda.'}
            </Text>
          )}
          {tab === 'carro' ? (
            // fotos do carro em grade (toque abre o post com curtidas e comentários)
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {posts.map((x) => (
                <Pressable key={x.id} onPress={() => router.push({ pathname: '/post/[id]', params: { id: x.id } })}
                           accessibilityRole="imagebutton" accessibilityLabel={`Foto do carro: ${x.body}`}
                           style={{ width: '32.5%', aspectRatio: 1, backgroundColor: colors.panelAlt, borderRadius: 4, overflow: 'hidden' }}>
                  {photoUrl(x.photo_key) && <Image source={{ uri: photoUrl(x.photo_key)! }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />}
                </Pressable>
              ))}
            </View>
          ) : (
            profile && posts.map((x) => <PostCard key={x.id} post={x} me={profile.id} onChange={load} />)
          )}
        </>
      )}
    </Screen>
  );
}
