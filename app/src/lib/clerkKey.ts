// Qual chave pública do Clerk usar. O modo produção (até 50 mil usuários grátis) só funciona no domínio
// próprio (marchagps.eu.org); nos outros endereços (vercel.app, testes) fica o modo de teste.
export const PROD_HOSTS = ['marchagps.eu.org', 'www.marchagps.eu.org'];

export function pickClerkKey(host: string | null | undefined, devKey: string | undefined, prodKey: string | undefined): string | undefined {
  if (prodKey && host && PROD_HOSTS.includes(host.toLowerCase())) return prodKey;
  return devKey ?? prodKey;
}
