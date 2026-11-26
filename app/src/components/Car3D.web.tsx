// Carro 3D da garagem (no navegador): gira devagar sozinho e dá pra girar com o dedo.
// Se o aparelho não tiver WebGL, mostra o desenho de cima de sempre.
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { getStudio, type CarSpec } from '../lib/car3d';
import { CarMarker } from './CarMarker';

export function Car3DView({ spec, width = 300, height = 220, pitch = 58, autoRotate = true }:
  { spec: CarSpec; width?: number; height?: number; pitch?: number; autoRotate?: boolean }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [ok, setOk] = useState(true);
  const state = useRef({ rel: 215, dragging: false, lastX: 0, spin: 0 });
  const specRef = useRef(spec);
  specRef.current = spec;

  useEffect(() => {
    const studio = getStudio();
    if (!studio) { setOk(false); return; }
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || !canvas.current) return;
      const dt = Math.min(64, now - last); last = now;
      const st = state.current;
      if (autoRotate && !st.dragging) st.rel = (st.rel + dt * 0.012) % 360;
      st.spin += autoRotate ? dt * 0.002 : 0;
      studio.draw(canvas.current, specRef.current, { rel: st.rel, pitch, wheel: st.spin });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pitch, autoRotate]);

  if (!ok) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <CarMarker color={spec.color ?? undefined} neon={spec.neon} heading={0} body={spec.body} tint={spec.tint}
                   spoiler={spec.spoiler} size={Math.min(width, height) * 0.8} />
      </View>
    );
  }

  const side = Math.max(width, height);
  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
  const down = (x: number) => { state.current.dragging = true; state.current.lastX = x; };
  const move = (x: number) => {
    const st = state.current;
    if (!st.dragging) return;
    st.rel = (st.rel + (x - st.lastX) * 0.6) % 360;
    st.lastX = x;
  };
  const up = () => { state.current.dragging = false; };
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          accessibilityLabel="Seu carro em 3D. Arraste pro lado pra girar.">
      <canvas ref={canvas} width={side * dpr} height={side * dpr}
              style={{ width: side, height: side, touchAction: 'pan-y', cursor: 'grab' }}
              onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); down(e.clientX); }}
              onPointerMove={(e) => move(e.clientX)} onPointerUp={up} onPointerCancel={up} />
    </View>
  );
}
