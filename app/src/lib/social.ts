// Tipos e chamadas do feed social (posts, curtidas, comentários, perfil).
import { db } from './db';

export interface Post {
  id: string; author_id: string; username: string; avatar_key: string | null; author_car: string | null;
  crew_id: string | null; crew_name: string | null; crew_color: string | null; event_id: string | null;
  body: string; photo_key: string | null; created_at: string;
  likes: number; liked_by_me: boolean; comments: number; mine: boolean;
}

export interface Comment { id: string; author_id: string; username: string; avatar_key: string | null; body: string; created_at: string; mine: boolean }

export async function loadFeed(opts: { crew?: string | null; author?: string | null; before?: string | null; limit?: number }) {
  const { data, error } = await db.rpc('feed', {
    p_crew: opts.crew ?? null, p_before: opts.before ?? null, p_limit: opts.limit ?? 20, p_author: opts.author ?? null,
  });
  if (error) throw error;
  return (data ?? []) as Post[];
}

export async function toggleLike(p: Post, me: string) {
  const { error } = p.liked_by_me
    ? await db.from('post_likes').delete().eq('post_id', p.id).eq('user_id', me)
    : await db.from('post_likes').insert({ post_id: p.id, user_id: me });
  if (error) throw error;
}

export async function deletePost(id: string) {
  const { error } = await db.from('posts').delete().eq('id', id);
  if (error) throw error;
}

export function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d} d` : new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
