import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import {
  DIRECTION_OPTIONS,
  MODE_IDS,
  MOTION_OPTIONS,
  OCTAVE_OPTIONS,
  ROO_MODES,
  ROO_POSITIONS,
  ROO_VERSION_IDS,
  SCALE_FAMILY_IDS,
} from '../domain/types';
import type { PitchClass } from '../domain/types';
import type { Settings, Visibility } from './types';
import { loadSettings, saveSettings } from './storage';
import { DEFAULT_SETTINGS } from './defaults';

/** Every list-valued key of `Settings`. */
export type ListSettingKey =
  | 'keys'
  | 'families'
  | 'modes'
  | 'motions'
  | 'octaves'
  | 'directions'
  | 'rooVersions'
  | 'rooModes'
  | 'rooPositions';

/** Ascending pitch-class order — mirrors the fallback ordering used in `storage.ts`. */
const ALL_KEYS: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Canonical display/storage order for each list-valued setting. */
const CANONICAL_ORDER: Record<ListSettingKey, readonly unknown[]> = {
  keys: ALL_KEYS,
  families: SCALE_FAMILY_IDS,
  modes: MODE_IDS,
  motions: MOTION_OPTIONS,
  octaves: OCTAVE_OPTIONS,
  directions: DIRECTION_OPTIONS,
  rooVersions: ROO_VERSION_IDS,
  rooModes: ROO_MODES,
  rooPositions: ROO_POSITIONS,
};

/** Reorders `values` into the canonical order for `key`, dropping anything not in that order. */
function reorder(key: ListSettingKey, values: readonly unknown[]): unknown[] {
  const wanted = new Set(values);
  return CANONICAL_ORDER[key].filter((v) => wanted.has(v));
}

export interface SettingsContextValue {
  readonly settings: Settings;
  /** Toggle one member of a list-valued setting, keeping canonical order. */
  toggle<K extends ListSettingKey>(key: K, value: Settings[K][number]): void;
  /** Replace a list wholesale — used by "select all" / "clear all". */
  setList<K extends ListSettingKey>(key: K, values: Settings[K]): void;
  setVisibility(key: 'notation' | 'fingering', value: Visibility): void;
  reset(): void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider(props: { children: ReactNode }): JSX.Element {
  // Lazy initialiser: reads localStorage exactly once, synchronously, before
  // first paint — so there's never a flash of default settings.
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const toggle = useCallback(<K extends ListSettingKey>(key: K, value: Settings[K][number]) => {
    setSettings((prev) => {
      const current: readonly unknown[] = prev[key];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [key]: reorder(key, next) } as unknown as Settings;
    });
  }, []);

  const setList = useCallback(<K extends ListSettingKey>(key: K, values: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: reorder(key, values) }) as unknown as Settings);
  }, []);

  const setVisibility = useCallback((key: 'notation' | 'fingering', value: Visibility) => {
    setSettings((prev) => (key === 'notation' ? { ...prev, notation: value } : { ...prev, fingering: value }));
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, toggle, setList, setVisibility, reset }),
    [settings, toggle, setList, setVisibility, reset],
  );

  return <SettingsContext.Provider value={value}>{props.children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings() must be called within a <SettingsProvider>.');
  }
  return ctx;
}
