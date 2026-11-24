// O app só usa createPortal do react-dom (no mapa do navegador); declarado aqui pra não
// precisar do pacote @types/react-dom inteiro.
declare module 'react-dom' {
  import type { ReactNode, ReactPortal } from 'react';
  export function createPortal(children: ReactNode, container: Element | DocumentFragment, key?: string | null): ReactPortal;
}
