# Marcha GPS — notas para quem programa

Leia `docs/decisoes.md` antes de mudar regra de produto.

## Regras que não podem quebrar
- **Privacidade de localização vem do banco, não do app.** O app nunca lê a tabela `live_locations` direto: use a função `visible_cars()`, que aplica modo fantasma, equipe, verificação, zonas privadas, posição aproximada e atraso. Não crie policy de SELECT em `live_locations` para outros usuários.
- **Nada que premie velocidade na rua.** Não guardar ranking de velocidade nem comparar tempo entre carros fora de evento do tipo `pista`.
- Pontos do Radar só nascem de aviso **confirmado** (função `confirm_report`). Nunca dar pontos no insert.
- Avisos de segurança (lombada, blitz etc.) ficam sempre na cor laranja; o tema da equipe não muda eles.
- Área de lançamento: São Paulo, Guarulhos, Itaquaquecetuba (`cities`).

## Banco
- Migrations em `supabase/migrations/`, numeradas. Nunca edite uma migration já aplicada; crie outra.
- Toda tabela nova precisa de RLS ligado e policies.
- Testes: `./supabase/tests/run.sh` sobe um Postgres local com um `auth` falso e roda `supabase/tests/*.sql`.

## App
- Expo + expo-router + TypeScript. Lógica pura fica em `app/src/lib/` com testes em `app/src/lib/__tests__/` (`npm test`).
- Cores e fontes em `app/src/theme/`. Não espalhar cor solta pelas telas.
- Textos para o usuário em português do Brasil.
