// Cores e fontes do Marcha GPS. Não usar cor solta nas telas: importar daqui.

// Visual "grafite": fundo quase preto, cartões em camadas de cinza, bordas bem sutis e um verde-limão
// suave só no que importa (como painéis de operação/frota). Avisos de segurança continuam laranja.
export const colors = {
  bg: '#0A0B0D',
  panel: '#15171B',
  panelAlt: '#1C1F24',
  line: '#25282E',
  lineStrong: '#363A42',
  text: '#EEEFF1',
  textDim: '#B5B9C1',
  textMuted: '#7F848D',
  holo: '#B9C8E4',   // links e detalhes (azul acinzentado, discreto)
  neon: '#C9EE62',   // cor padrão (e da equipe, se ela não escolher outra)
  ink: '#0B0D08',    // texto em cima do neon
  // avisos de segurança: sempre essas cores, o tema da equipe não muda
  warn: '#FF8A1F',
  warnBg: '#1E1812',
  warnText: '#FFD9B5',
  danger: '#FF5A5A',
  target: '#FFC233', // mira amarela em volta dos carros
  // placa de velocidade (igual à da rua: fundo branco, aro vermelho, número preto)
  signFace: '#FFFFFF',
  signRing: '#E11D1D',
  // linha da rota (roxa, como nos apps de trânsito mais usados)
  route: '#8C5BFF',
  routeCasing: '#3F2390',
  // barra de abas lá embaixo
  tabBar: '#121417',
  tabBarLine: '#25282E',
  // camadas de vidro (cartões sobre o mapa, barra de baixo)
  glass: 'rgba(21,23,27,0.72)',
  glassLine: 'rgba(255,255,255,0.08)',
  ok: '#7BE0A0',
} as const;

// "Casca" do modo GPS (barras, botões redondos), no visual que o público já conhece de app de trânsito.
// A barra da manobra lá em cima é sempre escura; o resto acompanha o tema do mapa (noite/dia).
export const chrome = {
  noite: { panel: '#17191D', text: '#F2F3F5', sub: '#9EA3AC', border: '#2C3037', button: '#1E2125', icon: '#E6E8EC' },
  dia: { panel: '#FFFFFF', text: '#14171C', sub: '#5D6675', border: '#DDE2EA', button: '#FFFFFF', icon: '#2A2F3A' },
  banner: '#0F1115',
  bannerText: '#FFFFFF',
  street: '#7CC7FF', // nome da rua na barra da manobra
  report: '#FFC21A', // botão de avisar (amarelo, como o público conhece)
  locate: '#33A3FF',
} as const;
export type ChromeTheme = typeof chrome.noite | typeof chrome.dia;

// Títulos e números na fonte do próprio celular (SF no iPhone, Roboto no Android): limpa e moderna.
// A fonte "de corrida" (Chakra Petch, carregada no app/_layout.tsx) fica só na marca MARCHA GPS.
// (sem importar react-native aqui: os testes leem este arquivo direto no Node)
const IS_WEB = typeof document !== 'undefined';
const SYSTEM = IS_WEB
  ? 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif'
  : undefined;
const SYSTEM_MONO = IS_WEB
  ? 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace'
  : 'ShareTechMono-Regular';
export const fonts = {
  brand: 'ChakraPetch-Bold',
  display: SYSTEM as string | undefined,
  mono: SYSTEM_MONO as string,
};

export const radius = {
  redondo: 999,
  reto: 14,
  quadrado: 4,
} as const;

// cantos padrão
export const corner = { card: 20, field: 14, chip: 999 } as const;

export type ButtonShape = keyof typeof radius;

export const touch = 44; // alvo mínimo de toque
