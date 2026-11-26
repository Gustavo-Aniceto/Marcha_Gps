// Denunciar (post, comentário, perfil ou aviso) e, junto, bloquear a pessoa se quiser.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorText } from './ui';
import { Icon } from './Icon';
import { db } from '../lib/db';
import { friendlyError } from '../lib/errors.ts';
import { TARGET_NAME, canSend, reasonsFor, type ReportReason, type ReportTarget } from '../lib/moderation.ts';
import { colors, corner } from '../theme/tokens.ts';

export interface ReportWhat { type: ReportTarget; id: string; username?: string | null }

export function ReportSheet({ what, onClose, onDone }: {
  what: ReportWhat | null; onClose: () => void; onDone?: (r: { blocked: boolean }) => void;
}) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [block, setBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => { setReason(null); setNote(''); setBlock(false); setError(null); setSent(false); }, [what]);
  if (!what) return null;
  const canBlock = !!what.username && what.type !== 'aviso';

  async function send() {
    if (!what || !reason) return;
    setBusy(true); setError(null);
    const { error: e } = await db.rpc('report_content', { p_type: what.type, p_id: what.id, p_reason: reason, p_note: note.trim() || null });
    if (e) { setBusy(false); setError(friendlyError(e)); return; }
    if (block && what.username) {
      const { error: b } = await db.rpc('block_user', { p_username: what.username });
      if (b) { setBusy(false); setError(friendlyError(b)); return; }
    }
    setBusy(false); setSent(true);
    onDone?.({ blocked: block });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
      <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} accessibilityViewIsModal>
        <View style={s.grab} />
        {sent ? (
          <View style={{ gap: 12, paddingVertical: 12 }}>
            <Icon name="shield" size={34} color={colors.neon} />
            <Text style={s.title}>Recebemos, valeu</Text>
            <Text style={s.body}>
              O Adm Master vai olhar. Quem denunciou não aparece pra ninguém.
              {block ? ` Você bloqueou @${what.username}: vocês não veem mais posts, comentários nem o carro um do outro.` : ''}
            </Text>
            <Button title="Fechar" onPress={onClose} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            <Text style={s.title} accessibilityRole="header">Denunciar {TARGET_NAME[what.type]}</Text>
            <Text style={s.body}>Qual é o problema?</Text>
            <View style={s.card}>
              {reasonsFor(what.type).map((r, i) => {
                const on = reason === r.value;
                return (
                  <Pressable key={r.value} onPress={() => setReason(r.value)} accessibilityRole="radio"
                             accessibilityState={{ checked: on }} accessibilityLabel={`${r.label}. ${r.sub}`}
                             style={[s.row, i > 0 && s.rowLine]}>
                    <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle}>{r.label}</Text>
                      <Text style={s.rowSub}>{r.sub}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <TextInput value={note} onChangeText={setNote} placeholder={reason === 'outro' ? 'Conte o que aconteceu (obrigatório)' : 'Quer contar mais? (opcional)'}
                       placeholderTextColor={colors.textMuted} multiline maxLength={500} accessibilityLabel="Detalhes da denúncia"
                       style={s.input} />
            {canBlock && (
              <View style={[s.card, s.row]}>
                <Icon name="block" size={22} color={colors.textDim} />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>Bloquear @{what.username} também</Text>
                  <Text style={s.rowSub}>Vocês param de ver os posts, comentários e o carro um do outro</Text>
                </View>
                <Switch value={block} onValueChange={setBlock} accessibilityLabel={`Bloquear @${what.username}`}
                        trackColor={{ true: colors.neon, false: colors.lineStrong }} thumbColor={block ? colors.bg : colors.textDim} />
              </View>
            )}
            <ErrorText>{error}</ErrorText>
            <Button title="Enviar denúncia" onPress={send} loading={busy} disabled={!canSend(reason, note)} />
            <Text style={s.note}>Use pra coisas que quebram as regras (veja os Termos de uso). Denúncia falsa de propósito pode tirar você do app.</Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '90%', backgroundColor: colors.bg,
           borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: colors.line,
           paddingHorizontal: 18, paddingTop: 8, width: '100%', maxWidth: 640, alignSelf: 'center' },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, marginBottom: 10 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  body: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.panel, borderRadius: corner.card, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.neon },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.neon },
  input: { minHeight: 70, borderRadius: corner.field, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelAlt,
           color: colors.text, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, textAlignVertical: 'top' },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
});
