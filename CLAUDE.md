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
- O token do Clerk precisa ter `"role": "authenticated"` (Clerk > Sessions > Customize session token). Sem isso a Data API roda como `anonymous` e nada funciona.
- Migrations em `db/migrations/`, numeradas. Nunca edite uma migration já aplicada; crie outra. Depois de aplicar, atualize o cache da Data API (Console > Data API > Refresh schema cache).
- Toda tabela nova precisa de RLS ligado e policies.
- Testes: `./db/tests/run.sh` sobe um Postgres local imitando o Neon (`auth.user_id()`, papéis `authenticated`/`anonymous`) e roda `db/tests/*.sql`.

## Fotos
- Sempre pelo `workers/fotos` (R2). Chave = `<tipo>/<user_id do Clerk>/<uuid>.<ext>`; o banco só aceita chave da própria pessoa (`check_own_photo_key`).
- Mídia de evento: o app chama `submit_event_media_checked`, nunca `submit_event_media`.

## Mapa
- MapLibre + OpenFreeMap (grátis). Estilos só em `app/src/lib/mapStyle.ts` (noite, dia, cena). Não usar Mapbox (pago).
- Navegação = 3D só com a equipe; Cena ao vivo (`app/app/cena.tsx`) = 2D cinza com todos que `visible_cars()` liberar.

## App
- Expo + expo-router + TypeScript. Lógica pura fica em `app/src/lib/` com testes em `app/src/lib/__tests__/` (`npm test`).
- Cores e fontes em `app/src/theme/`. Não espalhar cor solta pelas telas.
- Textos para o usuário em português do Brasil.
