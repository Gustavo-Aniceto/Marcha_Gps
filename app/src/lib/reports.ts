// Tipos de aviso do Radar. Pontos e validade precisam bater com
// report_points() e report_ttl() em db/migrations/*_functions.sql.

export type ReportKind =
  | 'buraco' | 'lombada' | 'valeta' | 'rua_ruim' | 'rampa'
  | 'radar' | 'blitz' | 'alagamento' | 'sonorizador' | 'faixa_elevada';

export interface ReportKindInfo {
  kind: ReportKind;
  label: string;
  points: number;
  ttlMinutes: number; // até alguém confirmar (blitz e alagamento expiram mesmo confirmados)
  userCanReport: boolean; // sonorizador e faixa elevada só vêm da importação
}

const WEEK = 7 * 24 * 60;

export const REPORT_KINDS: ReportKindInfo[] = [
  { kind: 'buraco', label: 'Buraco', points: 15, ttlMinutes: WEEK, userCanReport: true },
  { kind: 'lombada', label: 'Lombada alta', points: 15, ttlMinutes: WEEK, userCanReport: true },
  { kind: 'valeta', label: 'Valeta funda', points: 15, ttlMinutes: WEEK, userCanReport: true },
  { kind: 'rua_ruim', label: 'Rua ruim', points: 10, ttlMinutes: WEEK, userCanReport: true },
  { kind: 'rampa', label: 'Rampa que raspa', points: 10, ttlMinutes: WEEK, userCanReport: true },
  { kind: 'radar', label: 'Radar', points: 5, ttlMinutes: WEEK, userCanReport: true },
  { kind: 'blitz', label: 'Blitz', points: 10, ttlMinutes: 60, userCanReport: true },
  { kind: 'alagamento', label: 'Alagamento', points: 10, ttlMinutes: 6 * 60, userCanReport: true },
  { kind: 'sonorizador', label: 'Sonorizador', points: 5, ttlMinutes: WEEK, userCanReport: false },
  { kind: 'faixa_elevada', label: 'Faixa elevada', points: 5, ttlMinutes: WEEK, userCanReport: false },
];

export const CONFIRMATIONS_NEEDED = 3;
export const CONFIRMER_POINTS = 3;
export const FALSE_REPORT_PENALTY = -5;

export function kindInfo(kind: ReportKind): ReportKindInfo {
  const info = REPORT_KINDS.find((k) => k.kind === kind);
  if (!info) throw new Error(`tipo de aviso desconhecido: ${kind}`);
  return info;
}

export function pointsText(kind: ReportKind): string {
  const i = kindInfo(kind);
  const ttl = kind === 'blitz' ? 'Blitz some sozinha em 1 hora.'
    : kind === 'alagamento' ? 'Alagamento some em 6 horas.'
    : 'Se ninguém confirmar em 7 dias, o aviso some.';
  return `${i.points} pontos no Radar quando ${CONFIRMATIONS_NEEDED} pessoas confirmarem. ${ttl}`;
}
