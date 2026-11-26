// Moderação (só Adm Master): denúncias pra decidir e a saúde do app (serviços no ar e erros que o app mandou).
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Body, Button, Card, ErrorText, Pills, Screen, Title } from '../src/components/ui';
import { Icon } from '../src/components/Icon';
import { db } from '../src/lib/db';
import { useSession } from '../src/lib/session';
import { friendlyError } from '../src/lib/errors.ts';
import { photoUrl } from '../src/lib/photos';
import { ago } from '../src/lib/social';
import { SERVICE_NAME, TARGET_NAME, reasonLabel, type Health, type ModerationItem } from '../src/lib/moderation.ts';
import { colors, fonts } from '../src/theme/tokens.ts';

type Tab = 'abertas' | 'resolvidas' | 'saude';

export default function Moderacao() {
  const { profile } = useSession();
  const [tab, setTab] = useState<Tab>('abertas');
  const [items, setItems] = useState<ModerationItem[] | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    if (tab === 'saude') {
      const { data, error: e } = await db.rpc('master_health');
      if (e) setError(friendlyError(e)); else setHealth(data as Health);
    } else {
      setItems(null);
      const { data, error: e } = await db.rpc('master_reports', { p_status: tab === 'abertas' ? 'open' : 'removed' });
      if (e) setError(friendlyError(e)); else setItems((data ?? []) as ModerationItem[]);
    }
  }, [tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!profile?.is_master) {
    return <Screen><Title back>Moderação</Title><Body dim>Só o Adm Master vê essa tela.</Body></Screen>;
  }

  return (
    <Screen>
      <Title back sub="Denúncias e saúde do app">Moderação</Title>
      <Pills<Tab> options={[{ value: 'abertas', label: 'Denúncias' }, { value: 'resolvidas', label: 'Removidas' }, { value: 'saude', label: 'Saúde do app' }]}
                  value={tab} onChange={setTab} />
      <ErrorText>{error}</ErrorText>
      {tab === 'saude' ? <HealthView h={health} /> : (
        items === null ? <ActivityIndicator color={colors.neon} /> : items.length === 0 ? (
          <Card><Body dim>{tab === 'abertas' ? 'Nenhuma denúncia esperando.' : 'Nada removido ainda.'}</Body></Card>
        ) : items.map((it) => <ReportCard key={`${it.target_type}:${it.target_id}`} it={it} open={tab === 'abertas'} onDone={load} />)
      )}
    </Screen>
  );
}

function ReportCard({ it, open, onDone }: { it: ModerationItem; open: boolean; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | 'manter' | 'remover'>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const img = photoUrl(it.photo_key);

  async function decide(action: 'manter' | 'remover') {
    setBusy(action); setError(null);
    const { error: e } = await db.rpc('resolve_report', { p_type: it.target_type, p_id: it.target_id, p_action: action });
    setBusy(null);
    if (e) { setError(friendlyError(e)); return; }
    onDone();
  }

  const removeLabel = it.target_type === 'profile' ? 'Tirar foto e bio' : it.target_type === 'aviso' ? 'Tirar do Radar' : 'Remover';
  return (
    <Card accent={it.hidden ? colors.warn : undefined} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="shield" size={18} color={colors.warn} />
        <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>
          {TARGET_NAME[it.target_type][0].toUpperCase() + TARGET_NAME[it.target_type].slice(1)}
          {it.owner_username ? ` de @${it.owner_username}` : ''}
        </Text>
        <Text style={{ color: colors.warn, fontFamily: fonts.mono, fontSize: 12 }}>
          {it.reports} {it.reports === 1 ? 'denúncia' : 'denúncias'}
        </Text>
      </View>
      {it.hidden && <Text style={{ color: colors.warn, fontSize: 12, fontWeight: '700' }}>Escondido até você decidir (3+ pessoas denunciaram)</Text>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {img && <Image source={{ uri: img }} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.panelAlt }} />}
        <Text style={{ color: colors.textDim, flex: 1 }} numberOfLines={6}>{it.preview || '(sem texto)'}</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 13 }}>
        <Text style={{ color: colors.textMuted }}>Motivo: </Text>{it.reasons.map(reasonLabel).join(', ')}
      </Text>
      {it.notes.slice(0, 3).map((n, i) => (
        <Text key={i} style={{ color: colors.textDim, fontSize: 13, fontStyle: 'italic' }}>“{n}”</Text>
      ))}
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Última há {ago(it.last_at)}</Text>
      {it.link && (
        <Pressable onPress={() => router.push(it.link as never)} accessibilityRole="link" style={{ minHeight: 36, justifyContent: 'center' }}>
          <Text style={{ color: colors.holo, fontWeight: '700' }}>Abrir no app ›</Text>
        </Pressable>
      )}
      <ErrorText>{error}</ErrorText>
      {open && (confirm ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text }}>{it.target_type === 'post' || it.target_type === 'comment' ? 'Apaga de vez e avisa a pessoa.' : 'A pessoa é avisada.'}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button title={removeLabel} color={colors.danger} onPress={() => decide('remover')} loading={busy === 'remover'} /></View>
            <View style={{ flex: 1 }}><Button title="Voltar" variant="secondary" onPress={() => setConfirm(false)} /></View>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button title="Manter" variant="secondary" onPress={() => decide('manter')} loading={busy === 'manter'} /></View>
          <View style={{ flex: 1 }}><Button title={removeLabel} variant="warn" onPress={() => setConfirm(true)} /></View>
        </View>
      ))}
    </Card>
  );
}

function HealthView({ h }: { h: Health | null }) {
  const [openErr, setOpenErr] = useState<number | null>(null);
  if (!h) return <ActivityIndicator color={colors.neon} />;
  const down = h.services.filter((x) => !x.ok);
  return (
    <View style={{ gap: 12 }}>
      <Card accent={down.length ? colors.danger : colors.ok} style={{ gap: 4 }}>
        <Text style={{ color: down.length ? colors.danger : colors.ok, fontSize: 18, fontWeight: '800' }}>
          {h.services.length === 0 ? 'Ainda sem checagem' : down.length ? `${down.length} serviço(s) fora do ar` : 'Tudo no ar'}
        </Text>
        <Body dim>{h.errors_24h} {h.errors_24h === 1 ? 'erro' : 'erros'} no app nas últimas 24 h. A checagem roda de hora em hora; quando algo cai ou volta, você recebe uma notificação.</Body>
      </Card>

      <Card style={{ gap: 0, paddingVertical: 6 }}>
        {h.services.map((x, i) => (
          <View key={x.service} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52,
                                         borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: x.ok ? colors.ok : colors.danger }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{SERVICE_NAME[x.service] ?? x.service}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {x.ok ? `no ar${x.ms != null ? ` · ${x.ms} ms` : ''}` : `fora: ${x.detail ?? 'sem resposta'}`} · checado há {ago(x.checked_at)}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <Text style={{ color: colors.textDim, fontWeight: '700' }}>Erros no app (7 dias)</Text>
      {h.errors.length === 0 ? <Body dim>Nenhum erro registrado.</Body> : h.errors.map((e, i) => (
        <Pressable key={i} onPress={() => setOpenErr(openErr === i ? null : i)} accessibilityRole="button"
                   style={{ backgroundColor: colors.panel, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={openErr === i ? undefined : 2}>{e.message}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {e.hits}× · {e.people} {e.people === 1 ? 'pessoa' : 'pessoas'} · {e.screen ?? 'tela ?'} · versão {e.version ?? '?'} · última há {ago(e.last_at)}
          </Text>
          {openErr === i && (
            <>
              {e.user_agent ? <Text style={{ color: colors.textMuted, fontSize: 11 }}>{e.user_agent}</Text> : null}
              {e.stack ? <Text style={{ color: colors.textDim, fontSize: 11, fontFamily: fonts.mono }}>{e.stack}</Text> : null}
            </>
          )}
        </Pressable>
      ))}
    </View>
  );
}
