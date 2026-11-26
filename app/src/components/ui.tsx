// Peças básicas de interface no estilo do Marcha GPS.
import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, corner, fonts, radius, touch, type ButtonShape } from '../theme/tokens.ts';
import { inkOn, readableAccent } from '../lib/contrast.ts';
import { useRouter } from 'expo-router';
import { goBack } from '../lib/goBack';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {scroll
        ? <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        : <View style={[s.content, { flex: 1 }]}>{children}</View>}
    </SafeAreaView>
  );
}

/** Título da tela. Com `back`, ganha a setinha de voltar do lado (string = pra onde ir se não tiver tela anterior). */
export function Title({ children, back, sub }: { children: React.ReactNode; back?: boolean | string; sub?: string }) {
  const router = useRouter();
  const subLine = sub ? <Text style={s.sub}>{sub}</Text> : null;
  if (!back) return <View style={{ gap: 2 }}><Text style={s.title} accessibilityRole="header">{children}</Text>{subLine}</View>;
  return (
    <View style={{ gap: 2 }}>
    <View style={s.titleRow}>
      <Pressable onPress={() => goBack(router, typeof back === 'string' ? back : '/')} accessibilityRole="button"
                 accessibilityLabel="Voltar" hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}>
        <Text style={s.backChevron}>‹</Text>
      </Pressable>
      <Text style={[s.title, { flex: 1 }]} accessibilityRole="header" numberOfLines={2}>{children}</Text>
    </View>
    {subLine}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Body({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return <Text style={[s.body, dim && { color: colors.textMuted }]}>{children}</Text>;
}

export function Mono({ children, color = colors.holo }: { children: React.ReactNode; color?: string }) {
  return <Text style={[s.mono, { color }]}>{children}</Text>;
}

export function Card({ children, style, accent }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: string }) {
  return <View style={[s.card, accent ? { borderColor: accent } : null, style]}>{children}</View>;
}

export function Button({
  title, onPress, variant = 'primary', color = colors.neon, shape = 'reto', loading, disabled,
}: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'warn';
  color?: string; shape?: ButtonShape; loading?: boolean; disabled?: boolean;
}) {
  const fill = variant === 'warn' ? colors.warn : color;
  const filled = variant !== 'secondary';
  const textColor = filled ? inkOn(fill) : readableAccent(color);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.button,
        { borderRadius: radius[shape], opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        filled ? { backgroundColor: fill } : { borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.panelAlt },
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[s.buttonText, { color: textColor }]}>{title}</Text>}
    </Pressable>
  );
}

export function Pills<T extends string | number>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.pills}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [s.pill, on ? s.pillOn : null, pressed && { opacity: 0.8 }]}
          >
            <Text style={[s.pillText, { color: on ? colors.neon : colors.textDim }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <TextInput placeholderTextColor={colors.textMuted} style={[s.input, style]} {...rest} />
    </View>
  );
}

export function Warning({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.warning}>
      <Text style={{ color: colors.warnText, fontSize: 13, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={{ color: colors.danger, fontSize: 13 }} accessibilityLiveRegion="polite">{children}</Text>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // em tablet o conteúdo não estica: fica numa coluna centralizada, como nos apps de celular
  // embaixo sobra espaço pra barra flutuante de vidro (GlassTabBar) não cobrir o fim da tela
  content: { padding: 20, paddingTop: 16, paddingBottom: 112, gap: 14, width: '100%', maxWidth: 640, alignSelf: 'center' },
  title: { color: colors.text, fontFamily: fonts.display, fontWeight: '800', fontSize: 28, letterSpacing: -0.7 },
  sub: { color: colors.textMuted, fontSize: 13 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.line,
             alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelAlt },
  backChevron: { color: colors.text, fontSize: 24, lineHeight: 26, marginTop: -2 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  mono: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.4 },
  card: { backgroundColor: colors.panel, borderColor: colors.line, borderTopColor: colors.lineStrong, borderWidth: 1,
          borderRadius: corner.card, padding: 16, gap: 10 },
  button: { minHeight: 52, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    minHeight: touch, minWidth: touch, paddingHorizontal: 16, borderRadius: corner.chip, borderWidth: 1,
    borderColor: colors.line, backgroundColor: colors.panelAlt, alignItems: 'center', justifyContent: 'center',
  },
  pillOn: { backgroundColor: 'rgba(201,238,98,0.12)', borderColor: 'rgba(201,238,98,0.55)' },
  pillText: { fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: 50, borderRadius: corner.field, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelAlt,
    color: colors.text, paddingHorizontal: 14, fontSize: 16,
  },
  warning: { backgroundColor: colors.warnBg, borderColor: 'rgba(255,138,31,0.45)', borderWidth: 1, borderRadius: corner.field, padding: 12 },
});
