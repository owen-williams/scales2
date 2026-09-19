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
import type {
  DirectionOption,
  ModeId,
  MotionOption,
  OctaveCount,
  PitchClass,
  RuleOfOctaveMode,
  RuleOfOctavePosition,
  RuleOfOctaveVersionId,
  ScaleFamilyId,
} from '../domain/types';
import { VISIBILITY_OPTIONS } from './types';
import type { Settings, Visibility } from './types';
import { DEFAULT_SETTINGS } from './defaults';

export const STORAGE_KEY = 'scales.settings.v1';

/** Ascending pitch-class order — the canonical order for `keys` (no const array exists for it in the domain). */
const ALL_KEYS: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Filters `raw` (if it's an array) down to members of `allowed`, de-duplicated
 * and reordered into `allowed`'s canonical order. Anything else — wrong type,
 * unknown ids, duplicates — is silently dropped.
 */
function sanitizeList<T>(raw: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(raw)) return [];
  const present = new Set<unknown>(raw);
  return allowed.filter((value) => present.has(value));
}

function withFallback<T>(list: readonly T[], fallback: readonly T[]): readonly T[] {
  return list.length === 0 ? fallback : list;
}

function sanitizeVisibility(raw: unknown, fallback: Visibility): Visibility {
  return (VISIBILITY_OPTIONS as readonly unknown[]).includes(raw) ? (raw as Visibility) : fallback;
}

/**
 * Merges unknown/partial data onto `DEFAULT_SETTINGS`, dropping anything that
 * isn't recognised. Always returns a valid `Settings` — this is the whole
 * safety story for data coming out of `localStorage` (or anywhere else
 * untrusted), so it accepts genuinely anything as input.
 *
 * Only the keys named below are read, so a payload written by an older build
 * (one that still persisted a `hands` list, say) loads without complaint: the
 * extra key is simply not looked at. That is why the storage key stays at v1.
 *
 * `modes` may legitimately end up empty (the user can disable all modes), but
 * `families` and `modes` must never BOTH be empty — that would leave no
 * scales at all — so in that one case `families` falls back to the default.
 * Every other list falls back to its default when empty.
 *
 * `rooVersions` is the exception to that rule, and deliberately so: empty is how
 * the Rule of the Octave is switched off, and it is the default. Restoring a
 * fallback there would turn the feature back on every time the app reloaded.
 */
export function parseSettings(raw: unknown): Settings {
  const obj: Record<string, unknown> = isRecord(raw) ? raw : {};

  const keys = withFallback(sanitizeList<PitchClass>(obj.keys, ALL_KEYS), DEFAULT_SETTINGS.keys);
  const families = sanitizeList<ScaleFamilyId>(obj.families, SCALE_FAMILY_IDS);
  const modes = sanitizeList<ModeId>(obj.modes, MODE_IDS);
  const motions = withFallback(
    sanitizeList<MotionOption>(obj.motions, MOTION_OPTIONS),
    DEFAULT_SETTINGS.motions,
  );
  const octaves = withFallback(
    sanitizeList<OctaveCount>(obj.octaves, OCTAVE_OPTIONS),
    DEFAULT_SETTINGS.octaves,
  );
  const directions = withFallback(
    sanitizeList<DirectionOption>(obj.directions, DIRECTION_OPTIONS),
    DEFAULT_SETTINGS.directions,
  );

  // No `withFallback`: an empty list here means "the rule is off", which is a
  // choice to preserve, not a corruption to repair.
  const rooVersions = sanitizeList<RuleOfOctaveVersionId>(obj.rooVersions, ROO_VERSION_IDS);
  const rooModes = withFallback(
    sanitizeList<RuleOfOctaveMode>(obj.rooModes, ROO_MODES),
    DEFAULT_SETTINGS.rooModes,
  );
  const rooPositions = withFallback(
    sanitizeList<RuleOfOctavePosition>(obj.rooPositions, ROO_POSITIONS),
    DEFAULT_SETTINGS.rooPositions,
  );

  // Both scale lists empty used to mean "no exercises at all", so `families`
  // was restored. Now that the Rule of the Octave can fill the pool by itself,
  // a user who wants nothing but the rule must be able to say so and have it
  // survive a reload — so the rescue applies only when the rule is off too.
  const noScales = families.length === 0 && modes.length === 0;
  const finalFamilies = noScales && rooVersions.length === 0 ? DEFAULT_SETTINGS.families : families;

  return {
    keys,
    families: finalFamilies,
    modes,
    motions,
    octaves,
    directions,
    rooVersions,
    rooModes,
    rooPositions,
    notation: sanitizeVisibility(obj.notation, DEFAULT_SETTINGS.notation),
    fingering: sanitizeVisibility(obj.fingering, DEFAULT_SETTINGS.fingering),
  };
}

/**
 * Resolves the storage to use, without ever throwing — merely *accessing*
 * `localStorage` can throw (Safari private browsing in older versions), so
 * this is deliberately its own try/catch rather than a default parameter
 * value (default-parameter evaluation happens before a function body's
 * try/catch can run, so it wouldn't protect us).
 */
function resolveStorage(storage: Storage | undefined): Storage | undefined {
  if (storage) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** Never throws: returns `DEFAULT_SETTINGS` if storage is unavailable, empty, corrupt or invalid. */
export function loadSettings(storage?: Storage): Settings {
  const store = resolveStorage(storage);
  if (!store) return DEFAULT_SETTINGS;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    return parseSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Never throws (private browsing / quota errors are swallowed). */
export function saveSettings(settings: Settings, storage?: Storage): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Quota exceeded, storage disabled, etc. — persistence is best-effort.
  }
}
