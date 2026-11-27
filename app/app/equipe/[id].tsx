// Página da equipe, no jeito das páginas do Facebook: capa, foto (logo), nome, bio, Instagram,
// fundador, próximos eventos e membros. Fundador/admin/staff edita a página e aprova quem pede pra entrar.
// Quem é de fora pede pra entrar daqui. Dados de crew_page() — o banco decide o que cada um vê.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Body, Button, Card, ErrorText, Field, Label, Mono, Screen, Title } from '../../src/components/ui';
import { Avatar } from '../../src/components/Avatar';
import { CrewCover, CrewLogo } from '../../src/components/CrewArt';
import { Icon, IconBadge, IconName } from '../../src/components/Icon';
import { db } from '../../src/lib/db';
import { photoUrl, uploadPhoto } from '../../src/lib/photos';
import { friendlyError } from '../../src/lib/errors.ts';
import { readableAccent } from '../../src/lib/contrast.ts';
import { whenText } from '../../src/lib/events.ts';
import { colors } from '../../src/theme/tokens.ts';
import { goBack } from '../../src/lib/goBack';

interface Person { username: string; avatar_key: string | null; role?: string }
interface JoinReq { id: string; username: string; avatar_key: string | null; message: string | null; created_at: string }
interface CrewPage {
  id: string; name: string; city: string; instagram: string | null; color: string; button_shape: string;
  created_at: string; status: string; bio: string | null; avatar_key: string | null; cover_key: string | null;
  founder: Person | null; members: Person[]; member_count: number;
  i_am_member: boolean; i_am_admin: boolean; i_am_staff?: boolean; my_role?: string | null; my_request: string | null; join_requests: JoinReq[] | null;
  events: { id: string; title: string; starts_at: string; ends_at: string }[];
}

const ROLE: Record<string, string> = { founder: 'FUNDADOR', admin: 'ADMIN', staff: 'STAFF', member: 'MEMBRO' };
const COVER_H = 190;
const LOGO = 104;

export default function EquipePagina() {
  const { id, pedir } = useLocalSearchParams<{ id: string; pedir?: string }>();
  const router = useRouter();
  const [c, setC] = useState<CrewPage | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // edição da página
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ bio: '', instagram: '', avatar: null as string | null, cover: null as string | null });
  // pedido pra entrar
  const [asking, setAsking] = useState(pedir === '1');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await db.rpc('crew_page', { p_crew: id });
    if (!data) { setState('missing'); return; }
    setC(data as CrewPage); setState('ok');
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setError(null);
    try { await fn(); await load(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(null); }
  }

  async function rpc(fn: string, args: Record<string, unknown>) {
    const { error: e } = await db.rpc(fn, args);
    if (e) throw e;
  }

  async function pick(which: 'avatar' | 'cover') {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: which === 'avatar' ? [1, 1] : [16, 9],
    });
    if (r.canceled || !r.assets[0]) return;
    setBusy(which); setError(null);
    try {
      const key = await uploadPhoto(r.assets[0].uri, 'post');
      if (editing) { setDraft((d) => ({ ...d, [which]: key })); return; }
      // fora da edição a foto já vale na hora: salva mantendo o resto da página como está
      await rpc('set_crew_page', { p_crew: c!.id, p_bio: c!.bio ?? '', p_instagram: c!.instagram ?? '',
                                   p_avatar_key: which === 'avatar' ? key : c!.avatar_key,
                                   p_cover_key: which === 'cover' ? key : c!.cover_key });
      await load();
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(null); }
  }

  if (state === 'loading') return <Screen><ActivityIndicator color={colors.neon} /></Screen>;
  if (state === 'missing' || !c) {
    return (
      <Screen>
        <Body>Essa equipe não existe ou não está disponível.</Body>
        <Button title="Voltar" variant="secondary" onPress={() => goBack(router, '/equipes')} />
      </Screen>
    );
  }

  const accent = readableAccent(c.color);
  const insta = c.instagram?.replace(/^@/, '').trim();
  const openProfile = (u: string) => router.push({ pathname: '/perfil/[username]', params: { username: u } });
  const coverKey = editing ? draft.cover : c.cover_key;
  const logoKey = editing ? draft.avatar : c.avatar_key;
  const cover = photoUrl(coverKey);
  const logo = photoUrl(logoKey);
  const pending = c.my_request === 'pending';

  // fundador, admin e staff editam a página e aprovam pedidos
  const canManage = !!(c.i_am_staff ?? c.i_am_admin);

  function startEdit() {
    setDraft({ bio: c!.bio ?? '', instagram: c!.instagram ?? '', avatar: c!.avatar_key, cover: c!.cover_key });
    setEditing(true);
  }

  return (
    <Screen>
      <Title back="/equipes">Equipe</Title>

      {/* capa + foto da equipe por cima, como no Facebook */}
      <View style={{ marginBottom: 8 }}>
        <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
          <CrewCover name={c.name} color={c.color} accent={accent} uri={cover} height={COVER_H} fontSize={58} />
          {canManage && (
            <Pressable onPress={() => pick('cover')} disabled={!!busy} accessibilityRole="button"
                       accessibilityLabel={cover ? 'Trocar capa da equipe' : 'Pôr capa na equipe'} style={st.photoBtn}>
              {busy === 'cover' ? <ActivityIndicator color={colors.text} size="small" /> : <Icon name="camera" size={16} color={colors.text} />}
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                {busy === 'cover' ? 'Enviando…' : cover ? 'Trocar capa' : 'Pôr capa'}
              </Text>
            </Pressable>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, paddingHorizontal: 14, marginTop: -LOGO / 2 }}>
          <Pressable disabled={!canManage || !!busy} onPress={() => pick('avatar')}
                     accessibilityRole={canManage ? 'button' : undefined}
                     accessibilityLabel={canManage ? (logo ? 'Trocar foto da equipe' : 'Pôr foto da equipe') : undefined}>
            <CrewLogo name={c.name} accent={accent} uri={logo} size={LOGO} />
            {canManage && (
              <View style={[st.logoCam, { borderColor: accent }]}>
                {busy === 'avatar' ? <ActivityIndicator color={accent} size="small" /> : <Icon name="camera" size={16} color={accent} />}
              </View>
            )}
          </Pressable>
          <View style={{ flex: 1, paddingBottom: 6 }}>
            <Mono color={accent}>{c.status === 'suspended' ? 'EQUIPE SUSPENSA' : 'EQUIPE'}</Mono>
          </View>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }} accessibilityRole="header">{c.name}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip icon="pin" text={c.city} />
          <Chip icon="users" text={`${c.member_count} ${c.member_count === 1 ? 'membro' : 'membros'}`} />
          <Chip icon="calendar" text={`desde ${new Date(c.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`} />
          {c.i_am_member && <Chip icon="check" text="Você faz parte" color={accent} />}
        </View>
      </View>

      {/* convite pro fundador deixar a página com a cara da equipe */}
      {canManage && !editing && (!cover || !logo) && (
        <Card accent={accent}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <IconBadge name="camera" color={accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Deixa a página com a cara da equipe</Text>
              <Body dim>{!logo && !cover ? 'Põe a logo e uma foto de capa (um rolê, os carros juntos).'
                : !logo ? 'Falta a logo da equipe.' : 'Falta a foto de capa.'} É o que a galera vê no Descobrir.</Body>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!logo && <View style={{ flex: 1 }}><Button title="Pôr logo" color={c.color} loading={busy === 'avatar'} onPress={() => pick('avatar')} /></View>}
            {!cover && <View style={{ flex: 1 }}><Button title="Pôr capa" color={c.color} loading={busy === 'cover'} onPress={() => pick('cover')} /></View>}
          </View>
        </Card>
      )}
      {editing ? (
        <Card accent={accent}>
          <Label>Editar página</Label>
          <Field label="Bio" value={draft.bio} onChangeText={(v) => setDraft({ ...draft, bio: v })} multiline maxLength={600}
                 placeholder="Conta a história da equipe, o estilo, onde vocês colam…" style={{ minHeight: 100, textAlignVertical: 'top' }} />
          <Body dim>{draft.bio.length}/600</Body>
          <Field label="Instagram" value={draft.instagram} autoCapitalize="none" placeholder="@suaequipe"
                 onChangeText={(v) => setDraft({ ...draft, instagram: v })} />
          <Body dim>Use o botão da câmera na capa ou na foto redonda pra trocar. Avisos de blitz e lombada continuam laranja pra todo mundo.</Body>
          {(draft.cover || draft.avatar) && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {draft.cover && (
                <View style={{ flex: 1 }}>
                  <Button title="Tirar capa" variant="secondary" onPress={() => setDraft({ ...draft, cover: null })} />
                </View>
              )}
              {draft.avatar && (
                <View style={{ flex: 1 }}>
                  <Button title="Tirar foto" variant="secondary" onPress={() => setDraft({ ...draft, avatar: null })} />
                </View>
              )}
            </View>
          )}
          <ErrorText>{error}</ErrorText>
          <Button title="Salvar página" color={c.color} loading={busy === 'save'} disabled={busy === 'cover' || busy === 'avatar'}
                  onPress={() => run('save', async () => {
                    await rpc('set_crew_page', { p_crew: c.id, p_bio: draft.bio, p_instagram: draft.instagram,
                                                 p_avatar_key: draft.avatar, p_cover_key: draft.cover });
                    setEditing(false);
                  })} />
          <Button title="Cancelar" variant="secondary" onPress={() => { setEditing(false); setError(null); }} />
        </Card>
      ) : (
        <>
          {c.bio ? <Body>{c.bio}</Body> : canManage ? <Body dim>Sem bio ainda. Toque em “Editar página” pra contar a história da equipe.</Body> : null}
          {insta ? (
            <Text style={{ color: colors.holo, fontWeight: '700', paddingVertical: 12 }} accessibilityRole="link"
                  onPress={() => Linking.openURL(`https://instagram.com/${encodeURIComponent(insta)}`)}>@{insta} no Instagram ›</Text>
          ) : null}
          {canManage && <Button title="Editar página" variant="secondary" color={c.color} onPress={startEdit} />}
        </>
      )}

      {/* entrar na equipe */}
      {!editing && !c.i_am_member && c.status === 'active' && (
        <Card accent={accent}>
          {pending ? (
            <>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <IconBadge name="clock" color={accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>Pedido enviado</Text>
                  <Body dim>A {c.name} vai olhar seu pedido. Quando aprovarem, você recebe uma notificação.</Body>
                </View>
              </View>
              <Steps accent={accent} done={1} />
              <Button title="Cancelar pedido" variant="secondary" loading={busy === 'cancel'}
                      onPress={() => run('cancel', () => rpc('cancel_join_request', { p_crew: c.id }))} />
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <IconBadge name="users" color={accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>Quer colar com a {c.name}?</Text>
                  <Body dim>{c.my_request === 'rejected' ? 'Seu último pedido foi recusado. Dá pra pedir de novo depois de 7 dias.'
                    : 'Entrando, você vê os eventos e comboios da equipe e aparece no mapa com a galera.'}</Body>
                </View>
              </View>
              <Steps accent={accent} done={0} />
              {asking ? (
                <>
                  <Field label="Recado pro fundador (opcional)" value={message} onChangeText={setMessage} multiline maxLength={300}
                         placeholder="Ex.: sou o do Gol branco, colo com vocês no Anhembi" style={{ minHeight: 80, textAlignVertical: 'top' }} />
                  <Body dim>{message.length}/300</Body>
                  <Button title="Enviar pedido" color={c.color} loading={busy === 'ask'}
                          onPress={() => run('ask', async () => { await rpc('request_join_crew', { p_crew: c.id, p_message: message }); setAsking(false); setMessage(''); })} />
                  <Button title="Agora não" variant="secondary" onPress={() => setAsking(false)} />
                </>
              ) : (
                <Button title="Pedir pra entrar" color={c.color} onPress={() => setAsking(true)} />
              )}
            </>
          )}
        </Card>
      )}
      {!editing && <ErrorText>{error}</ErrorText>}

      {/* fundador/admin: pedidos esperando */}
      {canManage && c.join_requests && c.join_requests.length > 0 && (
        <>
          <Label>Pedidos pra entrar ({c.join_requests.length})</Label>
          {c.join_requests.map((r) => (
            <Card key={r.id}>
              <Pressable onPress={() => openProfile(r.username)} accessibilityRole="link"
                         style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
                <Avatar username={r.username} avatarKey={r.avatar_key} size={40} />
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 }}>@{r.username}</Text>
                <Mono color={colors.textDim}>{new Date(r.created_at).toLocaleDateString('pt-BR')}</Mono>
              </Pressable>
              {r.message ? <Body>“{r.message}”</Body> : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button title="Aprovar" color={c.color} loading={busy === `ok-${r.id}`}
                          onPress={() => run(`ok-${r.id}`, () => rpc('decide_join_request', { p_request: r.id, p_decision: 'approved' }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Recusar" variant="secondary" color={colors.danger} loading={busy === `no-${r.id}`}
                          onPress={() => run(`no-${r.id}`, () => rpc('decide_join_request', { p_request: r.id, p_decision: 'rejected' }))} />
                </View>
              </View>
            </Card>
          ))}
        </>
      )}

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

function Chip({ icon, text, color = colors.textDim }: { icon: IconName; text: string; color?: string }) {
  return (
    <View style={st.chip}>
      <Icon name={icon} size={14} color={color} />
      <Text style={{ color, fontSize: 13, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

// Como funciona a entrada: pedido → equipe aprova → verificação com a galera
function Steps({ accent, done }: { accent: string; done: number }) {
  const items = ['Você pede', 'A equipe aprova', 'Verificação no rolê'];
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {items.map((t, i) => {
        const on = i < done; const now = i === done;
        return (
          <View key={t} style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: on ? accent : now ? colors.lineStrong : colors.line }} />
            <Text style={{ color: on || now ? colors.text : colors.textMuted, fontSize: 12, fontWeight: now ? '700' : '500' }}>{i + 1}. {t}</Text>
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  photoBtn: { position: 'absolute', right: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40,
              paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.scrim, borderWidth: 1, borderColor: colors.lineStrong },
  logoCam: { position: 'absolute', right: -2, bottom: -2, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg,
             borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: colors.panelAlt,
          paddingHorizontal: 10, paddingVertical: 6 },
});
