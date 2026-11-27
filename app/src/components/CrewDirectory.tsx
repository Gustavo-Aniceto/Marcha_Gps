// Descobrir equipes: cards com capa grande, foto da equipe por cima, nome, cidade, membros, fundador, bio e
// próximo evento (o que o fundador colocou na página). "Pedir pra entrar" abre a página da equipe já no
// pedido, pra pessoa poder mandar um recado pro fundador. Quem aprova é o fundador (ou admin/staff).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Body, Button } from './ui';
import { Icon, IconName } from './Icon';
import { CrewCover, CrewLogo } from './CrewArt';
import { photoUrl } from '../lib/photos';
import { whenText } from '../lib/events.ts';
import { readableAccent } from '../lib/contrast.ts';
import { colors, fonts } from '../theme/tokens.ts';

export interface DirCrew {
  id: string; name: string; city: string; color: string; avatar_key: string | null; cover_key: string | null;
  bio: string | null; instagram: string | null; founder: string | null; member_count: number;
  next_event: string | null; i_am_member: boolean; my_request: string | null;
}

const COVER_H = 132;
const LOGO = 70;

function Chip({ icon, text, color = colors.textDim }: { icon: IconName; text: string; color?: string }) {
  return (
    <View style={s.chip}>
      <Icon name={icon} size={14} color={color} />
      <Text style={{ color, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{text}</Text>
    </View>
  );
}

// onChanged fica pra quem usa recarregar a lista (o pedido em si acontece na página da equipe)
export function CrewDirectory({ crews }: { crews: DirCrew[]; onChanged?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const f = q.trim().toLowerCase();
  const shown = crews.filter((c) => !f || c.name.toLowerCase().includes(f) || c.city.toLowerCase().includes(f));

  return (
    <View style={{ gap: 14 }}>
      <View style={s.search}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar equipe ou cidade…" placeholderTextColor={colors.textMuted}
                   accessibilityLabel="Buscar equipe" style={{ flex: 1, color: colors.text, fontSize: 16, minHeight: 46 }} />
      </View>
      {shown.length === 0 && <Body dim>{crews.length ? 'Nenhuma equipe com esse nome.' : 'Nenhuma equipe liberada ainda.'}</Body>}
      {shown.map((c) => {
        const accent = readableAccent(c.color);
        const open = (ask = false) => router.push({ pathname: '/equipe/[id]', params: ask ? { id: c.id, pedir: '1' } : { id: c.id } });
        return (
          <View key={c.id} style={[s.card, { borderColor: c.i_am_member ? accent : colors.line }]}>
            <Pressable onPress={() => open()} accessibilityRole="link" accessibilityLabel={`Abrir página da equipe ${c.name}`}>
              <CrewCover name={c.name} color={c.color} accent={accent} uri={photoUrl(c.cover_key)} height={COVER_H} fontSize={44} />
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 14, marginTop: -LOGO / 2 }}>
                <CrewLogo name={c.name} accent={accent} uri={photoUrl(c.avatar_key)} size={LOGO} />
                <View style={{ flex: 1, paddingBottom: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }} numberOfLines={1}>{c.name}</Text>
                  {c.founder ? <Text style={s.meta} numberOfLines={1}>fundada por @{c.founder}</Text> : null}
                </View>
              </View>
              <View style={{ padding: 14, paddingTop: 10, gap: 10 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Chip icon="pin" text={c.city} />
                  <Chip icon="users" text={`${c.member_count} ${c.member_count === 1 ? 'membro' : 'membros'}`} />
                  {c.next_event ? <Chip icon="calendar" text={whenText(new Date(c.next_event))} color={accent} /> : null}
                </View>
                {c.bio ? <Text style={{ color: colors.textDim, lineHeight: 20 }} numberOfLines={3}>{c.bio}</Text> : null}
              </View>
            </Pressable>
            <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
              {c.i_am_member ? (
                <View style={[s.status, { borderColor: accent }]}>
                  <Icon name="check" size={16} color={accent} />
                  <Text style={[s.tag, { color: accent }]}>VOCÊ FAZ PARTE</Text>
                </View>
              ) : c.my_request === 'pending' ? (
                <View style={s.status}>
                  <Icon name="clock" size={16} color={colors.textDim} />
                  <Text style={[s.tag, { color: colors.textDim }]}>PEDIDO ENVIADO · ESPERANDO O FUNDADOR</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button title="Ver página" variant="secondary" onPress={() => open()} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="Pedir pra entrar" color={c.color} onPress={() => open(true)} />
                  </View>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.line,
            backgroundColor: colors.panel, paddingHorizontal: 16 },
  card: { borderRadius: 20, borderWidth: 1, backgroundColor: colors.panel, overflow: 'hidden' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: colors.panelAlt,
          paddingHorizontal: 10, paddingVertical: 6, maxWidth: '100%' },
  meta: { color: colors.textMuted, fontSize: 13 },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, borderWidth: 1,
            borderColor: colors.line, minHeight: 44 },
  tag: { fontFamily: fonts.mono, fontSize: 12 },
});
