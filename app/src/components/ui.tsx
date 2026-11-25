// Peças básicas de interface no estilo do Marcha GPS.
import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, touch, type ButtonShape } from '../theme/tokens.ts';
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
export function Title({ children, back }: { children: React.ReactNode; back?: boolean | string }) {
  const router = useRouter();
  if (!back) return <Text style={s.title} accessibilityRole="header">{children}</Text>;
  return (
    <View style={s.titleRow}>
      <Pressable onPress={() => goBack(router, typeof back === 'string' ? back : '/')} accessibilityRole="button"
                 accessibilityLabel="Voltar" hitSlop={10} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}>
        <Text style={s.backChevron}>‹</Text>
      </Pressable>
      <Text style={[s.title, { flex: 1 }]} accessibilityRole="header" numberOfLines={2}>{children}</Text>
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
        filled ? { backgroundColor: fill } : { borderWidth: 1, borderColor: readableAccent(color) },
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
            style={[s.pill, on ? { backgroundColor: colors.neon, borderColor: colors.neon } : null]}
          >
            <Text style={[s.pillText, { color: on ? colors.ink : colors.text }]}>{o.label}</Text>
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
  content: { padding: 20, gap: 14 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 26 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.lineStrong,
             alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel },
  backChevron: { color: colors.holo, fontSize: 24, lineHeight: 26, marginTop: -2 },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  mono: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.6 },
  card: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 8, padding: 14, gap: 8 },
  button: { minHeight: 52, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    minHeight: touch, minWidth: touch, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1,
    borderColor: colors.line, backgroundColor: colors.panelAlt, alignItems: 'center', justifyContent: 'center',
  },
  pillText: { fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelAlt,
    color: colors.text, paddingHorizontal: 14, fontSize: 16,
  },
  warning: { backgroundColor: colors.warnBg, borderColor: colors.warn, borderWidth: 1, borderRadius: 8, padding: 12 },
});
