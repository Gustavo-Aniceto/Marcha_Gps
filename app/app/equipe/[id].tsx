// Página da equipe, no jeito das páginas do Facebook: capa, foto (logo), nome, bio, Instagram,
// fundador, próximos eventos e membros. Fundador/admin edita a página e aprova quem pede pra entrar.
// Quem é de fora pede pra entrar daqui. Dados de crew_page() — o banco decide o que cada um vê.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Body, Button, Card, ErrorText, Field, Label, Mono, Screen, Title } from '../../src/components/ui';
import { Avatar } from '../../src/components/Avatar';
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
  i_am_member: boolean; i_am_admin: boolean; my_request: string | null; join_requests: JoinReq[] | null;
  events: { id: string; title: string; starts_at: string; ends_at: string }[];
}

const ROLE: Record<string, string> = { founder: 'FUNDADOR', admin: 'ADMIN', member: 'MEMBRO' };
const COVER_H = 170;
const LOGO = 96;

export default function EquipePagina() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<CrewPage | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // edição da página
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ bio: '', instagram: '', avatar: null as string | null, cover: null as string | null });
  // pedido pra entrar
  const [asking, setAsking] = useState(false);
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
      setDraft((d) => ({ ...d, [which]: key }));
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

  function startEdit() {
    setDraft({ bio: c!.bio ?? '', instagram: c!.instagram ?? '', avatar: c!.avatar_key, cover: c!.cover_key });
    setEditing(true);
  }

  return (
    <Screen>
      <Title back="/equipes">Equipe</Title>

      {/* capa + foto da equipe por cima, como no Facebook */}
      <View style={{ marginBottom: LOGO / 2 }}>
        <View style={{ height: COVER_H, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.panelAlt,
                       borderWidth: 1, borderColor: accent }}>
          {cover
            ? <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }} resizeMode="cover"
                     accessibilityLabel={`Capa da equipe ${c.name}`} />
            : (
              // sem capa: fundo na cor da equipe com o nome bem grande e apagado, em vez de um quadro vazio
              <View style={{ flex: 1, backgroundColor: colors.panel, justifyContent: 'center', overflow: 'hidden' }}>
                <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: c.color, opacity: 0.16 }} />
                <Text numberOfLines={1} ellipsizeMode="clip" style={{ color: accent, opacity: 0.18, fontSize: 56, fontWeight: '900', marginLeft: 12,
                                                 letterSpacing: -1, transform: [{ rotate: '-6deg' }] }}>{c.name.toUpperCase()}</Text>
                {c.i_am_admin && !editing && (
                  <Text style={{ position: 'absolute', right: 12, top: 10, color: colors.textMuted, fontSize: 12 }}>Sem capa ainda</Text>
                )}
              </View>
            )}
          {editing && (
            <Pressable onPress={() => pick('cover')} accessibilityRole="button" accessibilityLabel="Trocar capa"
                       style={{ position: 'absolute', right: 8, bottom: 8, backgroundColor: colors.bg, borderRadius: 6,
                                paddingHorizontal: 12, minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: accent }}>
              <Text style={{ color: accent, fontWeight: '700' }}>{busy === 'cover' ? 'Enviando…' : 'Trocar capa'}</Text>
            </Pressable>
          )}
        </View>
        <Pressable disabled={!editing} onPress={() => pick('avatar')} accessibilityRole={editing ? 'button' : undefined}
                   accessibilityLabel={editing ? 'Trocar foto da equipe' : undefined}
                   style={{ position: 'absolute', left: 16, bottom: -LOGO / 2 }}>
          {logo
            ? <Image source={{ uri: logo }} style={{ width: LOGO, height: LOGO, borderRadius: LOGO / 2, borderWidth: 3, borderColor: accent }}
                     accessibilityLabel={`Foto da equipe ${c.name}`} />
            : <View style={{ width: LOGO, height: LOGO, borderRadius: LOGO / 2, borderWidth: 3, borderColor: accent,
                             backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: accent, fontSize: 40, fontWeight: '800' }}>{(c.name[0] ?? '?').toUpperCase()}</Text>
              </View>}
          {editing && (
            <View style={{ position: 'absolute', right: -4, bottom: -4, backgroundColor: colors.bg, borderRadius: 14,
                           borderWidth: 1, borderColor: accent, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: accent, fontSize: 12, fontWeight: '700' }}>{busy === 'avatar' ? '…' : 'trocar'}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }} accessibilityRole="header">{c.name}</Text>
        <Mono color={accent}>EQUIPE · {c.city.toUpperCase()}{c.status === 'suspended' ? ' · SUSPENSA' : ''}</Mono>
        <Body dim>
          {c.member_count} {c.member_count === 1 ? 'membro verificado' : 'membros verificados'}
          {' · desde '}{new Date(c.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </Body>
      </View>

      {editing ? (
        <Card accent={accent}>
          <Label>Editar página</Label>
          <Field label="Bio" value={draft.bio} onChangeText={(v) => setDraft({ ...draft, bio: v })} multiline maxLength={600}
                 placeholder="Conta a história da equipe, o estilo, onde vocês colam…" style={{ minHeight: 100, textAlignVertical: 'top' }} />
          <Body dim>{draft.bio.length}/600</Body>
          <Field label="Instagram" value={draft.instagram} autoCapitalize="none" placeholder="@suaequipe"
                 onChangeText={(v) => setDraft({ ...draft, instagram: v })} />
          <Body dim>Toque na capa ou na foto redonda pra trocar. Avisos de blitz e lombada continuam laranja pra todo mundo.</Body>
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
          {c.bio ? <Body>{c.bio}</Body> : c.i_am_admin ? <Body dim>Sem bio ainda. Toque em “Editar página” pra contar a história da equipe.</Body> : null}
          {insta ? (
            <Text style={{ color: colors.holo, fontWeight: '700', paddingVertical: 12 }} accessibilityRole="link"
                  onPress={() => Linking.openURL(`https://instagram.com/${encodeURIComponent(insta)}`)}>@{insta} no Instagram ›</Text>
          ) : null}
          {c.i_am_admin && <Button title="Editar página" variant="secondary" color={c.color} onPress={startEdit} />}
        </>
      )}

      {/* entrar na equipe */}
      {!editing && (c.i_am_member ? (
        <Mono color={accent}>VOCÊ FAZ PARTE</Mono>
      ) : c.status === 'active' && (
        <Card accent={accent}>
          {pending ? (
            <>
              <Mono color={accent}>PEDIDO ENVIADO</Mono>
              <Body dim>O fundador da {c.name} vai olhar seu pedido. Quando aprovar, a equipe aparece na sua aba Equipes.</Body>
              <Button title="Cancelar pedido" variant="secondary" loading={busy === 'cancel'}
                      onPress={() => run('cancel', () => rpc('cancel_join_request', { p_crew: c.id }))} />
            </>
          ) : asking ? (
            <>
              <Field label="Mensagem pro fundador (opcional)" value={message} onChangeText={setMessage} multiline maxLength={300}
                     placeholder="Ex.: sou o do Gol branco, colo com vocês no Anhembi" style={{ minHeight: 70, textAlignVertical: 'top' }} />
              <Button title="Enviar pedido" color={c.color} loading={busy === 'ask'}
                      onPress={() => run('ask', async () => { await rpc('request_join_crew', { p_crew: c.id, p_message: message }); setAsking(false); setMessage(''); })} />
              <Button title="Cancelar" variant="secondary" onPress={() => setAsking(false)} />
            </>
          ) : (
            <>
              <Body dim>
                {c.my_request === 'rejected' ? 'Seu último pedido foi recusado. Dá pra pedir de novo depois de 7 dias.'
                  : 'Quem aprova a entrada é o fundador da equipe. Depois ainda tem a verificação com a galera.'}
              </Body>
              <Button title="Pedir pra entrar" color={c.color} onPress={() => setAsking(true)} />
            </>
          )}
        </Card>
      ))}
      {!editing && <ErrorText>{error}</ErrorText>}

      {/* fundador/admin: pedidos esperando */}
      {c.i_am_admin && c.join_requests && c.join_requests.length > 0 && (
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
