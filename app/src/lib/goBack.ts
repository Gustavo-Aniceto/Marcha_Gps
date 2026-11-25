// Voltar com segurança: se não tem tela anterior (abriu o link direto, recarregou a página,
// app instalado abriu já nessa tela), vai pra uma tela de destino em vez de não fazer nada.
type Nav = { canGoBack: () => boolean; back: () => void; replace: (href: never) => void };

export function goBack(router: Nav, fallback = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}
