// Ranks: interno de cada equipe (só a equipe vê) e Radar geral (avisos confirmados).
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Body, Card, Mono, Pills, Screen, Title } from '../../src/components/ui';
import { db } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';
import { readableAccent } from '../../src/lib/contrast.ts';
import { colors } from '../../src/theme/tokens.ts';

interface Crew { id: string; name: string; color: string }
interface Row { rank_pos: number; username: string; xp?: number; points?: number; confirmed_reports?: number }

export default function Ranks() {
  const { profile } = useSession();
  const [tab, setTab] = useState<'equipe' | 'geral'>('equipe');
  const [crews, setCrews] = useState<Crew[]>([]);
  const [crewId, setCrewId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useFocusEffect(useCallback(() => {
    if (!profile) return;
    db.from('crew_members').select('crews(id, name, color)').eq('user_id', profile.id).eq('status', 'verified')
      .then(({ data }) => {
        const list = (data ?? []).map((r: any) => r.crews).filter(Boolean) as Crew[];
        setCrews(list);
        setCrewId((cur) => cur ?? list[0]?.id ?? null);
      });
  }, [profile]));

  useFocusEffect(useCallback(() => {
    const q = tab === 'geral'
      ? db.rpc('radar_leaderboard', { p_limit: 50 })
      : crewId ? db.rpc('crew_leaderboard', { p_crew: crewId }) : null;
    if (!q) { setRows([]); return; }
    q.then(({ data }) => setRows((data ?? []) as Row[]));
  }, [tab, crewId]));

  const crew = crews.find((c) => c.id === crewId);
  const accent = tab === 'equipe' && crew ? readableAccent(crew.color) : colors.warn;

  return (
    <Screen>
      <Title>Ranks</Title>
      <Pills options={[{ value: 'equipe', label: 'Minha equipe' }, { value: 'geral', label: 'Radar · geral' }]}
             value={tab} onChange={(v) => setTab(v as 'equipe' | 'geral')} />

      {tab === 'equipe' && (
        crews.length === 0
          ? <Body dim>Quando você for verificado numa equipe, o rank interno dela aparece aqui.</Body>
          : <>
              <Pills options={crews.map((c) => ({ value: c.id, label: c.name }))} value={crewId ?? ''} onChange={setCrewId} />
              <Body dim>Ranking interno: só a {crew?.name} vê. Não existe disputa entre equipes.</Body>
            </>
      )}
      {tab === 'geral' && <Body dim>Soma de todo mundo em SP, Guarulhos e Itaquá. Só conta aviso confirmado por 3 pessoas.</Body>}

      {rows.map((r) => {
        const me = r.username === profile?.username;
        return (
          <Card key={r.username} accent={me ? accent : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ width: 28, color: r.rank_pos <= 3 ? colors.target : colors.textMuted, fontSize: 18, fontWeight: '700' }}>{r.rank_pos}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{me ? 'Você' : `@${r.username}`}</Text>
              {r.confirmed_reports != null && <Text style={{ color: colors.textMuted, fontSize: 12 }}>{r.confirmed_reports} avisos confirmados</Text>}
            </View>
            <Mono color={accent}>{tab === 'geral' ? `${r.points} PTS` : `${r.xp} XP`}</Mono>
          </Card>
        );
      })}
    </Screen>
  );
}
