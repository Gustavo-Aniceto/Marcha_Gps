// O comboio em que a pessoa está agora (se estiver): faz o mapa mandar a posição mesmo no modo
// fantasma (só quem está no comboio vê, regra do banco) e mostra quem ficou pra trás.
import { useEffect, useState } from 'react';
import { db } from './db';
import { convoyAlert, convoyRows, type ConvoyMember } from './convoy.ts';

export interface MyConvoy { id: string; title: string; crew_name: string; members: number; dest_lat: number; dest_lon: number }

export function useMyConvoy(enabled: boolean): { convoy: MyConvoy | null; alert: string | null } {
  const [convoy, setConvoy] = useState<MyConvoy | null>(null);
  const [alert, setAlert] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) { setConvoy(null); setAlert(null); return; }
    let alive = true;
    const load = async () => {
      const { data } = await db.rpc('my_convoys');
      if (!alive) return;
      const mine = ((data ?? []) as (MyConvoy & { joined: boolean })[]).find((c) => c.joined) ?? null;
      setConvoy(mine);
      if (!mine) { setAlert(null); return; }
      const { data: st } = await db.rpc('convoy_state', { p_convoy: mine.id });
      if (!alive || !st) return;
      const s = st as { members: ConvoyMember[] };
      setAlert(convoyAlert(convoyRows(s.members, { lat: mine.dest_lat, lon: mine.dest_lon })));
    };
    load();
    const t = setInterval(load, 20_000);
    return () => { alive = false; clearInterval(t); };
  }, [enabled]);

  return { convoy, alert };
}
