// Descobrir equipes: cards com capa, foto, bio, fundador, cidade, membros e próximo evento (o que o fundador
// colocou na página da equipe). Botão pra pedir pra entrar; quem aprova é o fundador.
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Body, Button, ErrorText } from './ui';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { db } from '../lib/db';
import { friendlyError } from '../lib/errors.ts';
import { photoUrl } from '../lib/photos';
import { whenText } from '../lib/events.ts';
import { readableAccent } from '../lib/contrast.ts';
import { colors, fonts } from '../theme/tokens.ts';

export interface DirCrew {
  id: string; name: string; city: string; color: string; avatar_key: string | null; cover_key: string | null;
  bio: string | null; instagram: string | null; founder: string | null; member_count: number;
  next_event: string | null; i_am_member: boolean; my_request: string | null;
}

export function CrewDirectory({ crews, onChanged }: { crews: DirCrew[]; onChanged: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const f = q.trim().toLowerCase();
  const shown = crews.filter((c) => !f || c.name.toLowerCase().includes(f) || c.city.toLowerCase().includes(f));

  async function ask(c: DirCrew) {
    setBusy(c.id); setError(null);
    const { error: e } = await db.rpc('request_join_crew', { p_crew: c.id, p_message: null });
    setBusy(null);
    if (e) setError(friendlyError(e)); else onChanged();
  }

  return (
    <View style={{ gap: 12 }}>
      <TextInput value={q} onChangeText={setQ} placeholder="Buscar equipe ou cidade…" placeholderTextColor={colors.textMuted}
                 accessibilityLabel="Buscar equipe" style={s.search} />
      <ErrorText>{error}</ErrorText>
      {shown.length === 0 && <Body dim>{crews.length ? 'Nenhuma equipe com esse nome.' : 'Nenhuma equipe liberada ainda.'}</Body>}
      {shown.map((c) => {
        const accent = readableAccent(c.color);
        const cover = photoUrl(c.cover_key);
        const open = () => router.push({ pathname: '/equipe/[id]', params: { id: c.id } });
        return (
          <View key={c.id} style={[s.card, { borderColor: c.i_am_member ? accent : colors.line }]}>
            <Pressable onPress={open} accessibilityRole="link" accessibilityLabel={`Abrir página da equipe ${c.name}`}>
              <View style={s.cover}>
                {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={`Capa da ${c.name}`} />
                  : (
                    <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', overflow: 'hidden' }]}>
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.color, opacity: 0.16 }]} />
                      <Text style={{ width: 1400, color: accent, opacity: 0.2, fontSize: 46, fontWeight: '900', marginLeft: 10,
                                     transform: [{ rotate: '-6deg' }] }}>{c.name.toUpperCase()}</Text>
                    </View>
                  )}
              </View>
              <View style={{ paddingHorizontal: 14, marginTop: -30 }}>
                <Avatar username={c.name} avatarKey={c.avatar_key} size={60} ring={accent} />
              </View>
              <View style={{ padding: 14, paddingTop: 8, gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>{c.name}</Text>
                <Text style={s.meta}>{c.city} · {c.member_count} {c.member_count === 1 ? 'membro' : 'membros'}
                  {c.founder ? ` · fundada por @${c.founder}` : ''}</Text>
                {c.instagram ? <Text style={[s.meta, { color: colors.holo }]}>{c.instagram}</Text> : null}
                {c.bio ? <Text style={{ color: colors.textDim }} numberOfLines={3}>{c.bio}</Text> : null}
                {c.next_event ? <Text style={[s.meta, { color: accent, fontWeight: '700' }]}>Próximo evento: {whenText(new Date(c.next_event))}</Text> : null}
              </View>
            </Pressable>
            <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
              {c.i_am_member ? <Text style={[s.tag, { color: accent }]}>VOCÊ FAZ PARTE</Text>
                : c.my_request === 'pending' ? <Text style={[s.tag, { color: colors.textDim }]}>PEDIDO ENVIADO · O FUNDADOR RESPONDE</Text>
                : <Button title="Pedir pra entrar" color={c.color} loading={busy === c.id} onPress={() => ask(c)} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  search: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel,
            color: colors.text, paddingHorizontal: 14, fontSize: 16 },
  card: { borderRadius: 18, borderWidth: 1, backgroundColor: colors.panel, overflow: 'hidden' },
  cover: { height: 110, backgroundColor: colors.panelAlt },
  meta: { color: colors.textMuted, fontSize: 13 },
  tag: { fontFamily: fonts.mono, fontSize: 12, textAlign: 'center', paddingVertical: 10 },
});
