// Envio e exibição de fotos pelo serviço de fotos (workers/fotos).
import { authToken } from './db';

const base = process.env.EXPO_PUBLIC_FOTOS_URL;

export type PhotoKind = 'media' | 'carro' | 'post';

export function photoUrl(key: string | null | undefined): string | null {
  if (!key || !base) return null;
  return `${base}/img/${key}`;
}

/** Sobe a foto (uri local da câmera ou galeria) e devolve a chave pra gravar no banco. */
export async function uploadPhoto(uri: string, kind: PhotoKind): Promise<string> {
  if (!base) throw new Error('upload_failed');
  const token = await authToken();
  if (!token) throw new Error('not_authenticated');
  const file = await (await fetch(uri)).blob();
  const type = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
  const res = await fetch(`${base}/upload?tipo=${kind}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': type },
    body: file,
  });
  if (res.status === 413) throw new Error('photo_too_big');
  if (!res.ok) throw new Error('upload_failed');
  const { key } = (await res.json()) as { key: string };
  return key;
}
