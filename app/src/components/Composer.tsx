// Caixa de postar (feed e perfil): post com foto, foto do carro ou enquete.
import React, { useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, ErrorText, Pills } from './ui';
import { Avatar } from './Avatar';
import { db } from '../lib/db';
import { useSession } from '../lib/session';
import { friendlyError } from '../lib/errors.ts';
import { uploadPhoto } from '../lib/photos';
import { createPoll, type PostKind } from '../lib/social';
import { pollProblem } from '../lib/poll.ts';
import { colors } from '../theme/tokens.ts';

const MODES: { value: PostKind; label: string }[] = [
  { value: 'post', label: 'Post' },
  { value: 'carro', label: '📷 Foto do carro' },
  { value: 'enquete', label: '📊 Enquete' },
];

export function Composer({ crewId = null, scopeName = 'todo mundo', onPosted, initialMode = 'post' }: {
  crewId?: string | null; scopeName?: string; onPosted: () => void; initialMode?: PostKind;
}) {
  const { profile } = useSession();
  const [mode, setMode] = useState<PostKind>(initialMode);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [options, setOptions] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // fechada ocupa uma linha só; abre ao tocar (economiza tela no feed e no perfil)
  const [open, setOpen] = useState(false);

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled && r.assets[0]) { setPhoto(r.assets[0].uri); setError(null); }
  }

  function reset() { setText(''); setPhoto(null); setOptions(['', '']); setOpen(false); }

  async function publish() {
    if (!profile) return;
    setError(null);
    if (mode === 'enquete') {
      const problem = pollProblem(text, options);
      if (problem) { setError(problem); return; }
    } else if (mode === 'carro' && !photo) {
      setError('Escolhe a foto do carro.'); return;
    } else if (!text.trim() && !photo) {
      setError('Escreve alguma coisa ou põe uma foto.'); return;
    }
    setBusy(true);
    try {
      if (mode === 'enquete') {
        await createPoll(text.trim(), options.map((o) => o.trim()).filter(Boolean), crewId);
      } else {
        const photo_key = photo ? await uploadPhoto(photo, 'post') : null;
        const { error: e } = await db.from('posts').insert({
          author_id: profile.id, crew_id: crewId, kind: mode, photo_key,
          body: text.trim() || (mode === 'carro' ? '📷 Meu carro' : '📸'),
        });
        if (e) throw e;
      }
      reset();
      onPosted();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const placeholder = mode === 'enquete' ? 'Pergunta da enquete (ex.: qual aro fica melhor?)'
    : mode === 'carro' ? 'Legenda da foto (opcional): setup, rodas, altura…'
    : `Fala pra ${scopeName}… rolê, setup, foto`;

  if (!open && !text && !photo) {
    const quick = (m: PostKind) => { setMode(m); setError(null); setOpen(true); };
    return (
      <View style={{ backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10,
                     flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {profile && <Avatar username={profile.username} avatarKey={profile.avatar_key} size={36} />}
        <Pressable onPress={() => quick('post')} accessibilityRole="button" accessibilityLabel="Escrever post"
                   style={{ flex: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 22,
                            borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg }}>
          <Text style={{ color: colors.textMuted, fontSize: 15 }} numberOfLines={1}>Fala pra {scopeName}…</Text>
        </Pressable>
        <Pressable onPress={() => quick('carro')} accessibilityRole="button" accessibilityLabel="Postar foto do carro" hitSlop={4}
                   style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20 }}>📷</Text>
        </Pressable>
        <Pressable onPress={() => quick('enquete')} accessibilityRole="button" accessibilityLabel="Criar enquete" hitSlop={4}
                   style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20 }}>📊</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, gap: 10 }}>
      <Pills options={MODES} value={mode} onChange={(m) => { setMode(m); setError(null); }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {profile && <Avatar username={profile.username} avatarKey={profile.avatar_key} />}
        <TextInput value={text} onChangeText={setText} multiline autoFocus maxLength={mode === 'enquete' ? 300 : 1000}
                   placeholder={placeholder} placeholderTextColor={colors.textMuted}
                   style={{ flex: 1, minHeight: mode === 'enquete' ? 44 : 60, color: colors.text, fontSize: 15, textAlignVertical: 'top' }}
                   accessibilityLabel={mode === 'enquete' ? 'Pergunta da enquete' : 'Escrever post'} />
      </View>

      {mode === 'enquete' && (
        <View style={{ gap: 8 }}>
          {options.map((o, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput value={o} maxLength={60} placeholder={`Opção ${i + 1}`} placeholderTextColor={colors.textMuted}
                         onChangeText={(v) => setOptions((list) => list.map((x, j) => (j === i ? v : x)))}
                         accessibilityLabel={`Opção ${i + 1}`}
                         style={{ flex: 1, minHeight: 44, color: colors.text, fontSize: 15, paddingHorizontal: 12,
                                  borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.bg }} />
              {options.length > 2 && (
                <Pressable onPress={() => setOptions((list) => list.filter((_, j) => j !== i))} accessibilityRole="button"
                           accessibilityLabel={`Tirar opção ${i + 1}`} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.textMuted, fontSize: 18 }}>✕</Text>
                </Pressable>
              )}
            </View>
          ))}
          {options.length < 4 && (
            <Pressable onPress={() => setOptions((list) => [...list, ''])} accessibilityRole="button" style={{ minHeight: 40, justifyContent: 'center' }}>
              <Text style={{ color: colors.holo, fontWeight: '600' }}>+ Mais uma opção</Text>
            </Pressable>
          )}
        </View>
      )}

      {mode !== 'enquete' && photo && (
        <View>
          <Image source={{ uri: photo }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 8 }} accessibilityLabel="Foto escolhida" />
          <Pressable onPress={() => setPhoto(null)} accessibilityRole="button"
                     style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: colors.text }}>Tirar</Text>
          </Pressable>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {mode !== 'enquete' && (
          <View style={{ flex: 1 }}>
            <Button title={photo ? 'Trocar foto' : mode === 'carro' ? '📷 Escolher foto' : '📷 Foto'} variant="secondary" onPress={pickPhoto} />
          </View>
        )}
        <View style={{ flex: 1 }}><Button title={mode === 'enquete' ? 'Criar enquete' : 'Postar'} onPress={publish} loading={busy} /></View>
      </View>
      {!busy && (
        <Pressable onPress={reset} accessibilityRole="button" style={{ minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted }}>Cancelar</Text>
        </Pressable>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
