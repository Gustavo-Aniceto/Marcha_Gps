// Equipes: minhas equipes, membros, verificação, convites, tema; pedido de equipe nova; painel do Adm Master.
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Body, Button, Card, ErrorText, Field, Label, Mono, Pills, Screen, Title } from '../../src/components/ui';
import { supabase } from '../../src/lib/supabase';
import { useSession } from '../../src/lib/session';
import { friendlyError } from '../../src/lib/errors.ts';
import { readableAccent } from '../../src/lib/contrast.ts';
import { LAUNCH_CITIES } from '../../src/lib/geo.ts';
import { colors, type ButtonShape } from '../../src/theme/tokens.ts';

interface Crew { id: string; name: string; color: string; button_shape: ButtonShape; city_id: string }
interface MyMembership { role: 'founder' | 'admin' | 'member'; status: 'pending' | 'verified'; crews: Crew }
interface Member { user_id: string; role: string; status: string; xp: number; profiles: { username: string } }
interface Request { id: string; name: string; city_id: string; instagram: string | null; member_count: number; status: string }

const THEME_COLORS = ['#C6FF3D', '#3FA0FF', '#FF4D6D', '#FF8A1F', '#FFD233', '#B36BFF', '#29E0C8', '#FF5FC8', '#EDEFF2'];

export default function Equipes() {
  const { profile, refreshProfile } = useSession();
  const [mine, setMine] = useState<MyMembership[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invite, setInvite] = useState<string | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', city: 'sao_paulo', instagram: '', count: '' });
  const [formSent, setFormSent] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('crew_members')
      .select('role, status, crews(id, name, color, button_shape, city_id)').eq('user_id', profile.id);
    const list = (data ?? []) as unknown as MyMembership[];
    setMine(list);
    const crewId = selected ?? list[0]?.crews.id ?? null;
    setSelected(crewId);
    if (crewId) {
      const { data: m } = await supabase.from('crew_members')
        .select('user_id, role, status, xp, profiles!crew_members_user_id_fkey(username)').eq('crew_id', crewId)
        .order('status').order('xp', { ascending: false });
      setMembers((m ?? []) as unknown as Member[]);
    }
    const { data: r } = await supabase.from('crew_requests')
      .select('id, name, city_id, instagram, member_count, status').order('created_at', { ascending: false });
    setRequests((r ?? []) as Request[]);
  }, [profile, selected]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const current = mine.find((m) => m.crews.id === selected);
  const isAdmin = current?.status === 'verified' && (current.role === 'founder' || current.role === 'admin');
  const isVerified = current?.status === 'verified';
  const accent = current ? readableAccent(current.crews.color) : colors.neon;

  async function call(fn: string, args: Record<string, unknown>) {
    setError(null);
    const { data, error: e } = await supabase.rpc(fn, args);
    if (e) { setError(friendlyError(e)); return null; }
    await load();
    return data;
  }

  async function newInvite() {
    const code = await call('create_invite', { p_crew: selected });
    if (code) { setInvite(code as string); refreshProfile(); }
  }

  async function sendRequest() {
    if (!profile) return;
    setError(null);
    const { error: e } = await supabase.from('crew_requests').insert({
      requester_id: profile.id, name: form.name.trim(), city_id: form.city,
      instagram: form.instagram.trim() || null, member_count: Number(form.count) || 1, accepts_video_call: true,
    });
    if (e) setError(friendlyError(e)); else { setFormSent(true); load(); }
  }

  return (
    <Screen>
      <Title>Equipes</Title>

      {mine.length > 0 && (
        <Pills options={mine.map((m) => ({ value: m.crews.id, label: m.crews.name }))}
               value={selected ?? ''} onChange={(v) => { setSelected(v); setInvite(null); }} />
      )}

      {current && (
        <Card accent={accent}>
          <Text style={{ color: accent, fontSize: 20, fontWeight: '700' }}>{current.crews.name}</Text>
          <Mono color={accent}>{current.role.toUpperCase()} · {current.status === 'verified' ? 'VERIFICADO' : 'EM VERIFICAÇÃO'}</Mono>
          {current.status === 'pending' && (
            <Body dim>
              Pra ser verificado: membros da equipe confirmam que te conhecem e um admin faz seu check-in num encontro.
              Até lá você não vê a localização da equipe.
            </Body>
          )}
        </Card>
      )}

      {current && isVerified && (
        <>
          <Label>Convites ({profile?.invites_left ?? 0} restando)</Label>
          <Body dim>Você responde por quem convidar.</Body>
          <Button title="Gerar convite" color={current.crews.color} shape={current.crews.button_shape} onPress={newInvite} />
          {invite && <Card accent={accent}><Mono color={accent}>CÓDIGO: {invite}</Mono><Body dim>Vale por 7 dias e uma pessoa.</Body></Card>}
        </>
      )}

      {current && members.length > 0 && <Label>Membros</Label>}
      {members.map((m) => (
        <Card key={m.user_id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>@{m.profiles.username}</Text>
            <Mono color={m.status === 'verified' ? accent : colors.warn}>{m.status === 'verified' ? m.role.toUpperCase() : 'PENDENTE'}</Mono>
          </View>
          {m.status === 'pending' && m.user_id !== profile?.id && isVerified && (
            <Button title="Confirmo que conheço" variant="secondary" color={current!.crews.color}
                    onPress={() => call('vouch_member', { p_crew: selected, p_member: m.user_id })} />
          )}
          {m.status === 'pending' && isAdmin && (
            <Button title="Check-in: vi a pessoa e o carro" color={current!.crews.color} shape={current!.crews.button_shape}
                    onPress={() => call('admin_checkin', { p_crew: selected, p_member: m.user_id })} />
          )}
        </Card>
      ))}

      {current && isAdmin && (
        <Card>
          <Label>Tema da equipe</Label>
          <Pills options={THEME_COLORS.map((c) => ({ value: c, label: c }))} value={current.crews.color.toUpperCase()}
                 onChange={(c) => call('set_crew_theme', { p_crew: selected, p_color: c, p_shape: current.crews.button_shape })} />
          <Pills options={(['redondo', 'reto', 'quadrado'] as ButtonShape[]).map((s) => ({ value: s, label: s }))}
                 value={current.crews.button_shape}
                 onChange={(s) => call('set_crew_theme', { p_crew: selected, p_color: current.crews.color, p_shape: s })} />
          <Body dim>Avisos de blitz, buraco e lombada continuam laranja pra todo mundo.</Body>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>

      {profile?.is_master && (
        <>
          <Title>Adm Master</Title>
          <Button title="Gerar convite de fundador" variant="secondary" onPress={async () => {
            const code = await call('create_invite', { p_crew: null });
            if (code) setInvite(code as string);
          }} />
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

      {!profile?.is_master && (
        <Card>
          <Label>Registrar minha equipe</Label>
          {formSent || requests.some((r) => r.status === 'pending')
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
    </Screen>
  );
}
