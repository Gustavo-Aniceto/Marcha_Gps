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
