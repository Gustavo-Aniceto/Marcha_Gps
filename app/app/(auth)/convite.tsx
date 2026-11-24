// Primeiro acesso: usa o código de convite e escolhe o nome de usuário.
import React, { useState } from 'react';
import { Body, Button, ErrorText, Field, Screen, Title } from '../../src/components/ui';
import { db } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';
import { friendlyError } from '../../src/lib/errors.ts';

export default function Convite() {
  const { refreshProfile, signOut } = useSession();
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function redeem() {
    setError(null); setBusy(true);
    const { error: e } = await db.rpc('redeem_invite', {
      p_code: code.trim().toUpperCase(),
      p_username: username.trim().toLowerCase(),
    });
    setBusy(false);
    if (e) { setError(friendlyError(e)); return; }
    await refreshProfile(); // o Gate leva pro cadastro/mapa
  }

  return (
    <Screen>
      <Title>Tem convite?</Title>
      <Body dim>
        O Marcha GPS mostra onde seu carro está, então cada pessoa entra pela mão de alguém da cena, que responde por ela.
        Depois de entrar, sua equipe ainda confirma que você é de lá.
      </Body>
      <Field label="Código de convite" value={code} onChangeText={setCode} autoCapitalize="characters"
             placeholder="Ex.: 7K2Q-LF9A" maxLength={9} />
      <Field label="Nome de usuário" value={username} onChangeText={setUsername} autoCapitalize="none"
             placeholder="ex.: vini.fixa" maxLength={24} />
      <ErrorText>{error}</ErrorText>
      <Button title="Entrar no Marcha GPS" onPress={redeem} loading={busy}
              disabled={code.trim().length < 9 || username.trim().length < 3} />
      <Button title="Sair" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
