// Equipes: minhas equipes, membros, verificação, pedidos pra entrar (o fundador aprova), lista de equipes,
// convites pro app, pedido de equipe nova (só com código de fundador) e painel do Adm Master.
// Três abas em cima: Minha equipe | Descobrir (lista das equipes) | Eventos (painel com presença).
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Body, Button, Card, ErrorText, Field, Label, Mono, Pills, Screen, Title } from '../../src/components/ui';
import { db } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';
import { friendlyError } from '../../src/lib/errors.ts';
import { readableAccent } from '../../src/lib/contrast.ts';
import { LAUNCH_CITIES } from '../../src/lib/geo.ts';
import { colors, type ButtonShape } from '../../src/theme/tokens.ts';
import { InviteCard } from '../../src/components/InviteCard';
import { Avatar } from '../../src/components/Avatar';
import { CrewDirectory, type DirCrew } from '../../src/components/CrewDirectory';
import { EventsBoard } from '../../src/components/EventsBoard';

interface Crew { id: string; name: string; color: string; button_shape: ButtonShape; city_id: string; avatar_key: string | null }
interface MyMembership { role: 'founder' | 'admin' | 'member'; status: 'pending' | 'verified'; crews: Crew }
interface Member { user_id: string; role: string; status: string; xp: number; profiles: { username: string } }
interface OpenInvite { code: string; expires_at: string }
interface JoinRequest {
  id: string; crew_id: string; crew_name: string; username: string; avatar_key: string | null;
  message: string | null; created_at: string; car: string | null; crews_in: number;
}
interface Request { id: string; requester_id: string; name: string; city_id: string; instagram: string | null; member_count: number; status: string }
interface FounderCode {
  code: string; created_at: string; used_at: string | null; used_by: string | null;
  crew_id: string | null; crew_name: string | null; crew_status: string | null;
  request_status: string | null; request_name: string | null;
}

const ROLE: Record<string, string> = { founder: 'FUNDADOR', admin: 'ADMIN', member: 'MEMBRO' };
const SHAPES: { v: ButtonShape; l: string }[] = [{ v: 'redondo', l: 'Redondo' }, { v: 'reto', l: 'Reto' }, { v: 'quadrado', l: 'Quadrado' }];
const THEME_COLORS = ['#C6FF3D', '#3FA0FF', '#FF4D6D', '#FF8A1F', '#FFD233', '#B36BFF', '#29E0C8', '#FF5FC8', '#EDEFF2'];

export default function Equipes() {
  const router = useRouter();
  const { profile, refreshProfile } = useSession();
  const [mine, setMine] = useState<MyMembership[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invite, setInvite] = useState<string | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', city: 'sao_paulo', instagram: '', count: '' });
  const [formSent, setFormSent] = useState(false);
  const [master, setMaster] = useState<string | null>(null);
  const [openInvites, setOpenInvites] = useState<OpenInvite[]>([]);
  const [founderInvite, setFounderInvite] = useState<string | null>(null);
  const [founderCodes, setFounderCodes] = useState<FounderCode[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [directory, setDirectory] = useState<DirCrew[]>([]);
  const [canRegister, setCanRegister] = useState(false);
  const [tab, setTab] = useState<'minha' | 'descobrir' | 'eventos' | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await db.from('crew_members')
      .select('role, status, crews(id, name, color, button_shape, city_id, avatar_key)').eq('user_id', profile.id);
    const list = (data ?? []) as unknown as MyMembership[];
    setMine(list);
    const crewId = selected ?? list[0]?.crews.id ?? null;
    setSelected(crewId);
    if (crewId) {
      const { data: m } = await db.from('crew_members')
        .select('user_id, role, status, xp, profiles!crew_members_user_id_fkey(username)').eq('crew_id', crewId)
        .order('status').order('xp', { ascending: false });
      setMembers((m ?? []) as unknown as Member[]);
    }
    const { data: r } = await db.from('crew_requests')
      .select('id, requester_id, name, city_id, instagram, member_count, status').order('created_at', { ascending: false });
    setRequests((r ?? []) as Request[]);
    // meus convites pro app ainda não usados
    const { data: inv } = await db.from('invites').select('code, expires_at')
      .eq('created_by', profile.id).eq('kind', 'app').is('used_at', null).gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(10);
    setOpenInvites((inv ?? []) as OpenInvite[]);
    // pedidos pra entrar nas equipes em que sou fundador/admin; lista de equipes; posso registrar equipe?
    const [jr, dir, cr] = await Promise.all([
      db.rpc('my_crews_join_requests'), db.rpc('crew_directory'), db.rpc('can_register_crew'),
    ]);
    setJoinRequests((jr.data ?? []) as JoinRequest[]);
    setDirectory((dir.data ?? []) as DirCrew[]);
    setCanRegister(cr.data === true);
    // só volta alguém pra quem é dono de equipe
    const { data: mc } = await db.rpc('master_contact');
    const names = (mc ?? []) as { username: string }[];
    setMaster(profile.is_master ? null : names[0]?.username ?? null);
    // Adm Master: todos os códigos de fundador, com quem usou e a equipe que nasceu de cada um
    if (profile.is_master) {
      const { data: fc } = await db.rpc('master_founder_codes');
      setFounderCodes((fc ?? []) as FounderCode[]);
    }
  }, [profile, selected]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const current = mine.find((m) => m.crews.id === selected);
  // sem equipe: abre direto em Descobrir
  const view = tab ?? (mine.length || profile?.is_master || canRegister ? 'minha' : 'descobrir');
  const isAdmin = current?.status === 'verified' && (current.role === 'founder' || current.role === 'admin');
  const isVerified = current?.status === 'verified';
  const verifiedAnywhere = mine.some((m) => m.status === 'verified');
  const accent = current ? readableAccent(current.crews.color) : colors.neon;
  // registrar equipe: só quem entrou com código de fundador (e ainda não tem equipe) ou o Adm Master
  const myOpenRequest = requests.find((r) => r.requester_id === profile?.id && (r.status === 'pending' || r.status === 'more_info'));

  async function call(fn: string, args: Record<string, unknown>) {
    setError(null);
    const { data, error: e } = await db.rpc(fn, args);
    if (e) { setError(friendlyError(e)); return null; }
    await load();
    return data;
  }

  async function newInvite() {
    const code = await call('create_invite', { p_kind: 'app' });
    if (code) { setInvite(code as string); refreshProfile(); }
  }

  async function sendRequest() {
    if (!profile) return;
    setError(null);
    const { error: e } = await db.from('crew_requests').insert({
      requester_id: profile.id, name: form.name.trim(), city_id: form.city,
      instagram: form.instagram.trim() || null, member_count: Number(form.count) || 1, accepts_video_call: true,
    });
    if (e) setError(friendlyError(e)); else { setFormSent(true); load(); }
  }

  return (
    <Screen>
      <Title>Equipes</Title>
      <Segments value={view} onChange={setTab} badge={joinRequests.length} />
      {view === 'descobrir' && <CrewDirectory crews={directory} onChanged={load} />}
      {view === 'eventos' && <EventsBoard />}
      {view === 'minha' && <>
      {!profile?.is_master && (
        <Text style={{ color: colors.holo, fontWeight: '700', minHeight: 44, paddingVertical: 10 }} accessibilityRole="link"
              onPress={() => router.push('/ranks')}>Ranks do Radar e da mídia ›</Text>
      )}

      {mine.length > 1 && (
        <Pills options={mine.map((m) => ({ value: m.crews.id, label: m.crews.name }))}
               value={selected ?? ''} onChange={(v) => { setSelected(v); setInvite(null); }} />
      )}

      {current && (
        <Card accent={accent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar username={current.crews.name} avatarKey={current.crews.avatar_key} size={52} ring={accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: accent, fontSize: 20, fontWeight: '700' }} numberOfLines={1}>{current.crews.name}</Text>
              <Mono color={accent}>{ROLE[current.role] ?? current.role.toUpperCase()} · {current.status === 'verified' ? 'VERIFICADO' : 'EM VERIFICAÇÃO'}</Mono>
            </View>
          </View>
          <Text style={{ color: accent, fontWeight: '700', paddingVertical: 12, minHeight: 44 }} accessibilityRole="link"
                onPress={() => router.push({ pathname: '/equipe/[id]', params: { id: current.crews.id } })}>
            Ver página da equipe ›
          </Text>
          {current.status === 'pending' && (
            <>
              <Body dim>
                Pra ser verificado: membros da equipe confirmam que te conhecem e um admin escaneia seu QR num encontro.
                Até lá você não vê a localização da equipe.
              </Body>
              <Button title="Mostrar meu QR de check-in" color={current.crews.color} shape={current.crews.button_shape}
                      onPress={() => router.push({ pathname: '/meu-qr', params: { crew: current.crews.id, nome: current.crews.name } })} />
            </>
          )}
        </Card>
      )}

      {mine.length === 0 && (
        <Card>
          <Body>Você ainda não está em nenhuma equipe.</Body>
          <Body dim>Ache a sua na lista abaixo e peça pra entrar. Quem aprova é o fundador da equipe.</Body>
        </Card>
      )}

      {joinRequests.length > 0 && (
        <>
          <Label>Pedidos pra entrar ({joinRequests.length})</Label>
          <Body dim>Você responde por quem aprovar. Depois a pessoa ainda passa pela verificação (confirmações + check-in).</Body>
          {joinRequests.map((r) => (
            <Card key={r.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar username={r.username} avatarKey={r.avatar_key} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.holo, fontSize: 16, fontWeight: '700' }} accessibilityRole="link"
                        onPress={() => router.push({ pathname: '/perfil/[username]', params: { username: r.username } })}>@{r.username}</Text>
                  <Mono color={colors.textDim}>QUER ENTRAR NA {r.crew_name.toUpperCase()}</Mono>
                </View>
              </View>
              {r.car ? <Body dim>Carro: {r.car}</Body> : null}
              {r.crews_in > 0 ? <Body dim>Já é verificado em {r.crews_in} {r.crews_in === 1 ? 'equipe' : 'equipes'}.</Body> : null}
              {r.message ? <Body>“{r.message}”</Body> : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button title="Aprovar" onPress={() => call('decide_join_request', { p_request: r.id, p_decision: 'approved' })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Recusar" variant="secondary" color={colors.danger}
                          onPress={() => call('decide_join_request', { p_request: r.id, p_decision: 'rejected' })} />
                </View>
              </View>
            </Card>
          ))}
        </>
      )}

      {current && members.length > 0 && <Label>Membros</Label>}
      {members.map((m) => (
        <Card key={m.user_id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>@{m.profiles.username}</Text>
            <Mono color={m.status === 'verified' ? accent : colors.warn}>{m.status === 'verified' ? ROLE[m.role] ?? m.role.toUpperCase() : 'PENDENTE'}</Mono>
          </View>
          {m.status === 'pending' && m.user_id !== profile?.id && isVerified && (
            <Button title="Confirmo que conheço" variant="secondary" color={current!.crews.color}
                    onPress={() => call('vouch_member', { p_crew: selected, p_member: m.user_id })} />
          )}
        </Card>
      ))}

      {current && isAdmin && (
        <Button title="Escanear QR de check-in" variant="secondary" color={current.crews.color}
                onPress={() => router.push({ pathname: '/escanear', params: { crew: current.crews.id } })} />
      )}

      {current && isAdmin && (
        <Button title="Criar evento" color={current.crews.color} shape={current.crews.button_shape}
                onPress={() => router.push({ pathname: '/evento-novo', params: { crew: current.crews.id } })} />
      )}

      {current && isAdmin && (
        <Card>
          <Label>Tema da equipe</Label>
          <Body dim>Cor</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {THEME_COLORS.map((c) => {
              const on = current.crews.color.toUpperCase() === c;
              return (
                <Pressable key={c} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Cor ${c}`}
                           onPress={() => call('set_crew_theme', { p_crew: selected, p_color: c, p_shape: current.crews.button_shape })}
                           style={{ width: 44, height: 44, borderRadius: 22, borderWidth: on ? 3 : 1,
                                    borderColor: on ? colors.text : colors.line, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c }} />
                </Pressable>
              );
            })}
          </View>
          <Body dim>Formato dos botões</Body>
          <Pills options={SHAPES.map((x) => ({ value: x.v, label: x.l }))}
                 value={current.crews.button_shape}
                 onChange={(s) => call('set_crew_theme', { p_crew: selected, p_color: current.crews.color, p_shape: s })} />
          <Body dim>Avisos de blitz, buraco e lombada continuam laranja pra todo mundo.</Body>
        </Card>
      )}

      {(verifiedAnywhere || profile?.is_master) && (
        <>
          <Label>Convidar pro app{profile?.is_master ? '' : ` (${profile?.invites_left ?? 0} restando)`}</Label>
          <Body dim>O convite só dá acesso ao app. Lá dentro a pessoa pede pra entrar na equipe e o fundador aprova. Você responde por quem convidar.</Body>
          <Button title="Gerar convite" onPress={newInvite} />
          {invite && <InviteCard code={invite} kind="app" />}
          {openInvites.filter((i) => i.code !== invite).slice(0, 5).map((i) => (
            <InviteCard key={i.code} code={i.code} kind="app" expiresAt={i.expires_at} />
          ))}
        </>
      )}

      {mine.length === 0 && (
        <Button title="Ver as equipes da cena" variant="secondary" onPress={() => setTab('descobrir')} />
      )}

      <ErrorText>{error}</ErrorText>

      {master && (
        <Card>
          <Label>Adm Master</Label>
          <Body dim>Só donos de equipe veem isso. Fale com @{master} pra liberar equipe ou resolver problema.</Body>
        </Card>
      )}

      {profile?.is_master && (
        <>
          <Title>Adm Master</Title>
          <Body dim>O convite de fundador é pra quem vai registrar uma equipe nova. Depois você aprova o pedido aqui.</Body>
          <Button title="Gerar convite de fundador" onPress={async () => {
            const code = await call('create_invite', { p_kind: 'founder' });
            if (code) setFounderInvite(code as string);
          }} />
          {founderInvite && <InviteCard code={founderInvite} kind="founder" />}
          {founderCodes.length > 0 && <Label>Códigos de fundador ({founderCodes.length})</Label>}
          {founderCodes.map((f) => {
            const free = !f.used_at;
            const status = free ? 'LIVRE · NÃO VENCE'
              : f.crew_name ? `EQUIPE ${f.crew_name.toUpperCase()}${f.crew_status === 'suspended' ? ' · SUSPENSA' : ''}`
              : f.request_name ? `PEDIDO "${f.request_name.toUpperCase()}" ${f.request_status === 'more_info' ? '· PEDI MAIS PROVAS' : f.request_status === 'rejected' ? '· RECUSADO' : '· ESPERANDO'}`
              : 'AINDA SEM PEDIDO DE EQUIPE';
            return (
              <Card key={f.code}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', letterSpacing: 1 }} selectable>{f.code}</Text>
                  <Mono color={free ? colors.neon : colors.textDim}>{free ? 'LIVRE' : 'USADO'}</Mono>
                </View>
                {!free && <Body>@{f.used_by ?? '—'}</Body>}
                <Mono color={f.crew_name ? colors.neon : colors.textDim}>{status}</Mono>
                {f.crew_id && (
                  <Text style={{ color: colors.holo, fontWeight: '700', paddingVertical: 12 }} accessibilityRole="link"
                        onPress={() => router.push({ pathname: '/equipe/[id]', params: { id: f.crew_id! } })}>Abrir equipe ›</Text>
                )}
              </Card>
            );
          })}
          {requests.filter((r) => r.status === 'pending' || r.status === 'more_info').length === 0 && (
            <Body dim>Nenhum pedido de equipe esperando.</Body>
          )}
          {requests.filter((r) => r.status === 'pending' || r.status === 'more_info').map((r) => (
            <Card key={r.id}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{r.name}</Text>
              <Body dim>{LAUNCH_CITIES.find((c) => c.id === r.city_id)?.name} · {r.member_count} membros · {r.instagram ?? 'sem Instagram'}</Body>
              <Button title="Aprovar" onPress={() => call('review_crew_request', { p_request: r.id, p_decision: 'approved', p_note: null })} />
              <Button title="Pedir mais provas" variant="secondary" onPress={() => call('review_crew_request', { p_request: r.id, p_decision: 'more_info', p_note: null })} />
              <Button title="Recusar" variant="secondary" color={colors.danger} onPress={() => call('review_crew_request', { p_request: r.id, p_decision: 'rejected', p_note: null })} />
            </Card>
          ))}
        </>
      )}

      {canRegister && (
        <Card>
          <Label>Registrar minha equipe</Label>
          {formSent || myOpenRequest
            ? <Body dim>Pedido enviado. O Adm Master vai olhar as provas e marcar uma chamada de vídeo.</Body>
            : <>
                <Body dim>Toda equipe é liberada pelo Adm Master. Mostra que ela existe de verdade.</Body>
                <Field label="Nome da equipe" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
                <Pills options={LAUNCH_CITIES.map((c) => ({ value: c.id as string, label: c.name }))}
                       value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                <Field label="Instagram da equipe" value={form.instagram} autoCapitalize="none"
                       onChangeText={(v) => setForm({ ...form, instagram: v })} />
                <Field label="Quantos membros" value={form.count} keyboardType="number-pad"
                       onChangeText={(v) => setForm({ ...form, count: v.replace(/\D/g, '') })} />
                <Button title="Enviar pro Adm Master" onPress={sendRequest} disabled={form.name.trim().length < 2} />
              </>}
        </Card>
      )}
      </>}
    </Screen>
  );
}

function Segments({ value, onChange, badge }: { value: string; onChange: (v: 'minha' | 'descobrir' | 'eventos') => void; badge: number }) {
  const opts: { v: 'minha' | 'descobrir' | 'eventos'; l: string }[] = [
    { v: 'minha', l: 'Minha equipe' }, { v: 'descobrir', l: 'Descobrir' }, { v: 'eventos', l: 'Eventos' },
  ];
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.panel, borderRadius: 999, borderWidth: 1, borderColor: colors.line, padding: 4 }}
          accessibilityRole="tablist">
      {opts.map((o) => {
        const on = o.v === value;
        return (
          <Pressable key={o.v} onPress={() => onChange(o.v)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                     style={{ flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
                              flexDirection: 'row', gap: 6, backgroundColor: on ? colors.neon : 'transparent' }}>
            <Text style={{ color: on ? colors.ink : colors.textDim, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{o.l}</Text>
            {o.v === 'minha' && badge > 0 && (
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{badge}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
