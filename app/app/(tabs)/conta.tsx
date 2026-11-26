// Conta: editar perfil, notificações (pedidos, aprovações, eventos, comentários), privacidade e dados
// (quem vê o carro, baixar meus dados, apagar a conta), atalhos e sair da conta.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useUser } from '@clerk/expo';
import { Body, Button, Card, ErrorText, Field, Label, Screen, Title } from '../../src/components/ui';
import { Avatar } from '../../src/components/Avatar';
import { Icon, IconBadge, type IconName } from '../../src/components/Icon';
import { db } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';
import { friendlyError } from '../../src/lib/errors.ts';
import { uploadPhoto } from '../../src/lib/photos';
import { colors, fonts } from '../../src/theme/tokens.ts';

interface Notif { id: string; kind: string; title: string; body: string | null; link: string | null; created_at: string; read: boolean }
type Section = null | 'perfil' | 'notificacoes' | 'privacidade';

const KIND_ICON: Record<string, IconName> = {
  equipe_pedida: 'users', equipe_decidida: 'users', pedido_entrar: 'user', entrada_decidida: 'check', verificado: 'check',
  evento: 'calendar', comentario: 'chat', convite_usado: 'ticket',
};

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'agora';
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d` : new Date(iso).toLocaleDateString('pt-BR');
}

export default function Conta() {
  const router = useRouter();
  const { profile, refreshProfile, signOut } = useSession();
  const { user } = useUser();
  const [open, setOpen] = useState<Section>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // editar perfil
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  // notificações
  const [notifs, setNotifs] = useState<Notif[] | null>(null);
  const prefs = profile?.notify_prefs ?? { equipes: true, eventos: true, social: true };
  // apagar conta
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadNotifs = useCallback(async () => {
    const { data } = await db.rpc('my_notifications', { p_limit: 60 });
    setNotifs((data ?? []) as Notif[]);
  }, []);

  useFocusEffect(useCallback(() => {
    setName(profile?.display_name ?? ''); setBio(profile?.bio ?? '');
    loadNotifs();
  }, [profile?.id, loadNotifs]));

  const unread = (notifs ?? []).filter((n) => !n.read).length;

  function toggle(s: Section) {
    setOpen((o) => (o === s ? null : s)); setError(null); setMsg(null);
    if (s === 'notificacoes' && open !== s && unread > 0) {
      // abriu a lista: marca tudo como lido (a bolinha some)
      db.rpc('mark_notifications_read', { p_ids: null }).then(() => {
        setNotifs((l) => (l ?? []).map((n) => ({ ...n, read: true })));
      });
    }
  }

  async function saveProfile() {
    setBusy(true); setError(null); setMsg(null);
    const { error: e } = await db.rpc('set_my_profile', { p_display_name: name, p_bio: bio });
    setBusy(false);
    if (e) { setError(friendlyError(e)); return; }
    await refreshProfile();
    setMsg('Perfil salvo.');
  }

  async function changePhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (r.canceled || !r.assets[0]) return;
    setBusy(true); setError(null);
    try {
      const key = await uploadPhoto(r.assets[0].uri, 'post');
      const { error: e } = await db.rpc('set_my_avatar', { p_key: key });
      if (e) throw e;
      await refreshProfile();
      setMsg('Foto trocada.');
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }

  async function setPref(k: 'equipes' | 'eventos' | 'social', v: boolean) {
    const next = { ...prefs, [k]: v };
    const { error: e } = await db.rpc('set_notify_prefs', { p_equipes: next.equipes, p_eventos: next.eventos, p_social: next.social });
    if (e) { setError(friendlyError(e)); return; }
    await refreshProfile();
  }

  async function exportData() {
    setBusy(true); setError(null);
    const { data, error: e } = await db.rpc('my_data_export');
    setBusy(false);
    if (e) { setError(friendlyError(e)); return; }
    const json = JSON.stringify(data, null, 2);
    const file = `marcha-gps-${profile?.username ?? 'dados'}.json`;
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = file; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } else {
      await Share.share({ title: file, message: json });
    }
    setMsg('Pronto: seus dados foram baixados (arquivo .json).');
  }

  async function deleteAccount() {
    if (!profile) return;
    setDeleting(true); setError(null);
    const { error: e } = await db.rpc('delete_my_account', { p_confirm: confirmText });
    if (e) { setDeleting(false); setError(friendlyError(e)); return; }
    // apaga também o login (Clerk). Se não der, pelo menos sai da conta: o perfil já foi apagado.
    try { await user?.delete(); } catch (x) { console.warn('conta: apagar login', x); }
    await signOut().catch(() => {});
    setDeleting(false);
  }

  if (!profile) return <Screen><Title>Conta</Title><ActivityIndicator color={colors.neon} /></Screen>;
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <Screen>
      <Title>Conta</Title>

      {/* cabeçalho */}
      <Pressable onPress={() => router.push(`/perfil/${profile.username}` as never)} accessibilityRole="button"
                 accessibilityLabel="Ver meu perfil" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar username={profile.username} avatarKey={profile.avatar_key} size={68} ring={colors.neon} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }} numberOfLines={1}>
            {profile.display_name || `@${profile.username}`}
          </Text>
          {profile.display_name ? <Text style={{ color: colors.textDim }}>@{profile.username}</Text> : null}
          {email ? <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={1}>{email}</Text> : null}
          <Text style={{ color: colors.neon, fontSize: 13, fontWeight: '700', marginTop: 2 }}>Ver meu perfil ›</Text>
        </View>
      </Pressable>

      <ErrorText>{error}</ErrorText>
      {msg && <Card accent={colors.neon}><Text style={{ color: colors.neon, fontWeight: '700' }}>{msg}</Text></Card>}

      {/* ---------- Editar perfil ---------- */}
      <Row icon="edit" title="Editar perfil" sub="Nome, bio e foto" open={open === 'perfil'} onPress={() => toggle('perfil')} />
      {open === 'perfil' && (
        <Card style={{ gap: 12 }}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Avatar username={profile.username} avatarKey={profile.avatar_key} size={86} ring={colors.neon} />
            <Button title="Trocar foto" variant="secondary" onPress={changePhoto} loading={busy} />
          </View>
          <Field label="Nome (aparece no perfil)" value={name} onChangeText={setName} maxLength={40} placeholder="Ex.: Gustavo" />
          <Field label={`Bio (${bio.length}/300)`} value={bio} onChangeText={setBio} maxLength={300} multiline
                 placeholder="Fala do seu carro, da sua equipe…" style={{ minHeight: 90, textAlignVertical: 'top' }} />
          <Body dim>O @ não muda: é como a galera te acha.</Body>
          <Button title="Salvar perfil" onPress={saveProfile} loading={busy} />
        </Card>
      )}

      {/* ---------- Notificações ---------- */}
      <Row icon="bell" title="Notificações" badge={unread}
           sub={profile.is_master ? 'Equipes pedidas, aprovações, eventos e comentários' : 'Aprovações, eventos e comentários'}
           open={open === 'notificacoes'} onPress={() => toggle('notificacoes')} />
      {open === 'notificacoes' && (
        <View style={{ gap: 10 }}>
          <Card style={{ gap: 4 }}>
            <Label>O que você quer receber</Label>
            <Toggle label="Equipes" sub={profile.is_master ? 'Equipes novas pedidas, pedidos pra entrar, aprovações' : 'Pedidos pra entrar, aprovações, verificação'}
                    value={prefs.equipes} onChange={(v) => setPref('equipes', v)} />
            <Toggle label="Eventos" sub="Evento novo das suas equipes" value={prefs.eventos} onChange={(v) => setPref('eventos', v)} />
            <Toggle label="Social" sub="Comentários nos seus posts e convites usados" value={prefs.social} onChange={(v) => setPref('social', v)} />
          </Card>
          {notifs === null ? <ActivityIndicator color={colors.neon} /> : notifs.length === 0 ? (
            <Body dim>Nada por aqui ainda. Quando tiver aprovação, evento ou comentário, aparece aqui.</Body>
          ) : notifs.map((n) => (
            <Pressable key={n.id} disabled={!n.link} onPress={() => n.link && router.push(n.link as never)} accessibilityRole="button"
                       style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1,
                                                  borderColor: n.read ? colors.line : colors.neon,
                                                  backgroundColor: pressed ? colors.panelAlt : colors.panel })}>
              <IconBadge name={KIND_ICON[n.kind] ?? 'bell'} size={36} color={n.read ? colors.textDim : colors.neon} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{n.title}</Text>
                {n.body ? <Text style={{ color: colors.textDim }}>{n.body}</Text> : null}
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{ago(n.created_at)}</Text>
              </View>
            </Pressable>
          ))}
          <Body dim>Por enquanto os avisos ficam aqui no app (com a bolinha na aba Conta).</Body>
        </View>
      )}

      {/* ---------- Privacidade e dados ---------- */}
      <Row icon="lock" title="Privacidade e dados" sub="Quem vê seu carro, zonas privadas, seus dados"
           open={open === 'privacidade'} onPress={() => toggle('privacidade')} />
      {open === 'privacidade' && (
        <View style={{ gap: 10 }}>
          <Card style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Localização</Text>
            <Body dim>
              Agora: {profile.visibility === 'ghost' ? 'modo fantasma (ninguém te vê)' : profile.visibility === 'crew' ? 'só suas equipes' : 'Cena ao vivo'}
              {profile.delay_minutes ? ` · com ${profile.delay_minutes} min de atraso` : ''}.
              Perto de casa/trabalho você some do mapa (zonas privadas). A velocidade nunca é guardada.
            </Body>
            <Button title="Quem vê meu carro e zonas privadas" variant="secondary" onPress={() => router.push('/visibilidade')} />
          </Card>
          <Card style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Seus dados</Text>
            <Body dim>Baixe tudo o que o app guarda sobre você: perfil, carros, equipes, posts, comentários, avisos, presenças e zonas privadas.</Body>
            <Button title="Baixar meus dados" variant="secondary" onPress={exportData} loading={busy} />
          </Card>
          <Card style={{ gap: 8, borderColor: colors.danger }}>
            <Text style={{ color: colors.danger, fontWeight: '700' }}>Apagar minha conta</Text>
            <Body dim>
              Apaga perfil, carros, fotos no perfil, posts, comentários e presenças. Não dá pra desfazer.
              Se você fundou uma equipe que tem membros, passe a equipe pra alguém antes.
            </Body>
            <Text style={{ color: colors.textDim }}>Pra confirmar, digite seu @: <Text style={{ fontFamily: fonts.mono, color: colors.text }}>{profile.username}</Text></Text>
            <TextInput value={confirmText} onChangeText={setConfirmText} autoCapitalize="none" autoCorrect={false}
                       placeholder={profile.username} placeholderTextColor={colors.textMuted} accessibilityLabel="Digite seu nome de usuário"
                       style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg,
                                color: colors.text, paddingHorizontal: 12, fontSize: 16 }} />
            <Button title="Apagar minha conta pra sempre" color={colors.danger} variant="secondary" loading={deleting}
                    disabled={confirmText.trim().toLowerCase() !== profile.username} onPress={deleteAccount} />
          </Card>
        </View>
      )}

      {/* ---------- atalhos ---------- */}
      <Row icon="trophy" title="Ranks" sub="Radar e mídia de eventos" onPress={() => router.push('/ranks')} />
      <Row icon="map" title="Visual e câmera do mapa" onPress={() => router.push('/camera-mapa')} />
      <Row icon="help" title="Como usar o app" onPress={() => router.push('/tutorial')} />

      <View style={{ height: 8 }} />
      <Button title="Sair da conta" variant="secondary" onPress={() => signOut()} />
      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', fontFamily: fonts.mono }}>
        {profile.joined_at ? `Na cena desde ${new Date(profile.joined_at).toLocaleDateString('pt-BR')}` : ''}
      </Text>
    </Screen>
  );
}

function Row({ icon, title, sub, open, badge, onPress }: {
  icon: IconName; title: string; sub?: string; open?: boolean; badge?: number; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={open != null ? { expanded: open } : undefined}
               accessibilityLabel={`${title}${badge ? `, ${badge} novas` : ''}`}
               style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: 14,
                                          borderRadius: 16, borderWidth: 1, borderColor: open ? colors.neon : colors.line,
                                          backgroundColor: pressed ? colors.panelAlt : colors.panel })}>
      <IconBadge name={icon} />
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        {sub ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>{sub}</Text> : null}
      </View>
      {badge ? (
        <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center',
                       justifyContent: 'center', paddingHorizontal: 6 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      <Text style={{ color: colors.textMuted, fontSize: 20 }}>{open === undefined ? '›' : open ? '⌃' : '⌄'}</Text>
    </Pressable>
  );
}

function Toggle({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label}
              trackColor={{ true: colors.neon, false: colors.lineStrong }} thumbColor={value ? colors.bg : colors.textDim} />
    </View>
  );
}
