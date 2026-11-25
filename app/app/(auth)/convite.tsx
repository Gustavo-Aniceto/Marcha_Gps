// Primeiro acesso: usa o código de convite e escolhe o nome de usuário.
import React, { useEffect, useState } from 'react';
import { Body, Button, ErrorText, Field, Screen, Title } from '../../src/components/ui';
import { db } from '../../src/lib/db';
import { useSession } from '../../src/lib/session';
import { friendlyError } from '../../src/lib/errors.ts';
import { clearPendingInvite, formatInviteCode, loadPendingInvite } from '../../src/lib/pendingInvite';

export default function Convite() {
  const { refreshProfile, signOut } = useSession();
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromBefore, setFromBefore] = useState(false);

  // convite digitado antes do login: já vem preenchido
  useEffect(() => { loadPendingInvite().then((p) => { if (p) { setCode(p.code); setFromBefore(true); } }); }, []);

  async function redeem() {
    setError(null); setBusy(true);
    const { error: e } = await db.rpc('redeem_invite', {
      p_code: code.trim().toUpperCase(),
      p_username: username.trim().toLowerCase(),
    });
    setBusy(false);
    if (e) { setError(friendlyError(e)); return; }
    await clearPendingInvite();
    await refreshProfile(); // o Gate leva pro cadastro/mapa
  }

  return (
    <Screen>
      <Title>{fromBefore ? 'Escolha seu nome' : 'Tem convite?'}</Title>
      <Body dim>
        O Marcha GPS mostra onde seu carro está, então cada pessoa entra pela mão de alguém da cena, que responde por ela.
        Depois de entrar, você pede pra entrar na sua equipe e o fundador dela aprova.
      </Body>
      {!fromBefore && (
        <Field label="Código de convite" value={code} onChangeText={(t) => setCode(formatInviteCode(t))} autoCapitalize="characters"
               placeholder="Ex.: 7K2Q-LF9A" maxLength={9} />
      )}
      <Field label="Nome de usuário" value={username} onChangeText={setUsername} autoCapitalize="none"
             placeholder="ex.: vini.fixa" maxLength={24} />
      <ErrorText>{error}</ErrorText>
      <Button title="Entrar no Marcha GPS" onPress={redeem} loading={busy}
              disabled={code.trim().length < 9 || username.trim().length < 3} />
      {fromBefore && (
        <Button title="Usar outro convite" variant="secondary" onPress={() => { setFromBefore(false); setCode(''); clearPendingInvite(); }} />
      )}
      <Button title="Sair" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
