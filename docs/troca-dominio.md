# Troca pro login de produção (marchagps.eu.org)

Objetivo: login grátis pra até 50 mil usuários (plano grátis do Clerk, modo produção).
O modo produção exige um domínio próprio; usamos o grátis **marchagps.eu.org**.
Enquanto não sai, o app segue no modo de teste do Clerk (trava em 100 contas).

## Já feito (25/11/2026)
- Zona DNS `marchagps.eu.org` criada na Cloudflare (grátis). Servidores de nome:
  `rosalie.ns.cloudflare.com` e `tony.ns.cloudflare.com`.
- Registros já colocados na zona: os 5 CNAME + TXT do Clerk (`clerk.`, `accounts.`, `clkmail.`,
  `clk._domainkey.`, `clk2._domainkey.`, `_dmarc`) e o site na Vercel (`A @ 76.76.21.21`, `CNAME www`).
- Domínio adicionado ao projeto `marcha-gps` na Vercel.
- Clerk: modo produção criado no domínio (`ins_3MbIKgf1kKFUArhJPONFS8kKZQc`), copiado do modo
  de teste (inclui `role: authenticated` no token). Apple desligada nos dois modos.
- Workers `marcha-gps-api` e `marcha-gps-fotos` aceitam token dos dois modos (`CLERK_ISSUER` com vírgula).
- App: em `marchagps.eu.org` usa a chave de produção **se** `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD`
  existir no Vercel (`src/lib/clerkKey.ts`). Ainda NÃO está no Vercel de propósito.

## Gustavo faz (precisa da conta dele)
1. **Pedir o domínio no eu.org** (grátis; aprovação manual, pode demorar semanas).
   - https://nic.eu.org → *Register* → cria o "handle" (cadastro com nome, e-mail, endereço).
   - Confirma o e-mail. Entra com o handle → *New domain*.
   - Domínio: `marchagps.eu.org`.
   - Em *Name servers*: `rosalie.ns.cloudflare.com` e `tony.ns.cloudflare.com`.
   - Marca só a opção **"Check correctness of server names"** (sem os outros testes) e envia.
   - Chega um e-mail quando aprovar. Se der "request already exists" ao repetir, é porque ainda está na fila.
2. **Google** (grátis): https://console.cloud.google.com → novo projeto "Marcha GPS" →
   *APIs e serviços → Tela de consentimento OAuth* (Externo, nome "Marcha GPS") →
   *Credenciais → Criar → ID do cliente OAuth → Aplicativo da Web*.
   - Origem JavaScript: `https://marchagps.eu.org`
   - URI de redirecionamento: o que o painel do Clerk mostrar em *SSO connections → Google*
     (algo como `https://clerk.marchagps.eu.org/v1/oauth_callback`).
   - Cola o *Client ID* e o *Client secret* no painel do Clerk, **modo Production**, em Google.
     (Não mandar o secret no chat.) Depois publicar a tela de consentimento ("Em produção").
3. **Facebook** (grátis): https://developers.facebook.com → *Meus apps → Criar app* (Login do Facebook) →
   em *Login do Facebook → Configurações*, "URIs de redirecionamento do OAuth válidos" = o que o Clerk mostrar
   em *SSO connections → Facebook*. Cola App ID e App secret no Clerk (Production). Deixar o app "Ao vivo".

## Dia da troca (quando o eu.org aprovar) — eu faço
1. Conferir DNS e certificados no Clerk (`get_domain_status`) e o site em https://marchagps.eu.org.
2. Banco (Neon): adicionar o JWKS de produção
   `POST /projects/steep-leaf-14740483/jwks` com `https://clerk.marchagps.eu.org/.well-known/jwks.json`
   (só funciona depois que o domínio responde).
3. Vercel: criar `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD = pk_live_Y2xlcmsubWFyY2hhZ3BzLmV1Lm9yZyQ`
   e publicar de novo.
4. Contas antigas (modo teste) viram contas novas no modo produção (o ID do Clerk muda).
   Quem já tinha conta entra de novo com o mesmo e-mail/Google; eu troco o ID antigo pelo novo no banco
   (perfil, carro, posts etc.) cruzando os e-mails dos dois modos no Clerk.
5. Avisar a galera pra usar https://marchagps.eu.org (e reinstalar o atalho na tela inicial).
   O endereço antigo (marcha-gps.vercel.app) pode virar um redirecionamento pro novo.

## Plano B
Se o eu.org não aprovar em ~1 mês: comprar `marchagps.com.br` (~R$ 40/ano no registro.br), apontar
pra Cloudflare e trocar o domínio do modo produção no Clerk (*Domains → Change domain*). O resto é igual.
