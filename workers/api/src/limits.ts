// Limite simples por pessoa (na memória do Worker). Não é perfeito entre servidores,
// mas segura abuso e mantém o uso justo dos servidores públicos de mapa.
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private max: number;
  private windowMs: number;
  constructor(max: number, windowMs: number) { this.max = max; this.windowMs = windowMs; }

  allow(key: string, now = Date.now()): boolean {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.max) { this.hits.set(key, list); return false; }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 5000) this.hits.clear(); // não deixa a memória crescer
    return true;
  }
}
