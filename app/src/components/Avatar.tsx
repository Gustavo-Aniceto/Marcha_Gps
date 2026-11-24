// Foto de perfil redonda; sem foto, mostra a inicial do @.
import React from 'react';
import { Image, Text, View } from 'react-native';
import { photoUrl } from '../lib/photos';
import { colors, fonts } from '../theme/tokens.ts';

export function Avatar({ username, avatarKey, size = 40, ring }: { username: string; avatarKey?: string | null; size?: number; ring?: string }) {
  const url = photoUrl(avatarKey);
  const style = { width: size, height: size, borderRadius: size / 2, borderWidth: ring ? 2 : 1, borderColor: ring ?? colors.lineStrong };
  if (url) return <Image source={{ uri: url }} style={style} accessibilityLabel={`Foto de @${username}`} />;
  return (
    <View style={[style, { backgroundColor: colors.panelAlt, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: colors.holo, fontFamily: fonts.display, fontSize: size * 0.42 }}>{(username[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}
