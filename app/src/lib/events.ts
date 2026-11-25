// Regras de horário dos eventos (iguais às do banco: mídia abre 30 min antes e fecha no fim).

export type EventWindow = 'antes' | 'aberto' | 'acabou';

export const MEDIA_OPENS_BEFORE_MIN = 30;

export function eventWindow(startsAt: Date, endsAt: Date, now: Date = new Date()): EventWindow {
  if (now.getTime() > endsAt.getTime()) return 'acabou';
  if (now.getTime() < startsAt.getTime() - MEDIA_OPENS_BEFORE_MIN * 60_000) return 'antes';
  return 'aberto';
}

export type DayChoice = 'hoje' | 'amanha' | 'sabado' | 'domingo';

/** Data de início a partir de escolhas simples (dia + hora), no fuso do celular. */
export function startFrom(day: DayChoice, hour: number, now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  const add = (n: number) => d.setDate(d.getDate() + n);
  if (day === 'amanha') add(1);
  if (day === 'sabado') add((6 - now.getDay() + 7) % 7);
  if (day === 'domingo') add((7 - now.getDay()) % 7);
  if (d.getTime() <= now.getTime()) add(day === 'hoje' || day === 'amanha' ? 0 : 7);
  return d;
}

const KIND_LABEL = { encontro: 'Encontro', role: 'Rolê', pista: 'Pista' } as const;
export function kindLabel(kind: string): string {
  return KIND_LABEL[kind as keyof typeof KIND_LABEL] ?? kind;
}

export function whenText(startsAt: Date, now: Date = new Date()): string {
  const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const hh = String(startsAt.getHours()).padStart(2, '0');
  const mm = String(startsAt.getMinutes()).padStart(2, '0');
  const sameDay = startsAt.toDateString() === now.toDateString();
  const dd = `${String(startsAt.getDate()).padStart(2, '0')}/${String(startsAt.getMonth() + 1).padStart(2, '0')}`;
  return sameDay ? `hoje, ${hh}:${mm}` : `${dias[startsAt.getDay()]}, ${dd} · ${hh}:${mm}`;
}

// ---------- calendário do "Novo evento" ----------

export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto',
  'setembro', 'outubro', 'novembro', 'dezembro'];
export const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Semanas do mês (domingo a sábado); null = casinha vazia antes do dia 1 ou depois do último. */
export function monthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Dia que já passou (hoje ainda vale). */
export function isPastDay(d: Date, now: Date = new Date()): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d.getTime() < today.getTime();
}

/** Junta o dia escolhido no calendário com a hora e os minutos, no fuso do celular. */
export function atTime(day: Date, hour: number, minute: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
}

/** Mês seguinte/anterior (sem passar do mês atual pra trás). */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
