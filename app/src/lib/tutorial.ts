// Tutorial do primeiro acesso: o que cada parte do app faz, em poucas telas.
// Aparece sozinho uma vez (depois do primeiro login) e dá pra rever pelo menu ☰ do mapa.

export const TUTORIAL_KEY = 'marcha.tutorial.visto.v1';

export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  /** dica curta de onde fica na tela */
  where: string;
  /** desenho 24x24 (traço) que ilustra a tela */
  icon: string;
  /** cor de destaque: neon do app, amarelo do botão de avisar ou laranja dos avisos */
  tone: 'neon' | 'report' | 'warn' | 'route';
}

export const TUTORIAL: TutorialStep[] = [
  {
    id: 'boas-vindas', tone: 'neon', where: 'Leva 1 minuto',
    title: 'Bem-vindo ao Marcha GPS',
    text: 'O GPS dos carros modificados e originais: rota que conhece o seu carro, avisos de lombada e valeta, e a sua equipe no mapa.',
    icon: 'M12 3a7 7 0 0 0-7 7c0 5 7 11 7 11s7-6 7-11a7 7 0 0 0-7-7Z M12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  },
  {
    id: 'garagem', tone: 'neon', where: 'Aba Garagem',
    title: 'Monte o seu carro',
    text: 'Manda de 1 a 3 fotos e a IA monta o carrinho que aparece no mapa. Coloca a altura do chão: é com ela que o GPS sabe o que raspa no seu carro.',
    icon: 'M3 16v-3l2-5h14l2 5v3H3Z M7.5 17.5a2 2 0 1 0 0 .01 M16.5 17.5a2 2 0 1 0 0 .01',
  },
  {
    id: 'rota', tone: 'route', where: 'Mapa · barra “Para onde?”',
    title: 'Para onde?',
    text: 'Busca o endereço e sai navegando com voz. Se tiver lombada ou valeta que pega no seu carro, o app avisa e pergunta se você quer um caminho que desvia. Ele nunca troca sozinho.',
    icon: 'M5 19c3-6 11-2 14-14 M15 5h4v4',
  },
  {
    id: 'avisar', tone: 'report', where: 'Mapa · botão amarelo',
    title: 'Avise a galera',
    text: 'Viu lombada alta, valeta, buraco, blitz ou radar? Toque no botão amarelo (com o carro parado ou pelo carona). Quando 3 pessoas confirmam, você ganha pontos no Radar.',
    icon: 'M12 3 2 20h20L12 3Z M12 10v4 M12 17v.5',
  },
  {
    id: 'quem-ve', tone: 'neon', where: 'Mapa · menu ☰ → Quem vê meu carro',
    title: 'Você escolhe quem te vê',
    text: 'Fantasma: ninguém te vê. Minhas equipes: todas as suas equipes ou só uma. Cena ao vivo: a cena toda, com posição aproximada pra quem é de fora. Casa e trabalho podem ficar escondidos.',
    icon: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  },
  {
    id: 'cena', tone: 'neon', where: 'Mapa · botão “Cena ao vivo”',
    title: 'Cena ao vivo',
    text: 'O mapa com os carros da galera que escolheu aparecer. Toque num carrinho pra ver o perfil, o carro e as fotos.',
    icon: 'M4 18a8 8 0 0 1 16 0 M8 18a4 4 0 0 1 8 0 M12 18v.01',
  },
  {
    id: 'equipes', tone: 'neon', where: 'Aba Equipes',
    title: 'Entre na sua equipe',
    text: 'Ache a sua equipe na lista, abra a página dela e toque em “Pedir pra entrar”. Quem aprova é o fundador. Depois a galera confirma que te conhece e um admin faz o check-in com o seu QR num encontro.',
    icon: 'M3 20a6 6 0 0 1 12 0 M9 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M16 5a3 3 0 0 1 0 6 M18 20a6 6 0 0 0-3-5.2',
  },
  {
    id: 'feed', tone: 'neon', where: 'Aba Feed',
    title: 'Feed da cena',
    text: 'Poste rolê, foto do carro e enquete, curta e comente. Os próximos eventos da equipe aparecem no topo.',
    icon: 'M4 5h16v11H8l-4 4V5Z',
  },
];

/** Próximo passo (ou null no fim). */
export function nextStep(i: number): number | null {
  return i + 1 < TUTORIAL.length ? i + 1 : null;
}
