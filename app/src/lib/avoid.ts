// Rota que desvia do que pega no carro (lombada alta, valeta funda, buraco…).
// O app nunca troca o caminho sozinho: acha uma alternativa e PERGUNTA se a pessoa quer trocar.
import { clearanceFor, type Suspension } from './fitment.ts';

/** Avisos que são obstáculo físico (radar, blitz e alagamento não entram: não é a altura do carro que importa). */
const PHYSICAL = new Set(['buraco', 'lombada', 'valeta', 'rua_ruim', 'rampa', 'sonorizador', 'faixa_elevada']);

export interface AvoidCar { ride_height_cm: number; suspension: string }
export interface ObstacleItem { id: string; kind: string; lat: number; lon: number; base_risk: number }
export interface OnRoute<T> { item: T; along: number }

export const MAX_AVOID_POINTS = 40;
export const MIN_EXTRA_ALLOWED_S = 5 * 60;   // sempre aceita até 5 min a mais…
export const EXTRA_RATIO = 0.5;              // …ou até 50% a mais do tempo que falta
export const MAX_EXTRA_S = 20 * 60;          // mas nunca mais de 20 min a mais

export function hitsCar(item: { kind: string; base_risk: number }, car: AvoidCar): boolean {
  if (!PHYSICAL.has(item.kind)) return false;
  return clearanceFor(car.ride_height_cm, item.base_risk, [], car.suspension as Suspension) !== 'passa';
}

/** Obstáculos à frente (do ponto `fromAlong` em diante) que pegam no carro, na ordem da rota. */
export function blockingAhead<T extends ObstacleItem>(onRoute: OnRoute<T>[], car: AvoidCar, fromAlong = 0): OnRoute<T>[] {
  const seen = new Set<string>();
  return onRoute
    .filter((o) => o.along >= fromAlong - 5 && hitsCar(o.item, car))
    .filter((o) => (seen.has(o.item.id) ? false : (seen.add(o.item.id), true)))
    .sort((a, b) => a.along - b.along);
}

/** Pontos que o serviço de rotas deve evitar (os mais próximos primeiro). */
export function avoidPoints<T extends ObstacleItem>(blocking: OnRoute<T>[]): { lat: number; lon: number }[] {
  return blocking.slice(0, MAX_AVOID_POINTS).map((o) => ({ lat: o.item.lat, lon: o.item.lon }));
}

/**
 * Vale perguntar se quer trocar? Só se a outra rota tiver MENOS obstáculos que pegam no carro
 * e não for muito mais demorada.
 */
export function shouldOffer(cur: { blocking: number; remaining_s: number }, alt: { blocking: number; time_s: number }):
  { offer: boolean; extra_s: number; avoided: number } {
  const extra_s = Math.max(0, Math.round(alt.time_s - cur.remaining_s));
  const avoided = cur.blocking - alt.blocking;
  const allowed = Math.min(MAX_EXTRA_S, Math.max(MIN_EXTRA_ALLOWED_S, cur.remaining_s * EXTRA_RATIO));
  return { offer: avoided > 0 && extra_s <= allowed, extra_s, avoided };
}

export function obstacleWord(n: number): string {
  return n === 1 ? '1 obstáculo' : `${n} obstáculos`;
}

/** Frase da pergunta (na tela e na voz). */
export function offerText(o: { avoided: number; total: number; extra_s: number }): { title: string; detail: string; speak: string } {
  const min = Math.round(o.extra_s / 60);
  const extra = min <= 0 ? 'no mesmo tempo' : `+${min} min`;
  const all = o.avoided >= o.total;
  const title = `${o.total === 1 ? 'Tem 1 obstáculo' : `Tem ${o.total} obstáculos`} nesse caminho que ${o.total === 1 ? 'pega' : 'pegam'} no seu carro`;
  const detail = all ? `Achei outro caminho que desvia de tudo · ${extra}` : `Achei outro caminho que desvia de ${o.avoided} · ${extra}`;
  const speakExtra = min <= 0 ? 'quase no mesmo tempo' : `com ${min === 1 ? 'um minuto' : `${min} minutos`} a mais`;
  const speak = `${title}. Achei outro caminho que desvia, ${speakExtra}. Quer trocar?`;
  return { title, detail, speak };
}
