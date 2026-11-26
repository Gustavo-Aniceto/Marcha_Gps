// Denunciar e bloquear: os motivos, os textos e as chamadas ao banco.
// As regras ficam no banco (report_content, block_user...): aqui só o que a tela precisa.

export type ReportTarget = 'post' | 'comment' | 'profile' | 'aviso';
export type ReportReason = 'ofensivo' | 'spam' | 'golpe' | 'perigoso' | 'falso' | 'privacidade' | 'outro';

export const REASONS: { value: ReportReason; label: string; sub: string; on: ReportTarget[] }[] = [
  { value: 'ofensivo', label: 'Ofensivo ou ódio', sub: 'Xingamento, preconceito, ameaça, assédio', on: ['post', 'comment', 'profile'] },
  { value: 'perigoso', label: 'Perigoso', sub: 'Racha, manobra na rua, incentivo a crime', on: ['post', 'comment', 'profile'] },
  { value: 'golpe', label: 'Golpe ou venda suspeita', sub: 'Pede dinheiro, Pix, link estranho', on: ['post', 'comment', 'profile'] },
  { value: 'privacidade', label: 'Expõe alguém', sub: 'Placa, endereço, foto ou dado de outra pessoa', on: ['post', 'comment', 'profile'] },
  { value: 'spam', label: 'Spam', sub: 'Propaganda repetida, nada a ver com a cena', on: ['post', 'comment', 'profile'] },
  { value: 'falso', label: 'Não existe / está errado', sub: 'O aviso não está lá ou é trote', on: ['aviso'] },
  { value: 'outro', label: 'Outro motivo', sub: 'Conte no campo abaixo', on: ['post', 'comment', 'profile', 'aviso'] },
];

export function reasonsFor(t: ReportTarget) {
  return REASONS.filter((r) => r.on.includes(t));
}

export const TARGET_NAME: Record<ReportTarget, string> = {
  post: 'post', comment: 'comentário', profile: 'perfil', aviso: 'aviso',
};

/** O "outro" pede pelo menos uma explicação curta. */
export function canSend(reason: ReportReason | null, note: string): boolean {
  if (!reason) return false;
  if (reason === 'outro') return note.trim().length >= 5;
  return note.length <= 500;
}

export interface ModerationItem {
  target_type: ReportTarget; target_id: string; owner_username: string | null; reports: number;
  reasons: ReportReason[]; notes: string[]; first_at: string; last_at: string; hidden: boolean;
  preview: string | null; photo_key: string | null; link: string | null;
}

export interface HealthService { service: string; ok: boolean; detail: string | null; ms: number | null; checked_at: string; changed_at: string }
export interface HealthError { message: string; screen: string | null; version: string | null; hits: number; people: number;
  first_at: string; last_at: string; stack: string | null; user_agent: string | null }
export interface Health { services: HealthService[]; errors: HealthError[]; errors_24h: number }

export const SERVICE_NAME: Record<string, string> = {
  dados: 'Banco de dados', busca: 'Busca de lugares', rotas: 'Rotas', mapa: 'Mapa', site: 'Site',
  login_teste: 'Login (modo teste)', login_producao: 'Login (produção)',
};

export function reasonLabel(r: string): string {
  return REASONS.find((x) => x.value === r)?.label ?? r;
}
