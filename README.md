# Marcha GPS

GPS com cara de videogame para a cena de carro rebaixado. Começa em **São Paulo, Guarulhos e Itaquaquecetuba**.

- Entrada só por convite, com verificação dos membros pela própria equipe.
- Cada usuário monta o seu carro (por fotos + garagem 3D) e é ele que aparece no mapa.
- Avisos da comunidade: lombada alta, valeta, buraco, blitz, alagamento, radar.
- Equipes com eventos, tema próprio e rank interno; o Radar soma pontos de todo mundo.

Protótipo das telas: https://claude.ai/artifact/UYsUewuuw3KkM5jdFJ7oj2
Decisões do produto: [docs/decisoes.md](docs/decisoes.md)

## Estrutura

```
app/            App mobile (Expo + React Native + TypeScript)
db/migrations/  Banco (Postgres no Neon): tabelas, regras de acesso (RLS) e funções
db/tests/       Testes do banco (rodam num Postgres local)
workers/fotos/  Serviço de fotos (Cloudflare Worker + R2): confere o login do Clerk e guarda a imagem
scripts/        Importação de lombadas/radares (OpenStreetMap + ANTT)
docs/           Decisões e notas do produto
```

## Serviços

- **Neon**: banco Postgres + Data API (REST). Projeto `marcha-gps`, região São Paulo.
- **Clerk**: login por código no e-mail. O token dele é o que a Data API usa pra saber quem é o usuário.
- **Fotos**: Cloudflare R2 (10 GB grátis, sem custo de download) via `workers/fotos`. O armazenamento do Neon ainda não existe na região de São Paulo.
- **Mapa**: MapLibre (biblioteca aberta) com os mapas gratuitos do **OpenFreeMap** (dados do OpenStreetMap). Sem conta, sem chave e sem cobrança. Estilos próprios em `app/src/lib/mapStyle.ts`: **noite** (3D azul), **dia** (3D claro) e **cena** (2D cinza-escuro, pra ver a galera).

## Configurando

### 1. Clerk

**Já configurado (24/11/2026):**
- Clerk: aplicação "Marcha GPS" (desenvolvimento, domínio `great-aphid-3258.clerk.accounts.dev`), token com `{ "role": "authenticated" }`, Native API ligada, app Android `br.com.marchagps.app` registrado. Falta registrar o iOS (precisa do Team ID da Apple).
- Neon: Data API ligada com o JWKS do Clerk; migrations 0001–0004 aplicadas; cache atualizado.

Pra recriar do zero em outro ambiente:

### 1. Clerk

1. Crie uma aplicação em [clerk.com](https://clerk.com).
2. **User & authentication**: e-mail com **Email verification code**.
3. **Native applications**: ligue a **Native API**.
4. **Sessions > Customize session token**: `{ "role": "authenticated" }` (obrigatório: sem isso o banco trata todo mundo como visitante).

### 2. Neon

1. Data API ligada com provedor externo, JWKS do Clerk: `https://<seu-dominio-clerk>/.well-known/jwks.json`.
2. Rode as migrations de `db/migrations/` em ordem (SQL Editor do Neon ou `psql`).
3. **Refresh schema cache** na página da Data API.
4. Entre uma vez no app e se marque como Adm Master (o ID é o do Clerk, `user_...`):
   ```sql
   insert into public.profiles (id, username, is_master) values ('user_...', 'seu.nome', true);
   ```

Testes do banco num Postgres local:

```bash
./db/tests/run.sh
```

### 3. Fotos (Cloudflare)

1. Já feito: bucket R2 `marcha-gps-fotos` e Worker publicado em `https://marcha-gps-fotos.guuhaniceto2.workers.dev`, aceitando só o login do Clerk.
2. `CLERK_ISSUER` em `workers/fotos/wrangler.toml` é o domínio do Clerk.
3. `cd workers/fotos && npm install && npm test && npx wrangler deploy`
4. Coloque a URL do Worker em `EXPO_PUBLIC_FOTOS_URL` no `app/.env`.
5. O app reduz as fotos (lado maior 1600 px, JPEG 70%) antes de enviar, pra caber folgado na cota grátis.

### 4. Obstáculos e radares

```bash
python3 scripts/import_obstacles.py --sql carga.sql                 # OpenStreetMap
python3 scripts/import_obstacles.py --antt radares.csv --sql carga.sql
```

Rode o `carga.sql` no SQL Editor do Neon (como dono do banco).

### 5. App

```bash
cd app
cp .env.example .env      # chave pública do Clerk, URL da Data API do Neon e URL do serviço de fotos
npm install
npx expo install --fix    # alinha as versões das libs com o SDK do Expo instalado
npm run typecheck
npm test                  # testes da lógica (fitment, tema, pontos)
npx expo run:android      # ou run:ios
```

Precisa de build de desenvolvimento (o mapa MapLibre e a tela de login nativa do Clerk não rodam no Expo Go).

## O que já está pronto (fase 1)

- **Banco**: convites, pedido e aprovação de equipe pelo Adm Master, verificação dos membros (confirmação + check-in),
  carros, eventos com "fazer a mídia", avisos do Radar com confirmação e pontos, rank interno e geral,
  localização com modo fantasma, zonas privadas, posição aproximada e atraso. Tudo com testes.
- **App**: login por código no e-mail, entrada com convite, mapa com câmera 3D/2D e carros da galera,
  avisar obstáculo, alerta de lombada que raspa no seu carro, garagem, ranks, equipes (convite, verificação,
  tema, pedido de equipe, painel do Adm Master) e "quem vê meu carro".

## Fase 2 (pronta)

- Feed da equipe e geral, com foto e curtida.
- Eventos: criar (admin), lista de próximos, "vou" e **fazer a mídia** pela câmera do app (foto conferida pelo serviço de fotos, local e horário conferidos no banco, +50 XP).
- Página do evento com a galeria de mídias; admin contesta em até 24 h.
- **Check-in por QR code**: o membro mostra o QR, o admin escaneia no encontro (vale como a prova presencial da verificação).

## Próximas fases

- Cadastro do carro por fotos (reconhecimento por IA) e garagem em 3D.
- Modelo 3D do carro no lugar do ícone.
- Mapas próprios: gerar um arquivo PMTiles só de SP, Guarulhos e Itaquá e hospedar no nosso armazenamento (deixa de depender do OpenFreeMap; o estilo continua o mesmo, só muda `TILES_URL`).
- Rotina chamando `expire_reports()` a cada 5 minutos (pg_cron no Neon ou função agendada).
- Fotos (carro e mídia) no Neon Object Storage.
- Trocar as caixas das cidades por polígonos oficiais do IBGE.
