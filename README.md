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
app/                 App mobile (Expo + React Native + TypeScript)
supabase/migrations/ Banco de dados (Postgres/Supabase): tabelas, regras de acesso (RLS) e funções
supabase/tests/      Testes do banco (rodam num Postgres local)
scripts/             Importação de lombadas/radares (OpenStreetMap + ANTT)
docs/                Decisões e notas do produto
```

## Rodando

### Banco (Supabase)

1. Crie um projeto no [Supabase](https://supabase.com).
2. Rode as migrations em ordem (`supabase db push` com a CLI, ou cole os arquivos de `supabase/migrations/` no SQL Editor).
3. Crie seu usuário e se marque como Adm Master:
   ```sql
   update public.profiles set is_master = true where id = '<seu user id>';
   ```

Testes do banco num Postgres local (sem Supabase):

```bash
./supabase/tests/run.sh
```

### Obstáculos e radares

```bash
python3 scripts/import_obstacles.py                 # baixa do OpenStreetMap
python3 scripts/import_obstacles.py --antt radares.csv --sql carga.sql
```

Gera um GeoJSON e, com `--sql`, um arquivo pronto pra carregar na tabela `reports`.

### App

```bash
cd app
cp .env.example .env      # preencha a URL e a chave pública do Supabase e o token do Mapbox
npm install
npx expo install --fix    # alinha as versões das libs com o SDK do Expo instalado
npm run typecheck
npm test                  # testes da lógica (fitment, tema, pontos)
npx expo start
```

O mapa usa `@rnmapbox/maps`, que precisa de um build de desenvolvimento (`npx expo run:android` / `run:ios`), não roda no Expo Go.

## O que já está pronto (fase 1)

- **Banco**: convites, pedido e aprovação de equipe pelo Adm Master, verificação dos membros (confirmação + check-in),
  carros, eventos com "fazer a mídia", avisos do Radar com confirmação e pontos, rank interno e geral,
  localização com modo fantasma, zonas privadas, posição aproximada e atraso. Tudo com testes.
- **App**: login por código no e-mail, entrada com convite, mapa com câmera 3D/2D e carros da galera,
  avisar obstáculo, alerta de lombada que raspa no seu carro, garagem, ranks, equipes (convite, verificação,
  tema, pedido de equipe, painel do Adm Master) e "quem vê meu carro".

## Próximas fases

- Cadastro do carro por fotos (reconhecimento por IA) e garagem em 3D.
- Feed da equipe e geral, eventos no app e tela de "fazer a mídia" com a câmera.
- Visual holográfico do mapa (estilo próprio no Mapbox Studio) e modelo 3D do carro no lugar do ícone.
- Rotina no Supabase (pg_cron) chamando `expire_reports()` a cada 5 minutos.
- Trocar as caixas das cidades por polígonos oficiais do IBGE.
