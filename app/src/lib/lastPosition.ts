// Última posição do GPS, pra telas que não acompanham o GPS (ex.: busca de destino).
import type { Position } from './useLocationSharing';

let last: Position | null = null;
export function rememberPosition(p: Position | null) { if (p) last = p; }
export function lastKnownPosition(): Position | null { return last; }
