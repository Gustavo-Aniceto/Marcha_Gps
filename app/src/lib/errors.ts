// Códigos de erro que as funções do banco levantam -> mensagem pro usuário.

const MESSAGES: Record<string, string> = {
  not_authenticated: 'Entre na sua conta de novo.',
  'JWT expired': 'Sua sessão venceu. Entre de novo.',
  'jwt expired': 'Sua sessão venceu. Entre de novo.',
  no_profile: 'Você ainda não entrou com um convite.',
  forbidden: 'Você não tem permissão pra isso.',
  invite_not_found: 'Código de convite não encontrado.',
  invite_used: 'Esse convite já foi usado.',
  invite_expired: 'Esse convite venceu. Peça outro.',
  own_invite: 'Você não pode usar o próprio convite.',
  already_registered: 'Você já tem conta.',
  already_member: 'Você já está nessa equipe.',
  username_required: 'Escolha um nome de usuário.',
  no_invites_left: 'Seus convites acabaram.',
  crew_not_active: 'Essa equipe está suspensa.',
  cannot_vouch_self: 'Você não pode confirmar você mesmo.',
  member_not_found: 'Membro não encontrado.',
  outside_area: 'Por enquanto o Marcha GPS funciona só em São Paulo, Guarulhos e Itaquá.',
  invalid_speed: 'Escolha a velocidade da placa (de 10 em 10 km/h).',
  invalid_poll: 'A enquete precisa de uma pergunta e de 2 a 4 opções (até 60 letras cada).',
  rate_limited: 'Muitos avisos seguidos. Espera um pouco.',
  cannot_vote_own_report: 'Esse aviso é seu: espera a galera confirmar.',
  report_not_active: 'Esse aviso não está mais ativo.',
  not_crew_member: 'Só membro verificado da equipe faz a mídia.',
  outside_event_time: 'Fora do horário do evento.',
  outside_event_area: 'Você precisa estar no local do evento.',
  already_submitted: 'Você já fez a mídia desse evento.',
  invalid_photo: 'Foto inválida. Tira de novo pelo app.',
  too_many_cars: 'Cabem até 5 carros na garagem. Tira um pra colocar outro.',
  car_not_found: 'Esse carro não está na sua garagem.',
  invalid_visibility: 'Escolha quem pode ver seu carro de novo.',
  upload_failed: 'Não deu pra enviar a foto. Confere a internet e tenta de novo.',
  photo_too_big: 'Foto muito grande (máximo 8 MB).',
  contest_window_closed: 'Passou o prazo de 24 h pra contestar.',
};

// regra do banco (check) que barrou o dado -> o que a pessoa precisa arrumar
const CHECKS: Record<string, string> = {
  profiles_username_check: 'Nome de usuário: 3 a 24 letras minúsculas, números, ponto ou _.',
  cars_year_check: 'Ano do carro inválido: use 4 números (ex.: 2009).',
  cars_color_check: 'Cor inválida. Escolhe uma das cores.',
  cars_ride_height_cm_check: 'Altura inválida.',
  cars_rim_check: 'Aro inválido (13 a 22).',
  cars_camber_deg_check: 'Cambagem inválida.',
  cars_one_active_per_owner: 'Você já tem um carro ativo. Abre a garagem de novo e salva.',
  posts_carro_tem_foto: 'Foto do carro precisa de foto.',
};

export function friendlyError(err: unknown): string {
  const o = err && typeof err === 'object' ? (err as { message?: unknown; code?: unknown; details?: unknown }) : null;
  const raw = typeof err === 'string' ? err : o && 'message' in o ? String(o.message) : '';
  const all = `${raw} ${o?.details ? String(o.details) : ''}`;
  const code = Object.keys(MESSAGES).find((c) => raw === c || raw.includes(c));
  if (code) return MESSAGES[code];
  const check = Object.keys(CHECKS).find((c) => all.includes(c));
  if (check) return CHECKS[check];
  if (raw.includes('duplicate key') && raw.includes('username')) return 'Esse nome de usuário já existe.';
  if (raw.includes('row-level security') || o?.code === '42501') return 'O banco não deixou salvar isso com a sua conta. Sai e entra de novo; se continuar, me manda print.';
  if (/Failed to fetch|Network request failed|NetworkError|Load failed/i.test(raw)) return 'Sem conexão com o servidor. Confere a internet e tenta de novo.';
  // erro desconhecido: mostra o código pra dar pra descobrir o que foi
  const tech = [o?.code ? String(o.code) : null, raw ? raw.slice(0, 120) : null].filter(Boolean).join(': ');
  return tech ? `Deu ruim. Tenta de novo. (${tech})` : 'Deu ruim. Tenta de novo.';
}
