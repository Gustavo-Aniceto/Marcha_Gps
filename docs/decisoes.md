# Marcha GPS — decisões do produto

Protótipo das telas: https://claude.ai/artifact/UYsUewuuw3KkM5jdFJ7oj2

## Conceito
GPS com cara de videogame para a cena de carro rebaixado. Área de lançamento: **São Paulo, Guarulhos e Itaquaquecetuba**.

## Acesso e confiança
- Entrada só por **convite**; quem convida é o padrinho e responde pelo convidado.
- **Verificação do membro** além do convite: 2 membros confirmam que conhecem + check-in presencial (QR escaneado por admin). Sem isso: não vê localização da equipe nem entra em comboio.
- Só o **Adm Master** (dono do app) libera equipes novas. O dono da equipe manda nome, cidade, Instagram, nº de membros, fotos de prova e faz chamada de vídeo.

## Carro
- Cadastro por **fotos** (frente, traseira, laterais, roda; mínimo 3). IA reconhece modelo, ano, cor, altura e aro; o app usa o modelo 3D da base e ajusta.
- **Garagem** em 3D: altura, tipo de suspensão, aro, posição da roda, cambagem, cor, vidro, aerofólio, neon. Checa fitment e monta a lista de peças da base (marca "Serve" / "Atenção").

## Mapa
- Navegação em 3D "meio 2D" (prédios em bloco), câmera alta, carro por cima. Visual noite (azul-escuro) ou dia (claro). O usuário escolhe 3D/2D, ângulo (20–88°) e raio de visão (40–220 m).
- **Cena ao vivo**: mapa de SP, Guarulhos e Itaquá com o carrinho montado de quem escolheu aparecer. Filtro por cidade e por tipo (Todos / Minhas equipes / Em encontro).
- Visibilidade: **Fantasma** / **Só minhas equipes** / **Cena ao vivo**. Na Cena ao vivo: posição aproximada (~500 m) por padrão para quem não é da equipe, atraso opcional, some ao parar 10 min, só membros verificados veem, zonas privadas (casa/trabalho) escondem até da equipe.

## Navegação
- "Para onde?" busca endereço ou lugar (estado de SP, puxando pra perto de você) e já sai navegando: linha da rota, próxima manobra com seta e distância, "depois: …", tempo restante, distância e horário de chegada.
- **Recalcula sozinho** quando sai da rota (2 leituras seguidas a mais de ~40 m, com folga se o GPS estiver ruim), quando fica muito longe (120 m) ou quando anda na contramão da rota por 3 leituras. Espera pelo menos 8 s entre recálculos e, se falhar, continua mostrando a rota antiga.
- **Voz em português** com 400 m e na hora da manobra (dá pra deixar mudo). Tela não apaga enquanto navega.
- Durante a rota, o alerta laranja mostra o próximo obstáculo **em cima da rota** que pega no seu carro (pela altura da garagem) e radares com a velocidade.
- Fontes gratuitas do OpenStreetMap: busca pelo Photon (Komoot) e rotas pelo Valhalla (FOSSGIS), passando pelo nosso serviço com login, cache e limite. Se o uso crescer, a troca é só no serviço (Valhalla próprio ou pago), sem atualizar o app.
- Próximo passo: rota que **desvia** de lombada/valeta onde o carro não passa (o Valhalla aceita pontos a evitar).

## Equipes
- Fundador/admin cria **eventos**: Encontro, Rolê (comboio com rota que desvia de obstáculos) ou Pista (só autódromo/área fechada autorizada).
- **Tema da equipe**: cor e formato dos botões. Aparece na tela/feed/rank da equipe e nas etiquetas do mapa. Cor escura é clareada automaticamente para leitura. Avisos de segurança continuam laranja para todos.
- **Prova de presença: "fazer a mídia"**: foto pela câmera do app (galeria não vale), no local e no horário do evento; o app confere se o carro bate com a garagem. Vale +50 XP na equipe; admin pode contestar em 24 h.

## Ranks
- **Rank de patente é interno de cada equipe** (só a equipe vê; sem disputa entre equipes). XP vem de: evento com mídia +50, rolê em comboio +30, convidado verificado +40.
- **Radar é soma geral** de todo mundo nas 3 cidades: pontos só por aviso confirmado por 3 pessoas. Buraco/Lombada alta/Valeta +15, Blitz/Rua ruim/Alagamento +10, Radar +5, confirmar aviso de outro +3. Aviso falso tira pontos. Blitz expira em 1 h, alagamento em 6 h, o resto em 7 dias sem confirmação.

## Dados de obstáculos
- Importação **automática toda segunda** (agendamento do serviço de rotas, uma cidade por vez) + script manual. OpenStreetMap (traffic_calming, highway=speed_camera) + radares da ANTT (rodovias concedidas, ex.: Dutra, Ayrton Senna). Duplicados a menos de 15 m são juntados; cada ponto leva a cidade; tudo entra como "não confirmado". Script: `scripts/import_obstacles.py`.
- Não usar dados do Waze/Google (termos de uso).

## Adm Master
- Fica discreto: só **donos de equipe** (fundadores verificados) veem quem é o Adm Master, pela função `master_contact()`. Pros outros o perfil dele aparece como um membro comum; a tabela de perfis não mostra a marca de master nem os convites de ninguém (cada um vê os próprios dados por `my_profile()`).

## Fora do escopo
- Nada que premie racha/velocidade na rua (ranking por velocidade, "puxada" entre carros). Competição só no Modo Pista, em local autorizado.

## Tech
- App: React Native (Expo), publicado **primeiro como site instalável (PWA)** em `https://marcha-gps.vercel.app` pra rodar em qualquer celular sem loja. A pessoa abre no navegador e usa "Adicionar à tela inicial". O mesmo código continua gerando o app nativo pra quando for pra Play Store/App Store.
- Limite do PWA: o navegador só manda a localização com o app **aberto na tela**. Se a pessoa bloqueia o celular ou troca de app, o carrinho dela some do mapa da equipe depois de 10 min (regra já existente). Compartilhar em segundo plano fica pro app nativo.
- Mapa: **MapLibre** (`@maplibre/maplibre-react-native`) + mapas gratuitos do **OpenFreeMap**. Mapbox descartado por custo. Dois visuais: navegação 3D com prédios em bloco (noite azul ou dia claro) e **Cena ao vivo em 2D cinza-escuro** pra ver os carros. Plano B se o OpenFreeMap sair do ar: hospedar os próprios tiles (PMTiles) só da região.
- Banco: **Neon** (Postgres, região São Paulo) com a Data API.
- Fotos: **Cloudflare R2** com um Worker que confere o login do Clerk (o armazenamento do Neon não existe na região de São Paulo).
- Login: **Clerk** (`@clerk/expo`), código no e-mail. Escolhido porque o login do próprio Neon ainda não suporta app de celular (depende de cookie de navegador).
