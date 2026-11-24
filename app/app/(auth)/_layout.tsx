import { Stack } from 'expo-router';
import { colors } from '../../src/theme/tokens.ts';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
