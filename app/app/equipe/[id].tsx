// Página da equipe: como uma página da cena, separada do perfil pessoal de quem fundou.
// Mostra nome, cidade, Instagram, fundador, membros verificados e os próximos eventos.
// Dados de crew_page() — o banco decide quais eventos aparecem (os só-da-equipe ficam pros membros).
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Body, Button, Card, Label, Mono, Screen } from '../../src/components/ui';
import { Avatar } from '../../src/components/Avatar';
import { db } from '../../src/lib/db';
import { readableAccent } from '../../src/lib/contrast.ts';
import { whenText } from '../../src/lib/events.ts';
import { colors } from '../../src/theme/tokens.ts';

interface Person { username: string; avatar_key: string | null; role?: string }
interface CrewPage {
  id: string; name: string; city: string; instagram: string | null; color: string; button_shape: string;
  created_at: string; status: string; founder: Person | null; members: Person[]; member_count: number;
  i_am_member: boolean; i_am_admin: boolean;
  events: { id: string; title: string; starts_at: string; ends_at: string }[];
}

const ROLE: Record<string, string> = { founder: 'FUNDADOR', admin: 'ADMIN', member: 'MEMBRO' };

export default function EquipePagina() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<CrewPage | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');

  useFocusEffect(useCallback(() => {
    if (!id) return;
    db.rpc('crew_page', { p_crew: id }).then(({ data }) => {
      if (!data) { setState('missing'); return; }
      setC(data as CrewPage); setState('ok');
    });
  }, [id]));

  if (state === 'loading') return <Screen><ActivityIndicator color={colors.neon} /></Screen>;
  if (state === 'missing' || !c) {
    return (
      <Screen>
        <Body>Essa equipe não existe ou não está disponível.</Body>
        <Button title="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const accent = readableAccent(c.color);
  const insta = c.instagram?.replace(/^@/, '').trim();
  const openProfile = (u: string) => router.push({ pathname: '/perfil/[username]', params: { username: u } });

  return (
    <Screen>
      <Card accent={accent} style={{ gap: 6 }}>
        <Mono color={accent}>EQUIPE · {c.city.toUpperCase()}{c.status === 'suspended' ? ' · SUSPENSA' : ''}</Mono>
        <Text style={{ color: accent, fontSize: 26, fontWeight: '800' }} accessibilityRole="header">{c.name}</Text>
        <Body dim>
          {c.member_count} {c.member_count === 1 ? 'membro verificado' : 'membros verificados'}
          {' · desde '}{new Date(c.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </Body>
        {insta ? (
          <Text style={{ color: colors.holo, fontWeight: '700', paddingVertical: 6 }} accessibilityRole="link"
                onPress={() => Linking.openURL(`https://instagram.com/${encodeURIComponent(insta)}`)}>@{insta} no Instagram ›</Text>
        ) : null}
        {c.i_am_member && <Mono color={accent}>VOCÊ FAZ PARTE</Mono>}
      </Card>

      {c.founder && (
        <>
          <Label>Fundador</Label>
          <Pressable onPress={() => openProfile(c.founder!.username)} accessibilityRole="link"
                     style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
            <Avatar username={c.founder.username} avatarKey={c.founder.avatar_key} size={44} ring={accent} />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>@{c.founder.username}</Text>
          </Pressable>
        </>
      )}

      <Label>Próximos eventos</Label>
      {c.events.length === 0 ? <Body dim>Nenhum evento marcado.</Body> : c.events.map((e) => (
        <Pressable key={e.id} onPress={() => router.push({ pathname: '/evento/[id]', params: { id: e.id } })} accessibilityRole="link">
          <Card>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{e.title}</Text>
            <Mono color={accent}>{whenText(new Date(e.starts_at)).toUpperCase()}</Mono>
          </Card>
        </Pressable>
      ))}

      <Label>Membros</Label>
      <View style={{ gap: 4 }}>
        {c.members.map((m) => (
          <Pressable key={m.username} onPress={() => openProfile(m.username)} accessibilityRole="link"
                     style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
            <Avatar username={m.username} avatarKey={m.avatar_key} size={36} />
            <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>@{m.username}</Text>
            <Mono color={m.role === 'member' ? colors.textDim : accent}>{ROLE[m.role ?? 'member']}</Mono>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
