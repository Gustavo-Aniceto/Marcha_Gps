// Termos de uso e política de privacidade (textos das páginas /termos e /privacidade).
// Linguagem simples, de propósito. Quando mudar algo que afete os dados, atualize a data.
// Não é parecer jurídico: vale passar por um advogado antes de abrir pro público grande.

export const LEGAL_UPDATED = '26 de novembro de 2026';

/** E-mail de contato sobre privacidade (LGPD). Enquanto não houver, a página mostra o caminho pelo app. */
export const CONTACT_EMAIL: string | null = null;

export interface LegalSection { title: string; items: string[] }

export const PRIVACY: LegalSection[] = [
  {
    title: 'Quem somos',
    items: [
      'O Marcha GPS é um app da cena de carro rebaixado de São Paulo, Guarulhos e Itaquaquecetuba: mapa, rotas que avisam o que pega no seu carro, avisos da galera, equipes e feed.',
      'O responsável pelos seus dados é o Marcha GPS (o dono do app, chamado de Adm Master dentro do app).',
    ],
  },
  {
    title: 'O que guardamos',
    items: [
      'Conta: o e-mail (e nome/foto, se você entrar com Google ou Facebook) fica no serviço de login (Clerk). No nosso banco fica só o identificador da conta.',
      'Perfil: nome de usuário, nome, bio, foto, quem te convidou e a data em que você entrou.',
      'Carros: marca, modelo, ano, cor, medidas (altura, aro, suspensão etc.), fotos que você manda e a ficha FIPE que você escolher.',
      'Localização: só enquanto o app está aberto e você não está no modo fantasma (ou está num comboio). Guardamos a última posição e um histórico curto de 15 minutos (usado pro atraso opcional na Cena ao vivo). Ao parar de compartilhar, o histórico é apagado. A velocidade nunca vai pro servidor.',
      'O que você publica: posts, fotos, comentários, curtidas, votos em enquete (secretos), avisos do Radar (com o local), confirmações, presença em eventos e fotos de "fazer a mídia".',
      'Equipes: de quais equipes você faz parte, pedidos pra entrar, verificações e convites.',
      'Segurança e moderação: quem você bloqueou, denúncias que você fez e as que recebeu.',
      'Comboio: de quais comboios você participou (entrada e saída). Ao entrar num comboio sua posição vai pro servidor mesmo no modo fantasma, só enquanto você estiver nele.',
      'Notificações no celular: se você ligar, guardamos o endereço que o navegador gera pra receber os avisos naquele aparelho (sem número de telefone). Desligou ou o aparelho saiu: apagamos.',
      'Uso: a última vez que você abriu o app (pra contar quantas pessoas usam; nunca aparece pra ninguém).',
      'No seu aparelho: o app guarda o mapa por onde você passou e a rota em andamento, pra funcionar sem internet. Fica só no seu celular.',
      'Erros do app: quando algo quebra, o app manda a mensagem do erro, a tela, o navegador/celular e a sua conta (se estiver logado). Fica 30 dias, só pra consertar o app.',
    ],
  },
  {
    title: 'Pra que usamos',
    items: [
      'Fazer o app funcionar: mostrar o seu carro pra quem você escolheu, calcular rotas, avisar obstáculos e radares, montar o feed e as equipes.',
      'Manter a comunidade segura: convites, verificação de membros, bloqueio, denúncias e moderação.',
      'Consertar e melhorar o app (erros e saúde dos serviços).',
      'Não vendemos seus dados, não mostramos anúncio e não fazemos perfil pra propaganda.',
    ],
  },
  {
    title: 'Quem vê o quê',
    items: [
      'Sua posição: só quem você escolher (Fantasma, Minhas equipes ou Cena ao vivo). Pra quem não é da sua equipe a posição é aproximada (~500 m) por padrão; zonas privadas (casa, trabalho) te escondem de todo mundo. Quem você bloqueou não vê seu carro. No comboio, quem está nele vê a posição exata de quem está nele (menos dentro de zona privada).',
      'Posts do Geral: qualquer pessoa com conta no app. Posts da equipe: só a equipe.',
      'Seu perfil (foto, @, nome, bio, carro e equipes): quem tem conta no app.',
      'Quem denunciou nunca aparece pra pessoa denunciada.',
    ],
  },
  {
    title: 'Com quem compartilhamos',
    items: [
      'Só com os serviços que fazem o app rodar, cada um pra sua parte: Neon (banco de dados, em São Paulo), Clerk (login), Cloudflare (fotos, nosso servidor e a IA que reconhece o carro pela foto; a foto vai só pra essa análise), Vercel (site do app).',
      'Busca de endereço e rotas: o lugar buscado e os pontos da rota passam pelo nosso servidor até o Photon (Komoot) e o Valhalla (FOSSGIS), sem o seu nome ou conta.',
      'Mapa: os quadradinhos do mapa vêm do OpenFreeMap (dados do OpenStreetMap), que vê o endereço de internet de quem baixa.',
      'Alguns desses serviços guardam dados fora do Brasil (por exemplo, nos Estados Unidos), com as proteções que eles oferecem.',
      'Notificações no celular: o aviso vai criptografado pelo serviço de notificação do seu navegador (Google, Apple, Mozilla ou Microsoft), que não consegue ler o conteúdo.',
      'Autoridades: só se a lei obrigar.',
    ],
  },
  {
    title: 'Por quanto tempo',
    items: [
      'Enquanto sua conta existir. Ao apagar a conta, somem perfil, carros, posts, comentários, posições, bloqueios e denúncias que você fez.',
      'Histórico de posição: 15 minutos. Erros do app: 30 dias. Avisos do Radar que você fez continuam no mapa sem o seu nome (são segurança de todo mundo).',
    ],
  },
  {
    title: 'Seus direitos (LGPD)',
    items: [
      'Ver e baixar seus dados: Conta > Privacidade e dados > Baixar meus dados.',
      'Corrigir: edite perfil e carros no app.',
      'Apagar: Conta > Privacidade e dados > Apagar minha conta (apaga também o login).',
      'Parar de compartilhar a localização: modo Fantasma, a qualquer hora.',
      'Tirar dúvida, pedir informação sobre o uso dos dados ou reclamar: pelo contato abaixo. Você também pode reclamar na ANPD (Autoridade Nacional de Proteção de Dados).',
    ],
  },
  {
    title: 'Idade',
    items: ['O Marcha GPS é pra maiores de 18 anos.'],
  },
];

export const TERMS: LegalSection[] = [
  {
    title: 'O combinado',
    items: [
      'Ao usar o Marcha GPS você concorda com estes termos e com a política de privacidade. O app é pra maiores de 18 anos.',
      'A entrada é por convite. Quem convida é padrinho e responde pelo convidado na comunidade.',
    ],
  },
  {
    title: 'Trânsito em primeiro lugar',
    items: [
      'Respeite as leis de trânsito, a sinalização e a velocidade da via. O app não substitui sua atenção: não mexa no celular dirigindo; peça pro passageiro ou pare o carro.',
      'Rotas, radares, lombadas e avisos podem estar errados ou desatualizados. Na dúvida, vale o que está na rua.',
      'O app não premia velocidade. Racha, manobra perigosa e "pega" na rua são proibidos aqui.',
    ],
  },
  {
    title: 'Regras da comunidade',
    items: [
      'Sem xingamento, ameaça, assédio, preconceito ou ódio.',
      'Sem expor ninguém: nada de placa, endereço, foto ou dado de outra pessoa sem ela querer.',
      'Sem golpe, venda suspeita, pedido de Pix ou link estranho. Sem spam.',
      'Sem conteúdo sexual, violento ou que incentive crime.',
      'Avisos do Radar têm que ser de verdade. Aviso falso de propósito tira pontos e pode tirar você do app.',
      'Poste só fotos suas ou que você tem direito de usar.',
    ],
  },
  {
    title: 'Denúncia e bloqueio',
    items: [
      'Dá pra denunciar post, comentário, perfil ou aviso (⋯ no post, "Denunciar" no comentário ou no perfil) e bloquear quem incomoda. Quem você bloqueia some pra você e você some pra ela (posts, comentários e o carro no mapa).',
      'Quando 3 pessoas diferentes denunciam um post ou comentário, ele fica escondido até o Adm Master decidir. O Adm Master pode manter ou remover o conteúdo e avisa quem postou.',
      'Quem quebra as regras pode ter conteúdo removido, perder convites, sair de equipe ou ter a conta encerrada.',
    ],
  },
  {
    title: 'Seu conteúdo',
    items: [
      'O que você posta continua seu. Você deixa o Marcha GPS mostrar isso dentro do app pras pessoas que podem ver, enquanto estiver publicado.',
      'Você pode apagar seus posts e comentários quando quiser.',
    ],
  },
  {
    title: 'O app',
    items: [
      'O app é gratuito e pode mudar, ficar fora do ar ou ganhar e perder funções. Avisamos no app quando mudar algo importante destes termos.',
      'Mapas: © colaboradores do OpenStreetMap. Carros 3D: Car Kit da Kenney (CC0).',
    ],
  },
];
