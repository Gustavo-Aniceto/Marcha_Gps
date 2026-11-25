// Cores e fontes do Marcha GPS. Não usar cor solta nas telas: importar daqui.

export const colors = {
  bg: '#070B12',
  panel: '#0B111C',
  panelAlt: '#0E1626',
  line: '#1E3354',
  lineStrong: '#2F5E9E',
  text: '#E8ECF2',
  textDim: '#B4BCCB',
  textMuted: '#8A93A6',
  holo: '#9CC8FF',
  neon: '#C6FF3D', // cor padrão (e da equipe, se ela não escolher outra)
  ink: '#04060A', // texto em cima do neon
  // avisos de segurança: sempre essas cores, o tema da equipe não muda
  warn: '#FF8A1F',
  warnBg: '#1C1610',
  warnText: '#FFD9B5',
  danger: '#FF4D4D',
  target: '#FFC233', // mira amarela em volta dos carros
  // placa de velocidade (igual à da rua: fundo branco, aro vermelho, número preto)
  signFace: '#FFFFFF',
  signRing: '#E11D1D',
  // linha da rota (roxa, como nos apps de trânsito mais usados)
  route: '#8C5BFF',
  routeCasing: '#3F2390',
  // barra de abas lá embaixo
  tabBar: '#0F1218',
  tabBarLine: '#222836',
} as const;

// "Casca" do modo GPS (barras, botões redondos), no visual que o público já conhece de app de trânsito.
// A barra da manobra lá em cima é sempre escura; o resto acompanha o tema do mapa (noite/dia).
export const chrome = {
  noite: { panel: '#20242D', text: '#F2F4F7', sub: '#A9B1BF', border: '#323846', button: '#2A2F3A', icon: '#E6E9EF' },
  dia: { panel: '#FFFFFF', text: '#14171C', sub: '#5D6675', border: '#DDE2EA', button: '#FFFFFF', icon: '#2A2F3A' },
  banner: '#0F1115',
  bannerText: '#FFFFFF',
  street: '#7CC7FF', // nome da rua na barra da manobra
  report: '#FFC21A', // botão de avisar (amarelo, como o público conhece)
  locate: '#33A3FF',
} as const;
export type ChromeTheme = typeof chrome.noite | typeof chrome.dia;

// carregadas no app/_layout.tsx; o resto usa a fonte do sistema
export const fonts = {
  display: 'ChakraPetch-Bold',
  mono: 'ShareTechMono-Regular',
} as const;

export const radius = {
  redondo: 999,
  reto: 6,
  quadrado: 0,
} as const;

export type ButtonShape = keyof typeof radius;

export const touch = 44; // alvo mínimo de toque
