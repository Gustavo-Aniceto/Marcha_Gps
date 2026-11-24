import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CAMERA, type MapCameraSettings } from './mapCamera.ts';

const KEY = 'marcha.mapCamera';

const Ctx = createContext<{ camera: MapCameraSettings; setCamera: (c: MapCameraSettings) => void } | null>(null);

export function MapSettingsProvider({ children }: { children: React.ReactNode }) {
  const [camera, setCameraState] = useState<MapCameraSettings>(DEFAULT_CAMERA);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => { if (raw) setCameraState({ ...DEFAULT_CAMERA, ...JSON.parse(raw) }); })
      .catch(() => {});
  }, []);

  const setCamera = (c: MapCameraSettings) => {
    setCameraState(c);
    AsyncStorage.setItem(KEY, JSON.stringify(c)).catch(() => {});
  };

  return <Ctx.Provider value={{ camera, setCamera }}>{children}</Ctx.Provider>;
}

export function useMapSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMapSettings fora do MapSettingsProvider');
  return v;
}
