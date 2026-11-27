# Marcha GPS — decisões do produto

Protótipo das telas: https://claude.ai/artifact/UYsUewuuw3KkM5jdFJ7oj2

## Conceito
GPS com cara de videogame pra quem curte carro. Slogan: **"Carros modificados e originais"** (não usar "cena rebaixada"/"carros rebaixados" como slogan). Área de lançamento: **São Paulo, Guarulhos e Itaquaquecetuba**.

## Acesso e confiança
- Entrada só por **convite**; quem convida é o padrinho e responde pelo convidado.
- **Todo convite vale uma vez só, pra sempre** (principalmente o de fundador): usou, ninguém mais usa, nem se a conta de quem usou for apagada. Se duas pessoas tentarem ao mesmo tempo, só uma entra.
- **Ordem do primeiro acesso:** 1) digita o código do convite (o app confere sem login); 2) entra com a conta que preferir: Google, Facebook ou e-mail (código no e-mail ou senha); 3) escolhe o nome de usuário. Quem já é membro toca em "Já sou membro · Entrar".
- **Convite só dá acesso ao app.** Dois tipos: código de fundador (só o Adm Master gera; quem usa pode registrar uma equipe) e convite pro app (quem é verificado em alguma equipe gera, gasta 1 dos convites, vale 7 dias). Nenhum convite coloca ninguém em equipe.
- **Entrar numa equipe = pedir.** Na página da equipe (ou na lista "Equipes da cena") a pessoa toca em "Pedir pra entrar" (mensagem opcional). Quem aprova é o fundador ou admin daquela equipe; quem aprovou vira o padrinho. Recusado só pede de novo depois de 7 dias. Um pedido aberto por equipe.
- **Registrar equipe** só quem entrou com código de fundador que ainda não virou equipe (ou o Adm Master).
- **Página da equipe** no jeito das páginas do Facebook: capa, foto (logo), bio (até 600 letras) e Instagram, editados pelo fundador/admin. Fotos sobem pelo serviço de fotos como tipo `post`.
- **Verificação do membro** depois de aprovado: 2 membros confirmam que conhecem + check-in presencial (QR escaneado por admin). Sem isso: não vê localização da equipe nem entra em comboio.
- Só o **Adm Master** (dono do app) libera equipes novas. **Código de fundador não vence** e fica ligado pra sempre à equipe que nasceu dele: na aba Equipes o master vê a lista de códigos (livre / quem usou / pedido em análise / nome da equipe). O dono da equipe manda nome, cidade, Instagram, nº de membros, fotos de prova e faz chamada de vídeo.

## Primeiro acesso
- Depois de escolher o nome de usuário, abre um **tutorial** curto (8 telas: boas-vindas, garagem, rota, avisar, quem vê, Cena ao vivo, equipes, feed). Dá pra pular e rever pelo menu ☰ → "Como usar o app".
- Toda tela tem **voltar**; se a pessoa abriu direto na tela (link ou app recarregado), o voltar leva pro mapa (ou pra aba Equipes, nas telas de equipe).

## Carro
- Cadastro por **fotos** (frente, traseira, laterais, roda; mínimo 3). IA reconhece modelo, ano, cor, altura e aro; o app usa o modelo 3D da base e ajusta.
- **Montar pelo foto (feito):** na garagem a pessoa manda de 1 a 3 fotos do carro; uma IA com visão (Gemma 4 no Workers AI da Cloudflare, plano grátis, ~8 de 10 mil "neurônios"/dia por análise) diz tipo de carroceria, cor, marca, modelo, vidro, aerofólio e se está rebaixado. O app monta o carrinho com isso; a pessoa confere, ajusta se quiser e salva. As fotos ficam guardadas no carro (R2). Limite: 4 análises por minuto e 20 por dia por pessoa.
- **Tipo do carrinho no mapa:** hatch, sedã, perua, picape, picape grande, SUV, esportivo e van/Kombi, em 17 cores (desenhos próprios, vista de cima, estilo desenho). Vidro (fumê/limo) e aerofólio aparecem no desenho. É esse carrinho que aparece no mapa, na Cena e no perfil.
- **Vários carros:** até 5 na garagem. Só um fica "no mapa" por vez (é ele que aparece no GPS, na Cena e no perfil). Quem tem mais de um carro, ao abrir o app, responde **"Com qual carro você vai sair?"**. Dá pra trocar na Garagem ("Usar este no mapa"). O perfil mostra os outros carros da garagem.
- **Garagem** em 3D: altura, tipo de suspensão, aro, posição da roda, cambagem, cor, vidro, aerofólio, neon. Checa fitment e monta a lista de peças da base (marca "Serve" / "Atenção").

## Mapa
- **Modo GPS no visual que o público já conhece de app de trânsito** (pra quem vem de outro app achar familiar): barra preta da manobra em cima (seta, distância e nome da rua em azul), rota roxa, nome da rua atual numa etiqueta embaixo do carro, barra de baixo com horário de chegada, tempo e distância (trocar destino, voz, encerrar), velocímetro redondo embaixo à esquerda, botão amarelo de avisar embaixo à direita, botão redondo de localização, menu (☰) em cima à esquerda. Parado: barra "Para onde?" embaixo.
- Mapa noite grafite azulado (ruas cinza, rodovias azuladas, parques verdes) ou dia claro (ruas brancas com contorno). Prédios planos e discretos (mapa limpo); o carro fica mais pra baixo da tela pra ver o caminho à frente; ângulo padrão 50°. O usuário escolhe 3D/2D, ângulo (20–88°) e raio de visão (40–220 m).
- **Cena ao vivo** (fica no visual 2D cinza, aprovado): o mapa inteiro com o carrinho montado de quem escolheu aparecer, **e o seu carro** (com o seu @, pelo seu GPS). Sem demarcação nem filtro de cidade; filtro por Todos / Minhas equipes / cada equipe. Tocar num carro (o seu também) abre o cartão do perfil da pessoa (ver Feed).
- Quem pode ver a Cena: membro verificado de alguma equipe **ou o Adm Master** (`can_view_scene()`).
- Dá pra estar em **mais de uma equipe**. Visibilidade: **Fantasma** / **Minhas equipes** (todas juntas **ou uma equipe só**: as outras não te veem) / **Cena ao vivo**. Na Cena, o filtro vai de Todos / Minhas equipes / cada equipe. Na Cena ao vivo: posição aproximada (~500 m) por padrão para quem não é da equipe, atraso opcional, some ao parar 10 min, só membros verificados veem, zonas privadas (casa/trabalho) escondem até da equipe.

## Navegação
- "Para onde?" busca endereço ou lugar (estado de SP, puxando pra perto de você) e já sai navegando: linha da rota, próxima manobra com seta e distância, "depois: …", tempo restante, distância e horário de chegada.
- **Recalcula sozinho** quando sai da rota (2 leituras seguidas a mais de ~40 m, com folga se o GPS estiver ruim), quando fica muito longe (120 m) ou quando anda na contramão da rota por 3 leituras. Espera pelo menos 8 s entre recálculos e, se falhar, continua mostrando a rota antiga.
- **Voz em português** com 400 m e na hora da manobra (dá pra deixar mudo). Tela não apaga enquanto navega.
- **Movimento liso:** o carro desliza entre as leituras do GPS e o mapa anda junto (sem trancos); navegando, o carro anda em cima da linha da rota. Os outros carros também deslizam. A linha roxa some no trecho que já ficou pra trás. Mais rápido = mapa mais afastado pra ver longe; chegando devagar numa conversão, aproxima. Aparece "GPS fraco" / "Sem sinal de GPS" quando o sinal piora. Tema **Automático** (padrão): claro do nascer ao pôr do sol, escuro à noite.
- **Mapa leve:** os avisos do Radar são desenhados como camada do próprio mapa (não um elemento por aviso); de longe só aparecem os confirmados e os radares. Navegando, a barra de abas some, o mapa ocupa a tela toda e só aparecem os avisos que estão em cima da rota.
- **App leve pra abrir:** o login carrega só o português (o app ficou de 8 MB pra 3 MB) e os arquivos do app ficam guardados no celular depois da primeira vez.
- **Visual sofisticado (grafite):** fundo quase preto, cartões bem arredondados em camadas de cinza, bordas sutis, chips redondos, ícones de linha fina (sem emoji), títulos na fonte do celular e o verde-limão só nos destaques, no estilo dos painéis de frota/operação. A fonte "de corrida" ficou só no logo.
- **Visual conhecido:** perfil no jeito das redes sociais (foto à esquerda, posts / equipes / carros à direita), setinha de voltar igual em todas as telas, cores da equipe em bolinhas. Em tablet as telas ficam numa coluna no meio.
- **Mapa solto como no Waze:** arrastar, girar ou dar zoom solta a câmera do carro e aparece "Voltar pro carro". Navegando, volta sozinho depois de 15 s sem mexer. Botão "ver a rota inteira" mostra o caminho todo na tela.
- O mapa principal mostra **todo mundo que `visible_cars()` libera** (não só a equipe): o banco já aplica fantasma, só-equipe, posição aproximada, atraso e zonas privadas. Nome da equipe em verde, os outros em azul.
- **Filtro do mapa**: escolher quais carros aparecem (todos / só minhas equipes / nenhum), quais avisos (radares, lombadas e valetas, buracos, blitz, alagamento) e "só os confirmados". Fica salvo no celular. Só limpa o mapa: navegando, o alerta de radar e de obstáculo continua.
- Avisos no mapa são **ícones** (radar, lombada, valeta, buraco, blitz, alagamento etc.) num círculo laranja, não etiqueta de texto. Não confirmado fica meio apagado.
- **Velocímetro** no canto do mapa com a sua velocidade (do GPS ou calculada pelo movimento). Com radar à frente (até 400 m; navegando, até 500 m na rota) aparece a placa com o limite e a distância; passou do limite, o velocímetro fica vermelho. Só aparece pra própria pessoa: velocidade não é guardada nem comparada (regra de não premiar velocidade).
- Radar no mapa mostra a placa com a velocidade ao lado do ícone. Quem avisa um radar escolhe a velocidade da placa (ou "não sei"); radar sem velocidade ganha a de quem confirmar depois.
- Durante a rota, o alerta laranja mostra o próximo obstáculo **em cima da rota** que pega no seu carro (pela altura da garagem) e radares com a velocidade.
- Fontes gratuitas do OpenStreetMap: busca pelo Photon (Komoot) e rotas pelo Valhalla (FOSSGIS), passando pelo nosso serviço com login, cache e limite. Se o uso crescer, a troca é só no serviço (Valhalla próprio ou pago), sem atualizar o app.
- **Rota que desvia** do que pega no seu carro (lombada alta, valeta, buraco… pela altura da garagem): o app procura sozinho um caminho alternativo, mas **nunca troca sem perguntar**. Aparece "Tem N obstáculos nesse caminho que pegam no seu carro · Achei outro caminho que desvia · +X min" com **Trocar rota** / **Manter caminho** (e a voz pergunta). Só oferece se desviar de algo e não for muito mais demorado (até 5 min a mais, ou até 50% do tempo que falta, nunca mais de 20 min). Uma pergunta por destino; sem resposta em 30 s, mantém. Se aceitou, os recálculos continuam desviando.

## Equipes
- Fundador/admin/staff cria **eventos** só com nome, **dia no calendário**, **horário** (hora e minutos), duração, **local por busca de endereço** (não precisa estar lá) e quem vê. Não escolhe tipo (fica como encontro).
- **Página da equipe:** cada equipe tem a sua página (capa, foto, bio, cidade, Instagram, fundador, membros, próximos eventos, botão "Pedir pra entrar" e, pro fundador/admin, os pedidos esperando), separada do perfil pessoal de quem fundou. O fundador continua com o perfil dele normal; no perfil aparecem as equipes (★ nas que fundou).
- Cada código de fundador vira **uma equipe só**; um pedido em aberto por vez. Quem quer entrar numa equipe que já existe pede pela página dela. O **Adm Master também pode ter a própria equipe** (pede e aprova) e usar o app como qualquer um.
- **Tema da equipe**: cor e formato dos botões. Aparece na tela/feed/rank da equipe e nas etiquetas do mapa. Cor escura é clareada automaticamente para leitura. Avisos de segurança continuam laranja para todos.
- **Prova de presença: "fazer a mídia"**: foto pela câmera do app (galeria não vale), no local e no horário do evento; o app confere se o carro bate com a garagem. Vale +50 XP na equipe; admin pode contestar em 24 h.

## Feed (rede social da cena)
- Posts com texto e foto, no **Geral** ou só pra equipe. Cada post mostra a foto de perfil, o @ e o carro do autor (da garagem).
- Curtir (muda na hora), comentar (tela do post), compartilhar, apagar o próprio post; o dono do post pode apagar comentários nele.
- **Tocar num carrinho no mapa** (Cena ao vivo ou GPS, inclusive o seu) abre um cartão com a foto e o @ da pessoa, o carrinho que ela montou (pela IA ou na mão), até 3 fotos reais do carro, tempo desde a última posição e o botão **Ver perfil completo**. Só aparece quem o `visible_cars()` já liberou.
- Perfil de cada um: foto, carro montado e o mural com abas **Tudo / Fotos do carro (em grade) / Enquetes**. No próprio perfil (e no feed) dá pra postar: **post** (texto e foto), **foto do carro** (foto obrigatória) ou **enquete** (pergunta + 2 a 4 opções). Próximos eventos em cartões no topo do feed.
- Enquete: voto secreto (só o total e a % aparecem), dá pra trocar o voto; o resultado aparece depois de votar (o autor sempre vê). Enquete só nasce pela `create_poll()`.

## Ranks
- **Rank de patente é interno de cada equipe** (só a equipe vê; sem disputa entre equipes). XP vem de: evento com mídia +50, rolê em comboio +30, convidado verificado +40.
- **Radar é soma geral** de todo mundo nas 3 cidades: pontos só por aviso confirmado por 3 pessoas. Buraco/Lombada alta/Valeta +15, Blitz/Rua ruim/Alagamento +10, Radar +5, confirmar aviso de outro +3. Aviso falso tira pontos. Blitz expira em 1 h, alagamento em 6 h, o resto em 7 dias sem confirmação.

## Dados de obstáculos
- Importação **automática toda semana** (o serviço de rotas tenta de hora em hora; cada pedaço do mapa (12 quadrados) só é baixado de novo depois de 6 dias; se o Overpass estiver fora, tenta outro servidor e de novo depois) + script manual. OpenStreetMap (traffic_calming, highway=speed_camera) + radares da ANTT (rodovias concedidas, ex.: Dutra, Ayrton Senna). Duplicados a menos de 15 m são juntados; cada ponto leva a cidade; tudo entra como "não confirmado". Script: `scripts/import_obstacles.py`.
- **Radares oficiais** (com a velocidade da placa), atualizados sozinhos a cada 6 dias: CET-SP (todos os radares da cidade de São Paulo), DER-SP (rodovias estaduais em SP, Guarulhos e Itaquá) e ANTT (rodovias federais concedidas). Entram já confirmados. Guarulhos não publica a lista dos radares municipais em dados abertos: lá valem os do DER/ANTT, os do OpenStreetMap e os avisos da galera.
- Não usar dados do Waze/Google (termos de uso).

## Adm Master
- Fica discreto: só **donos de equipe** (fundadores verificados) veem quem é o Adm Master, pela função `master_contact()`. Pros outros o perfil dele aparece como um membro comum; a tabela de perfis não mostra a marca de master nem os convites de ninguém (cada um vê os próprios dados por `my_profile()`).

## Conta, notificações e privacidade
- Aba **Conta**: editar perfil (nome, bio, foto; o @ não muda), notificações, privacidade e dados, atalhos (Ranks, câmera do mapa, tutorial) e **Sair da conta**.
- Notificações dentro do app (bolinha na aba Conta). O **Adm Master** recebe as equipes novas pedidas; o fundador/admin recebe pedidos pra entrar; a pessoa recebe aprovação/recusa, verificação, evento novo das equipes, comentário no post e convite usado. Dá pra desligar por assunto (Equipes, Eventos, Social). Também chegam no celular com o app fechado, se a pessoa ligar (ver Notificações no celular).
- Privacidade: **baixar meus dados** (arquivo .json com perfil, carros, equipes, posts, comentários, avisos, presenças e zonas privadas) e **apagar a conta** (digitando o @; fundador de equipe com membros precisa passar a equipe antes). Velocidade nunca é guardada.

## Eventos e equipes
- Painel de eventos com capa, data, equipe, cidade, local e descrição; **Confirmar presença** e, se a pessoa não é da equipe, **Pedir pra entrar** (o fundador aprova). Evento "aberto pra cena" aparece pra todo mundo; "só a equipe" só pros membros.
- **Descobrir equipes**: capa, foto, bio, Instagram, fundador, cidade, membros e próximo evento, com botão de pedir pra entrar.

## Garagem: ficha FIPE e carro 3D
- Depois da foto, a IA diz marca/modelo e o app abre a **ficha da tabela FIPE** já no modelo certo: a pessoa escolhe versão e ano e confirma. A ficha (código FIPE, versão, ano, combustível, preço médio) fica no carro e aparece no perfil.
- **Carros 3D do Car Kit da Kenney** (licença CC0, uso livre): hatch, sedã, perua, picape, SUV, esportivo e van/Kombi, no estilo "brinquedo" bem acabado. A cor da garagem pinta a lataria, o vidro fumê/limo escurece os vidros, rebaixado desce a carroceria e a cambagem inclina as rodas; o tamanho segue o modelo (Gol, Opala...). Crédito na tela Conta.
- O carro 3D segue o **formato do modelo e da geração** (Gol quadrado, bolinha, G5; Opala, Fusca, Kombi, Celta, Onix, HB20, Saveiro, S10, Civic etc., ~80 modelos), pela marca/modelo/versão da ficha FIPE e pelo ano. Desenho nosso, feito das medidas. Carro 3D realista igual aos apps grandes só com modelos 3D comprados/licenciados um por um.
- Barra de baixo **flutuante com fundo de vidro** (pílula, item ativo destacado).
- O carrinho do mapa virou **3D de verdade** (desenhado a partir da garagem: tipo, cor, vidro, aerofólio, aro, altura, cambagem, neon), visto de cima na diagonal e girando com a direção. Não usamos desenhos de jogos (direitos autorais e resolução baixa).

## Fora do escopo
- Nada que premie racha/velocidade na rua (ranking por velocidade, "puxada" entre carros). Competição só no Modo Pista, em local autorizado.

## Tech
- App: React Native (Expo), publicado **primeiro como site instalável (PWA)** em `https://marcha-gps.vercel.app` pra rodar em qualquer celular sem loja. A pessoa abre no navegador e usa "Adicionar à tela inicial". O mesmo código continua gerando o app nativo pra quando for pra Play Store/App Store.
- Limite do PWA: o navegador só manda a localização com o app **aberto na tela**. Se a pessoa bloqueia o celular ou troca de app, o carrinho dela some do mapa da equipe depois de 10 min (regra já existente). Compartilhar em segundo plano fica pro app nativo.
- Mapa: **MapLibre** (`@maplibre/maplibre-react-native`) + mapas gratuitos do **OpenFreeMap**. Mapbox descartado por custo. Dois visuais: navegação no estilo de app de trânsito (noite grafite ou dia claro, câmera inclinada, prédios planos) e **Cena ao vivo em 2D cinza-escuro** pra ver os carros. Plano B se o OpenFreeMap sair do ar: hospedar os próprios tiles (PMTiles) só da região.
- Banco: **Neon** (Postgres, região São Paulo) com a Data API.
- Fotos: **Cloudflare R2** com um Worker que confere o login do Clerk (o armazenamento do Neon não existe na região de São Paulo).
- Login: **Clerk** (`@clerk/expo`), código no e-mail. Escolhido porque o login do próprio Neon ainda não suporta app de celular (depende de cookie de navegador).
- **Login pra muita gente, de graça:** modo produção do Clerk (grátis até 50 mil usuários que voltam no mês) no domínio grátis **marchagps.eu.org** (DNS na Cloudflare, grátis). Enquanto o eu.org não aprova o domínio, segue o modo de teste (até 100 contas). Entradas: **Google, Facebook e e-mail** ("Entrar com Apple" saiu: a Apple cobra US$ 99/ano). Plano B se o eu.org demorar demais: .com.br (~R$ 40/ano), só trocando o domínio no Clerk.

## Segurança da comunidade
- **Bloquear:** no perfil da pessoa ou no ⋯ de um post. Vale pros dois lados: vocês param de ver posts, comentários e o carro um do outro no mapa. A pessoa não é avisada. Os avisos do Radar continuam aparecendo (são segurança de todo mundo). Lista e desbloquear em Conta > Privacidade e dados.
- **Denunciar** post, comentário, perfil ou aviso do Radar, com motivo (ofensivo, perigoso, golpe, expõe alguém, spam, não existe, outro). Quem denunciou nunca aparece. **3 pessoas diferentes** denunciando um post/comentário: ele some até o Adm Master decidir. O master recebe notificação na primeira denúncia e decide em Conta > Moderação: **manter** (volta a aparecer) ou **remover** (post/comentário apagado, aviso sai do Radar, perfil perde foto e bio); quem postou é avisado. Até 20 denúncias por dia por pessoa.
- **Termos de uso** (regras da comunidade, trânsito em primeiro lugar, 18+) e **Política de privacidade** (o que guardamos, pra quê, com quem, por quanto tempo, direitos da LGPD) abrem sem login: /termos e /privacidade. Falta definir o e-mail de contato.

## Cargo Staff
- Dentro de cada equipe, entre membro e admin. **Só o fundador nomeia** (Membro / Staff / Admin na lista de membros).
- Staff pode: criar eventos e comboios (e editar o que criou), aprovar ou recusar quem pede pra entrar (e recebe o aviso), fazer o check-in de presença (QR) e editar a página da equipe.
- Staff não pode: mudar cargos, tirar membros, passar a equipe, mexer no tema, contestar mídia nem apagar post dos outros.

## Comboio
- Fundador, admin ou staff começa o comboio com nome e destino; os membros verificados da equipe recebem o aviso e entram.
- Entrar no comboio = sua posição aparece **só pra quem está no comboio** (mesmo no modo fantasma), enquanto ele durar ou até você sair. Zona privada e bloqueio continuam valendo.
- Mostra quem está junto, quem chegou, quem está sem sinal e **quem ficou pra trás** (mais de 1,5 km atrás do primeiro, em linha reta até o destino) pra galera esperar. Nada de velocidade nem "quem chegou primeiro".
- Botão **Ir pro destino** abre a navegação. Quem criou (ou admin) encerra; fecha sozinho em 12 h; no máximo 3 abertos por equipe.
- XP de "rolê em comboio" ainda não conta (fica pra depois, com regra contra comboio de mentira).

## Notificações no celular
- Liga em Conta > Notificações > "Avisar neste celular". Vão os mesmos avisos do app (respeitando o que a pessoa escolheu receber), em até 1 minuto. Aviso com mais de 30 min sem ir não vai mais.
- Android (Chrome) funciona direto; iPhone só com o app instalado na tela de início (iOS 16.4+).

## Sem internet
- O app abre sem internet (casca guardada) e o mapa mostra os pedaços já vistos.
- Ao calcular a rota, o app baixa o mapa em volta dela; se o sinal cair, continua guiando pela rota guardada e só recalcula quando a internet voltar. Se o app fechar no meio, ao abrir de novo a rota continua (até 3 h).

## Convite por link
- O convite vai com link (`marcha-gps.vercel.app/c/CÓDIGO`): no WhatsApp aparece a prévia ("Fulano da Equipe X te convidou pro Marcha GPS") e o toque já abre o app com o código preenchido. Código de fundador não mostra quem mandou (o master fica discreto).

## Números do app (Adm Master)
- Conta > Números do app: pessoas (na conta, usaram na semana/hoje, no mapa agora, verificados, com carro, com notificação), cadastros dos últimos 14 dias, Radar, comunidade e as 10 equipes mais ativas em 30 dias (posts, eventos, check-ins, comboios, gente nova).

## Saúde do app
- Erro que acontece no app vai sozinho pro servidor (sem dado pessoal; token e e-mail são apagados da mensagem). Repetidos viram uma linha com contagem e quantas pessoas pegaram. Ficam 30 dias.
- De hora em hora o servidor checa banco, busca, rotas, mapa, site e login. Caiu ou voltou: o Adm Master recebe notificação. Tudo em Conta > Moderação > Saúde do app.

