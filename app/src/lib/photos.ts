// Envio e exibição de fotos pelo serviço de fotos (workers/fotos).
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { authToken } from './db';
import { JPEG_QUALITY, resizeTarget } from './photoSize';

const base = process.env.EXPO_PUBLIC_FOTOS_URL;

export type PhotoKind = 'media' | 'carro' | 'post';

export function photoUrl(key: string | null | undefined): string | null {
  if (!key || !base) return null;
  return `${base}/img/${key}`;
}

/** Reduz e converte pra JPEG antes de subir (economiza dados do usuário e espaço no R2). */
async function shrink(uri: string): Promise<string> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const target = resizeTarget(original.width, original.height);
  const image = target ? await ImageManipulator.manipulate(uri).resize(target).renderAsync() : original;
  const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return saved.uri;
}

/** Sobe a foto (uri local da câmera ou galeria) e devolve a chave pra gravar no banco. */
export async function uploadPhoto(uri: string, kind: PhotoKind): Promise<string> {
  if (!base) throw new Error('upload_failed');
  const token = await authToken();
  if (!token) throw new Error('not_authenticated');
  const file = await (await fetch(await shrink(uri))).blob();
  const type = 'image/jpeg';
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
