import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CAMERA, type MapCameraSettings } from './mapCamera.ts';
import { DEFAULT_FILTER, normalizeFilter, type MapFilter } from './mapFilter.ts';

const KEY = 'marcha.mapCamera';
const FILTER_KEY = 'marcha.mapFilter';

const Ctx = createContext<{
  camera: MapCameraSettings; setCamera: (c: MapCameraSettings) => void;
  filter: MapFilter; setFilter: (f: MapFilter) => void;
} | null>(null);

export function MapSettingsProvider({ children }: { children: React.ReactNode }) {
  const [camera, setCameraState] = useState<MapCameraSettings>(DEFAULT_CAMERA);
  const [filter, setFilterState] = useState<MapFilter>(DEFAULT_FILTER);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => { if (raw) setCameraState({ ...DEFAULT_CAMERA, ...JSON.parse(raw) }); })
      .catch(() => {});
    AsyncStorage.getItem(FILTER_KEY)
      .then((raw) => { if (raw) setFilterState(normalizeFilter(JSON.parse(raw))); })
      .catch(() => {});
  }, []);

  const setFilter = (f: MapFilter) => {
    setFilterState(f);
    AsyncStorage.setItem(FILTER_KEY, JSON.stringify(f)).catch(() => {});
  };

  const setCamera = (c: MapCameraSettings) => {
    setCameraState(c);
    AsyncStorage.setItem(KEY, JSON.stringify(c)).catch(() => {});
  };

  return <Ctx.Provider value={{ camera, setCamera, filter, setFilter }}>{children}</Ctx.Provider>;
}

export function useMapSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMapSettings fora do MapSettingsProvider');
  return v;
}
