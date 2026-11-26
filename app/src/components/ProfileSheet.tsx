// Cartão que sobe quando alguém toca num carrinho no mapa (Cena ao vivo ou GPS): quem é a pessoa,
// o carrinho que ela montou (pela IA ou na mão), fotos reais do carro e o botão pro perfil completo.
// Os dados vêm de public_profile() — o banco decide o que pode aparecer.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '../lib/db';
import { photoUrl } from '../lib/photos';
import { ago } from '../lib/social';
import { Avatar } from './Avatar';
import { CarMarker } from './CarMarker';
import { colors, fonts } from '../theme/tokens.ts';

export interface SheetCar {
  make?: string; model?: string; year?: number | null; color?: string; neon?: string | null;
  spoiler?: boolean | null; body_type?: string | null; tint?: string | null;
  ride_height_cm?: number; rim?: number; photos?: string[] | null;
}
interface PublicProfile { id: string; username: string; avatar_key: string | null; car: SheetCar | null; posts: number; mine: boolean }

export function ProfileSheet({ username, car: fallbackCar, status, statusHighlight, updatedAt, onClose, bottom = 20 }: {
  username: string;
  car?: SheetCar | null;        // o que o mapa já tem (mostra na hora, antes do perfil carregar)
  status?: string;              // ex.: "SUA EQUIPE · POSIÇÃO EXATA"
  statusHighlight?: boolean;
  updatedAt?: string | null;
  onClose: () => void;
  bottom?: number;
}) {
  const router = useRouter();
  const [p, setP] = useState<PublicProfile | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'erro'>('loading');

  useEffect(() => {
    let alive = true;
    setState('loading'); setP(null);
    db.rpc('public_profile', { p_username: username }).maybeSingle().then(({ data, error }) => {
      if (!alive) return;
      if (error || !data) { setState('erro'); return; }
      setP(data as PublicProfile); setState('ok');
    });
    return () => { alive = false; };
  }, [username]);

  const car = p?.car ?? fallbackCar ?? null;
  const photos = (p?.car?.photos ?? []).map(photoUrl).filter((u): u is string => !!u);
  const carName = car?.make ? `${car.make} ${car.model ?? ''}${car.year ? ` ${car.year}` : ''}`.trim() : null;
  const details = car ? [car.ride_height_cm ? `${car.ride_height_cm} cm do chão` : null, car.rim ? `aro ${car.rim}` : null]
    .filter(Boolean).join(' · ') : '';
  const open = () => { onClose(); router.push({ pathname: '/perfil/[username]', params: { username } }); };

  return (
    <View style={[s.sheet, { bottom }]} accessibilityViewIsModal>
      <View style={s.head}>
        <Avatar username={username} avatarKey={p?.avatar_key} size={48} ring={statusHighlight ? colors.neon : undefined} />
        <View style={{ flex: 1 }}>
          <Text style={s.user} numberOfLines={1}>@{username}{p?.mine ? ' · você' : ''}</Text>
          {status ? <Text style={[s.mono, statusHighlight && { color: colors.neon }]} numberOfLines={1}>{status}</Text> : null}
          {updatedAt ? <Text style={s.dim}>visto {ago(updatedAt)}</Text> : null}
        </View>
        <Pressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={8}>
          <Text style={{ color: colors.holo, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>

      <View style={s.carRow}>
        <View style={s.carBox}>
          <CarMarker size={96} color={car?.color} neon={car?.neon} body={car?.body_type} tint={car?.tint}
                     spoiler={car?.spoiler} heading={0} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.carName}>{carName ?? 'Carro ainda não montado'}</Text>
          {details ? <Text style={s.dim}>{details}</Text> : null}
          {p ? <Text style={s.dim}>{p.posts} {p.posts === 1 ? 'postagem' : 'postagens'}</Text> : null}
          {state === 'loading' && <ActivityIndicator color={colors.holo} style={{ alignSelf: 'flex-start', marginTop: 4 }} />}
          {state === 'erro' && <Text style={s.dim}>Não deu pra abrir o perfil agora.</Text>}
        </View>
      </View>

      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {photos.map((u) => <Image key={u} source={{ uri: u }} style={s.photo} accessibilityLabel={`Foto do carro de @${username}`} />)}
        </ScrollView>
      )}

      <Pressable onPress={open} style={s.button} accessibilityRole="link">
        <Text style={s.buttonText}>Ver perfil completo</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: { position: 'absolute', left: 12, right: 12, padding: 14, gap: 12, borderRadius: 16, zIndex: 50,
           backgroundColor: 'rgba(6,12,22,0.97)', borderWidth: 1, borderColor: colors.lineStrong, maxWidth: 520, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  user: { color: colors.text, fontSize: 17, fontWeight: '700' },
  mono: { fontFamily: fonts.mono, fontSize: 11, color: colors.holo, letterSpacing: 0.6 },
  dim: { color: colors.textDim, fontSize: 13 },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.lineStrong },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  carBox: { width: 104, height: 120, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.panelAlt },
  carName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  photo: { width: 120, height: 84, borderRadius: 14, backgroundColor: colors.panelAlt },
  button: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neon },
  buttonText: { color: colors.ink, fontWeight: '800', fontSize: 15 },
});
