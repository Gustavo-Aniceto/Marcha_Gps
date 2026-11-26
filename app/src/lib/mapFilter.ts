// Filtro do mapa: o que aparece (carros e cada tipo de aviso). Puro, com testes.
// Os alertas de segurança durante a rota (radar à frente, obstáculo que pega no carro) NÃO seguem o filtro:
// esconder do mapa é só pra limpar a tela.
import type { ReportKind } from './reports.ts';

export type CarsShown = 'todos' | 'equipe' | 'nenhum';
export type ReportGroup = 'radar' | 'lombada' | 'buraco' | 'blitz' | 'alagamento';

export interface MapFilter {
  cars: CarsShown;
  groups: Record<ReportGroup, boolean>;
  onlyConfirmed: boolean;
}

export const DEFAULT_FILTER: MapFilter = {
  cars: 'todos',
  groups: { radar: true, lombada: true, buraco: true, blitz: true, alagamento: true },
  onlyConfirmed: false,
};

export const GROUPS: { id: ReportGroup; label: string; sub: string; kinds: ReportKind[] }[] = [
  { id: 'radar', label: 'Radares', sub: 'Com a velocidade da placa', kinds: ['radar'] },
  { id: 'lombada', label: 'Lombadas e valetas', sub: 'Lombada, valeta, rampa, faixa elevada, sonorizador',
    kinds: ['lombada', 'valeta', 'rampa', 'faixa_elevada', 'sonorizador'] },
  { id: 'buraco', label: 'Buracos e rua ruim', sub: 'Avisos da galera', kinds: ['buraco', 'rua_ruim'] },
  { id: 'blitz', label: 'Blitz', sub: 'Some sozinha em 1 hora', kinds: ['blitz'] },
  { id: 'alagamento', label: 'Alagamento', sub: 'Some sozinho em 6 horas', kinds: ['alagamento'] },
];

export function groupOf(kind: string): ReportGroup | null {
  return GROUPS.find((g) => (g.kinds as string[]).includes(kind))?.id ?? null;
}

/** Junta o que veio salvo com o padrão (campos novos ou estragados voltam pro padrão). */
export function normalizeFilter(raw: unknown): MapFilter {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<MapFilter>;
  const cars: CarsShown = r.cars === 'equipe' || r.cars === 'nenhum' ? r.cars : 'todos';
  const groups = { ...DEFAULT_FILTER.groups };
  for (const g of Object.keys(groups) as ReportGroup[]) {
    const v = (r.groups as Record<string, unknown> | undefined)?.[g];
    if (typeof v === 'boolean') groups[g] = v;
  }
  return { cars, groups, onlyConfirmed: r.onlyConfirmed === true };
}

export function filterReports<T extends { kind: string; status: string }>(list: T[], f: MapFilter): T[] {
  return list.filter((r) => {
    const g = groupOf(r.kind);
    if (g && !f.groups[g]) return false;
    if (f.onlyConfirmed && r.status !== 'confirmed') return false;
    return true;
  });
}

export function filterCars<T extends { same_crew: boolean }>(list: T[], f: MapFilter): T[] {
  return f.cars === 'nenhum' ? [] : f.cars === 'equipe' ? list.filter((c) => c.same_crew) : list;
}

/** Quantas coisas estão diferentes do padrão (pra mostrar no botão). */
export function activeCount(f: MapFilter): number {
  let n = f.cars !== 'todos' ? 1 : 0;
  for (const g of Object.keys(f.groups) as ReportGroup[]) if (!f.groups[g]) n++;
  return n + (f.onlyConfirmed ? 1 : 0);
}
