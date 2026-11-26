// Estado da navegação (destino, rota, recálculo, voz). As telas só leem daqui.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { buildRoute, initialNavState, navStep, routeErrorText, type Fix, type NavState, type NavUpdate, type Route } from './nav.ts';
import { fetchRoute, RoutingError, type Place } from './routing';
import { isOnline, saveRouteForOffline } from './pwa';

export type NavStatus = 'idle' | 'routing' | 'navigating' | 'rerouting' | 'arrived';

interface NavContext {
  status: NavStatus;
  destination: Place | null;
  route: Route | null;
  update: NavUpdate | null;
  error: string | null;
  voice: boolean;
  recents: Place[];
  setVoice: (on: boolean) => void;
  start: (dest: Place, from: Fix | null) => void;
  stop: () => void;
  onFix: (fix: Fix) => void;
  /** acha uma rota que desvia desses pontos, SEM trocar a atual (null se não deu) */
  findAlternative: (avoid: Point[]) => Promise<Route | null>;
  /** a pessoa aceitou: troca pra rota alternativa (e os recálculos continuam desviando) */
  switchToAlternative: (r: Route, avoid: Point[]) => void;
  speak: (text: string) => void;
  /** rota atual já é a que desvia */
  avoiding: boolean;
}

interface Point { lat: number; lon: number }

const Ctx = createContext<NavContext | null>(null);
const RECENTS_KEY = 'marcha.destinos.recentes';
const VOICE_KEY = 'marcha.navegacao.voz';
const MIN_REROUTE_MS = 8000;
// rota em andamento guardada no aparelho: se o app recarregar (ou abrir sem internet), continua guiando
const ACTIVE_KEY = 'marcha.navegacao.ativa';
const ACTIVE_MAX_MS = 3 * 3_600_000;
const OFFLINE_TEXT = 'Sem internet: seguindo a rota guardada. Recalculo quando o sinal voltar.';

interface SavedNav { dest: Place; route: Route; avoid: { lat: number; lon: number }[]; at: number }
function keepRoute(dest: Place, route: Route, avoidPts: { lat: number; lon: number }[]) {
  const v: SavedNav = { dest, route, avoid: avoidPts, at: Date.now() };
  AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(v)).catch(() => {});
  saveRouteForOffline(route.coords);
}
function forgetRoute() { AsyncStorage.removeItem(ACTIVE_KEY).catch(() => {}); }

function say(text: string, voice: boolean) {
  if (!voice || !text) return;
  try {
    Speech.stop();
    Speech.speak(text, { language: 'pt-BR', rate: 1.0 });
  } catch { /* sem voz neste aparelho */ }
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<NavStatus>('idle');
  const [destination, setDestination] = useState<Place | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [update, setUpdate] = useState<NavUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voice, setVoiceState] = useState(true);
  const [recents, setRecents] = useState<Place[]>([]);

  const navState = useRef<NavState>(initialNavState());
  const lastFix = useRef<Fix | null>(null);
  const lastReroute = useRef(0);
  const busy = useRef(false);
  const avoid = useRef<Point[]>([]);
  const [avoiding, setAvoiding] = useState(false);
  const live = useRef({ status, destination, route, voice });
  live.current = { status, destination, route, voice };

  useEffect(() => {
    AsyncStorage.getItem(RECENTS_KEY).then((v) => { try { if (v) setRecents(JSON.parse(v)); } catch { /* ignora */ } });
    AsyncStorage.getItem(VOICE_KEY).then((v) => { if (v === '0') setVoiceState(false); });
    // tinha uma rota em andamento (app recarregou / abriu sem sinal): continua nela
    AsyncStorage.getItem(ACTIVE_KEY).then((v) => {
      if (!v || live.current.destination) return;
      try {
        const saved = JSON.parse(v) as SavedNav;
        if (!saved.route?.coords?.length || Date.now() - saved.at > ACTIVE_MAX_MS) { forgetRoute(); return; }
        avoid.current = saved.avoid ?? []; setAvoiding((saved.avoid ?? []).length > 0);
        navState.current = initialNavState();
        lastReroute.current = Date.now();
        setDestination(saved.dest);
        setRoute(saved.route);
        setStatus('navigating');
        if (!isOnline()) setError(OFFLINE_TEXT);
      } catch { forgetRoute(); }
    });
  }, []);

  // tela não apaga enquanto navega
  const awake = useRef(false);
  useEffect(() => {
    const on = status === 'navigating' || status === 'rerouting';
    if (on && !awake.current) {
      awake.current = true;
      activateKeepAwakeAsync('navegacao').catch(() => { awake.current = false; });
    } else if (!on && awake.current) {
      awake.current = false;
      Promise.resolve().then(() => deactivateKeepAwake('navegacao')).catch(() => {});
    }
  }, [status]);

  const setVoice = useCallback((on: boolean) => {
    setVoiceState(on);
    AsyncStorage.setItem(VOICE_KEY, on ? '1' : '0');
    if (!on) Speech.stop();
  }, []);

  const calc = useCallback(async (dest: Place, from: Fix, reroute: boolean) => {
    if (busy.current) return;
    busy.current = true;
    lastReroute.current = Date.now();
    setStatus(reroute ? 'rerouting' : 'routing');
    setError(null);
    try {
      const r = buildRoute(await fetchRoute({ lat: from.lat, lon: from.lon, heading: from.heading ?? null }, dest, avoid.current));
      if (live.current.destination?.id !== dest.id) return; // cancelou no meio
      navState.current = initialNavState();
      setRoute(r);
      setStatus('navigating');
      keepRoute(dest, r, avoid.current);
      const first = navStep(r, navState.current, from);
      navState.current = first.state;
      setUpdate(first);
      say(reroute ? 'Rota recalculada.' : `Rota calculada. ${r.maneuvers[0]?.speak ?? ''}`, live.current.voice);
    } catch (e) {
      const code = e instanceof RoutingError ? e.message : 'rota_indisponivel';
      setError(code === 'sem_internet'
        ? (live.current.route ? OFFLINE_TEXT : 'Sem internet pra calcular a rota.')
        : routeErrorText(code));
      // no recálculo, continua mostrando a rota antiga até conseguir
      setStatus(live.current.route ? 'navigating' : 'idle');
      if (!live.current.route) setDestination(null);
    } finally {
      busy.current = false;
    }
  }, []);

  const start = useCallback((dest: Place, from: Fix | null) => {
    // Safari só deixa falar depois de um toque: já fala aqui, no toque
    say('Calculando a rota.', live.current.voice);
    avoid.current = []; setAvoiding(false);
    setDestination(dest);
    setRoute(null);
    setUpdate(null);
    setRecents((prev) => {
      const next = [dest, ...prev.filter((p) => p.id !== dest.id)].slice(0, 8);
      AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      return next;
    });
    const fix = from ?? lastFix.current;
    if (!fix) { setError('Esperando o GPS achar você…'); setStatus('routing'); return; }
    calc(dest, fix, false);
  }, [calc]);

  const stop = useCallback(() => {
    Speech.stop();
    forgetRoute();
    avoid.current = []; setAvoiding(false);
    setStatus('idle');
    setDestination(null);
    setRoute(null);
    setUpdate(null);
    setError(null);
    navState.current = initialNavState();
  }, []);

  const onFix = useCallback((fix: Fix) => {
    lastFix.current = fix;
    if (isOnline()) setError((e) => (e === OFFLINE_TEXT ? null : e)); // sinal voltou
    const { status: st, destination: dest, route: r, voice: v } = live.current;
    if (!dest) return;
    if (st === 'routing' && !r && !busy.current) { calc(dest, fix, false); return; } // GPS chegou depois do toque
    if (!r || st === 'arrived') return;
    const u = navStep(r, navState.current, fix);
    navState.current = u.state;
    setUpdate(u);
    if (u.speak) say(u.speak, v);
    if (u.arrived) { setStatus('arrived'); forgetRoute(); return; }
    if (u.needsReroute && st === 'navigating' && Date.now() - lastReroute.current > MIN_REROUTE_MS) {
      // sem internet não adianta pedir rota nova: segue a guardada e tenta de novo quando voltar
      if (!isOnline()) { lastReroute.current = Date.now(); setError(OFFLINE_TEXT); return; }
      calc(dest, fix, true);
    }
  }, [calc]);

  const findAlternative = useCallback(async (points: Point[]) => {
    const fix = lastFix.current, dest = live.current.destination;
    if (!fix || !dest || !points.length) return null;
    try {
      const r = buildRoute(await fetchRoute({ lat: fix.lat, lon: fix.lon, heading: fix.heading ?? null }, dest, points));
      return live.current.destination?.id === dest.id ? r : null;
    } catch { return null; }
  }, []);

  const switchToAlternative = useCallback((r: Route, points: Point[]) => {
    const fix = lastFix.current;
    if (!fix || !live.current.destination) return;
    avoid.current = points; setAvoiding(true);
    navState.current = initialNavState();
    setRoute(r);
    setStatus('navigating');
    keepRoute(live.current.destination, r, points);
    const first = navStep(r, navState.current, fix);
    navState.current = first.state;
    setUpdate(first);
    lastReroute.current = Date.now();
    say(`Rota trocada. ${r.maneuvers[0]?.speak ?? ''}`, live.current.voice);
  }, []);

  const speak = useCallback((text: string) => say(text, live.current.voice), []);

  const value = useMemo(() => ({ status, destination, route, update, error, voice, recents, setVoice, start, stop, onFix,
    findAlternative, switchToAlternative, speak, avoiding }),
    [status, destination, route, update, error, voice, recents, setVoice, start, stop, onFix, findAlternative, switchToAlternative, speak, avoiding]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNavigation(): NavContext {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNavigation fora do NavigationProvider');
  return c;
}
