// Contas da enquete (porcentagem de cada opção) e conferência antes de mandar pro banco.

export function pollPercents(options: { votes: number }[]): number[] {
  const total = options.reduce((s, o) => s + o.votes, 0);
  if (total === 0) return options.map(() => 0);
  // arredonda mantendo a soma em 100 (maior resto ganha o ponto que sobra)
  const raw = options.map((o) => (o.votes * 100) / total);
  const base = raw.map(Math.floor);
  let left = 100 - base.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
  for (const { i } of order) { if (left <= 0) break; base[i] += 1; left -= 1; }
  return base;
}

/** Mensagem de erro (ou null se dá pra mandar). As opções vazias são ignoradas. */
export function pollProblem(question: string, options: string[]): string | null {
  if (!question.trim()) return 'Escreve a pergunta da enquete.';
  const filled = options.map((o) => o.trim()).filter(Boolean);
  if (filled.length < 2) return 'Põe pelo menos 2 opções.';
  if (filled.length > 4) return 'No máximo 4 opções.';
  if (filled.some((o) => o.length > 60)) return 'Cada opção pode ter até 60 letras.';
  if (new Set(filled.map((o) => o.toLowerCase())).size !== filled.length) return 'Tem opção repetida.';
  return null;
}
