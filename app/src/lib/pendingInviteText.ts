// Textos e formato do código de convite (lógica pura, testada).

/** Formata enquanto digita: só letras/números, maiúsculo, com hífen no meio (XXXX-XXXX). */
export function formatInviteCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export function inviteStatusText(status: string): string {
  switch (status) {
    case 'usado': return 'Esse convite já foi usado. Peça um novo pra quem te convidou.';
    case 'vencido': return 'Esse convite venceu (vale 7 dias). Peça um novo pra quem te convidou.';
    default: return 'Convite não encontrado. Confira o código.';
  }
}
