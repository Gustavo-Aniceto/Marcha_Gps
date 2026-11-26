// Números do app (só Adm Master): quem entrou, quem está usando, avisos do Radar, social e as
// equipes mais ativas. Tudo vem de master_stats() (o banco recusa quem não é master).
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Body, Card, ErrorText, Label, Mono, Screen, Title } from '../src/components/ui';
import { db } from '../src/lib/db';
import { friendlyError } from '../src/lib/errors.ts';
import { readableAccent } from '../src/lib/contrast.ts';
import { colors, fonts } from '../src/theme/tokens.ts';

interface Stats {
  people: { total: number; new_7d: number; new_30d: number; active_1d: number; active_7d: number; active_30d: number;
            on_map_now: number; verified: number; with_car: number; push: number };
  signups_14d: { day: string; n: number }[];
  crews: { active: number; pending_requests: number };
  radar: { reports_7d: number; confirmed_7d: number; active_total: number };
  social: { posts_7d: number; comments_7d: number; events_upcoming: number; convoys_7d: number; open_reports: number };
  top_crews: { id: string; name: string; color: string; members: number; posts: number; events: number; checkins: number;
               convoys: number; joins: number; score: number }[];
  at: string;
}

const n = (v: number) => v.toLocaleString('pt-BR');

function Big({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.line,
                   backgroundColor: colors.panel, gap: 2 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: colors.text, fontFamily: fonts.display, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>{n(value)}</Text>
      {!!hint && <Text style={{ color: colors.textDim, fontSize: 12 }}>{hint}</Text>}
    </View>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 30, alignItems: 'center' }}>
      <Text style={{ color: colors.textDim }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{n(value)}</Text>
    </View>
  );
}

export default function Numeros() {
  const router = useRouter();
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    db.rpc('master_stats').then(({ data, error: e }) => {
      if (e) setError(e.message.includes('forbidden') ? 'Só o Adm Master vê os números.' : friendlyError(e));
      else setS(data as Stats);
    });
  }, []));

  if (!s) {
    return (
      <Screen>
        <Title back="/conta">Números do app</Title>
        {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.neon} />}
      </Screen>
    );
  }

  const max = Math.max(1, ...s.signups_14d.map((d) => d.n));
  const total14 = s.signups_14d.reduce((a, d) => a + d.n, 0);
  return (
    <Screen>
      <Title back="/conta" sub={`Atualizado ${new Date(s.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}>Números do app</Title>

      <Label>Pessoas</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Big label="Na conta" value={s.people.total} hint={`+${n(s.people.new_7d)} na semana`} />
        <Big label="Usaram na semana" value={s.people.active_7d} hint={`${n(s.people.active_1d)} hoje`} />
        <Big label="No mapa agora" value={s.people.on_map_now} hint="mandando posição" />
        <Big label="Verificados" value={s.people.verified} hint={`${n(s.people.with_car)} com carro`} />
      </View>

      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Label>Cadastros nos últimos 14 dias</Label>
          <Mono>{n(total14)}</Mono>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 90 }}
              accessibilityLabel={`Cadastros por dia: ${s.signups_14d.map((d) => d.n).join(', ')}`}>
          {s.signups_14d.map((d) => (
            <View key={d.day} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <View style={{ width: '100%', height: `${Math.max(4, (d.n / max) * 100)}%`, borderRadius: 4,
                             backgroundColor: d.n ? colors.neon : colors.lineStrong }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>{new Date(s.signups_14d[0].day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>hoje</Text>
        </View>
      </Card>

      <Card style={{ gap: 0 }}>
        <Label>Uso</Label>
        <Line label="Usaram no mês" value={s.people.active_30d} />
        <Line label="Entraram no mês" value={s.people.new_30d} />
        <Line label="Com notificação no celular" value={s.people.push} />
      </Card>

      <Card style={{ gap: 0 }}>
        <Label>Radar (avisos da galera)</Label>
        <Line label="Avisos na semana" value={s.radar.reports_7d} />
        <Line label="Confirmados na semana" value={s.radar.confirmed_7d} />
        <Line label="No mapa agora (com oficiais)" value={s.radar.active_total} />
      </Card>

      <Card style={{ gap: 0 }}>
        <Label>Comunidade</Label>
        <Line label="Equipes ativas" value={s.crews.active} />
        <Line label="Equipes esperando aprovação" value={s.crews.pending_requests} />
        <Line label="Posts na semana" value={s.social.posts_7d} />
        <Line label="Comentários na semana" value={s.social.comments_7d} />
        <Line label="Eventos marcados" value={s.social.events_upcoming} />
        <Line label="Comboios na semana" value={s.social.convoys_7d} />
        <Line label="Denúncias abertas" value={s.social.open_reports} />
      </Card>

      <Label>Equipes mais ativas (30 dias)</Label>
      {s.top_crews.length === 0 && <Body dim>Nenhuma equipe ainda.</Body>}
      {s.top_crews.map((c, i) => (
        <Pressable key={c.id} accessibilityRole="link" onPress={() => router.push({ pathname: '/equipe/[id]', params: { id: c.id } })}
                   style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20,
                                              borderWidth: 1, borderColor: colors.line, backgroundColor: pressed ? colors.panelAlt : colors.panel })}>
          <Text style={{ color: readableAccent(c.color), fontFamily: fonts.display, fontWeight: '800', fontSize: 20, width: 26 }}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{c.name}</Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>
              {c.members} membros · {c.posts} posts · {c.events} eventos · {c.checkins} check-ins · {c.convoys} comboios · {c.joins} novos
            </Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
