# Marcha GPS — notas para quem programa

Leia `docs/decisoes.md` antes de mudar regra de produto.

## Regras que não podem quebrar
- **Privacidade de localização vem do banco, não do app.** O app nunca lê a tabela `live_locations` direto: use a função `visible_cars()`, que aplica modo fantasma, equipe, verificação, zonas privadas, posição aproximada e atraso. Não crie policy de SELECT em `live_locations` para outros usuários.
- **Nada que premie velocidade na rua.** Não guardar ranking de velocidade nem comparar tempo entre carros fora de evento do tipo `pista`.
- Pontos do Radar só nascem de aviso **confirmado** (função `confirm_report`). Nunca dar pontos no insert.
- Avisos de segurança (lombada, blitz etc.) ficam sempre na cor laranja; o tema da equipe não muda eles.
- Área de lançamento: São Paulo, Guarulhos, Itaquaquecetuba (`cities`).

## Banco (Neon) e login (Clerk)
- Banco no Neon (projeto `marcha-gps`, região São Paulo). O app fala com ele pela **Data API** (PostgREST) mandando o token do Clerk.
- Usuário atual no SQL: `auth.user_id()` (texto, claim `sub` do Clerk, ex.: `user_2abc...`). IDs de usuário são `text`, nunca `uuid`.
- **No Neon, `authenticated` não tem USAGE no schema `auth`.** Policies podem usar `auth.user_id()` (já ficam compiladas), mas função `SECURITY INVOKER` precisa usar `public.current_uid()`; senão dá "permission denied for schema auth". Os testes locais imitam isso.
- O token do Clerk precisa ter `"role": "authenticated"` (Clerk > Sessions > Customize session token). Sem isso a Data API roda como `anonymous` e nada funciona.
- Clerk tem dois modos: **teste** (`great-aphid-3258.clerk.accounts.dev`, trava em 100 contas) e **produção** (`clerk.marchagps.eu.org`, grátis até 50 mil). O app escolhe a chave pelo endereço (`src/lib/clerkKey.ts`; produção só em marchagps.eu.org e só se `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD` estiver no Vercel). Os Workers aceitam os dois (`CLERK_ISSUER` com vírgula). Passo a passo da troca: `docs/troca-dominio.md`.
- Migrations em `db/migrations/`, numeradas. Nunca edite uma migration já aplicada; crie outra. Depois de aplicar, atualize o cache da Data API (Console > Data API > Refresh schema cache).
- Toda tabela nova precisa de RLS ligado e policies.
- Testes: `./db/tests/run.sh` sobe um Postgres local imitando o Neon (`auth.user_id()`, papéis `authenticated`/`anonymous`) e roda `db/tests/*.sql`.

## Fotos
- Sempre pelo `workers/fotos` (R2). Chave = `<tipo>/<user_id do Clerk>/<uuid>.<ext>`; o banco só aceita chave da própria pessoa (`check_own_photo_key`).
- Mídia de evento: o app chama `submit_event_media_checked`, nunca `submit_event_media`.

## Rotas e navegação
- Busca e rota passam pelo `workers/api` (Worker `marcha-gps-api`): `GET /buscar` (Photon) e `POST /rota` (Valhalla do FOSSGIS, em pt-BR; `evitar: [{lat,lon}]` vira `exclude_locations`, até 40). Exigem login do Clerk; cache e limite por pessoa porque os servidores públicos pedem uso justo (Valhalla: 1 pedido/s). O app nunca chama Photon/Valhalla direto.
- Rota que desvia do que pega no carro: `src/lib/avoid.ts` decide; o app **nunca troca sozinho**, só pergunta (`findAlternative` / `switchToAlternative` em `navigation.tsx`). Uma pergunta por destino; aceitou, os recálculos seguem desviando.
- Lógica da navegação pura em `app/src/lib/nav.ts` (encaixe na rota, recálculo, voz, chegada) com testes; estado em `app/src/lib/navigation.tsx`.
- Lombadas/radares do OpenStreetMap entram pelo agendamento de hora em hora do `marcha-gps-api`: o mapa é dividido em 12 quadrados (consulta curta, `[timeout:25]`) e cada um só é baixado de novo depois de 6 dias (`osm_import_due()` + tabela `import_runs`). Grava via `import_osm_obstacles()` com o usuário `importador` do Neon (só executa essas duas funções; segredo `IMPORT_DATABASE_URL` no Worker). Se o Overpass estiver fora, tenta outros servidores e de novo na hora seguinte.
- Montar o carrinho pelo foto: `POST /carro/analisar` no `marcha-gps-api` (binding `AI`, modelo `@cf/google/gemma-4-26b-a4b-it`, `enable_thinking: false`, resposta em JSON com schema). Lógica pura em `workers/api/src/carro.ts`; no app `src/lib/carGuess.ts`. As listas de tipo/cor precisam bater com `carBodies.ts` (teste confere).
- Publicar o Worker: o código vai como módulos ES (o `src` + `../fotos/src/jwt.ts` e `cors.ts`); manter `wrangler.toml` igual ao que está no ar.

## Mapa
- MapLibre + OpenFreeMap (grátis). Estilos só em `app/src/lib/mapStyle.ts` (noite, dia, cena). Não usar Mapbox (pago).
- Mapa principal (navegação 3D) e Cena ao vivo (`app/app/cena.tsx`, 2D cinza) mostram todos que `visible_cars()` liberar. Avisos aparecem como ícone (`src/components/ReportIcon.tsx`). Tocar num carrinho (nos dois mapas) abre `src/components/ProfileSheet.tsx` (dados de `public_profile()`, com até 3 fotos do carro) → perfil completo. Arrastar o mapa solta a câmera (`following` no `Camera`). Movimento do próprio carro: `src/lib/glide.ts` (desliza entre leituras do GPS; navegando, encaixa na rota com `displayPoint`); no navegador câmera e carrinho leem o mesmo `Glide` a cada quadro (`requestAnimationFrame`), nunca `easeTo` por leitura. Outros carros também deslizam (`src/lib/useGlides.ts`); a linha da rota some atrás do carro (`RouteLine` com `route`+`trim`). Zoom pela velocidade, tema automático pelo sol e aviso de GPS fraco: `src/lib/mapCamera.ts`. Velocímetro e radar à frente: `src/lib/speed.ts` (velocidade nunca vai pro banco).
- Modo GPS no visual de app de trânsito conhecido: cores da "casca" em `chrome` (`src/theme/tokens.ts`), rota roxa (`colors.route`). Carrinho: carroceria em `src/lib/carBodies.ts` (`cars.body_type`), desenho em `src/lib/carDrawing.ts` (puro; dá pra gerar prévia .svg).

## App
- Roda primeiro como **site instalável (PWA)** na Vercel (`app/vercel.json`, projeto `marcha-gps`; push na `main` publica). O mesmo código gera o app nativo.
- Telas usam o mapa por `app/src/map` (nativo: MapLibre RN; web: `index.web.tsx` com maplibre-gl). Nunca importar `@maplibre/maplibre-react-native` direto numa tela.
- Arquivos `.web.tsx` / `.web.ts` são a versão do navegador (login do Clerk, cache do token, mapa).
- Feed social: `feed()` (geral/equipe/autor/tipo, com curtidas, comentários, foto e carro do autor, `kind` post|carro|enquete e `poll`). Enquete: `create_poll()` / `vote_poll()` (votos não são legíveis direto, só por `poll_json()`). Caixa de postar única: `src/components/Composer.tsx`, `post_comments`, `public_profile()`, foto de perfil via `set_my_avatar()` (foto sobe como tipo `post`). Telas `app/post/[id].tsx` e `app/perfil/[username].tsx`.
- Primeiro acesso: `(auth)/inicio` (código, conferido sem login pelo `GET /convite` do `marcha-gps-api`, que chama `check_invite()` com o usuário `importador`; a Data API do Neon não aceita pedido sem login) → `(auth)/entrar` (Clerk: Google, Facebook, e-mail) → `(auth)/convite` (nome de usuário + `redeem_invite`). O código fica guardado no aparelho (`src/lib/pendingInvite.ts`) entre as telas.
- Vários carros: `cars.is_active` (1 por pessoa, até 5 carros; triggers `cars_before_insert`/`cars_after_delete`), troca por `set_active_car()`; pergunta ao abrir: `src/components/CarChooser.tsx`. Visibilidade: `set_my_visibility(modo, equipe)` / `my_visibility()` (`profiles.visibility_crew` = só uma equipe); `visible_cars()` devolve `crews` (equipes em comum). Página da equipe: `crew_page()` + `app/equipe/[id].tsx`; perfil usa `profile_crews()` e `profile_garage()`. Códigos de fundador: não vencem, `crews.founder_code`, lista do master `master_founder_codes()`.
- O próprio perfil vem de `my_profile()`; a tabela `profiles` só mostra id, username, padrinho e data. Só fundadores veem o Adm Master (`master_contact()`).
- Expo + expo-router + TypeScript. Lógica pura fica em `app/src/lib/` com testes em `app/src/lib/__tests__/` (`npm test`).
- Cores e fontes em `app/src/theme/`. Não espalhar cor solta pelas telas.
- Textos para o usuário em português do Brasil.
