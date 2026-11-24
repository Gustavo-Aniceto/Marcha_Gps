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
} as const;

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
