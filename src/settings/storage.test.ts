import { beforeEach, describe, expect, it } from 'vitest';
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
import { DEFAULT_SETTINGS } from './defaults';
import { STORAGE_KEY, loadSettings, parseSettings, saveSettings } from './storage';
import type { Settings } from './types';

/** A minimal `Storage` whose getItem/setItem can be made to throw, for
 * exercising the "storage is unavailable" paths. */
function createStorage(opts: { throwOnGetItem?: boolean; throwOnSetItem?: boolean } = {}): Storage {
  const backing = new Map<string, string>();
  return {
    get length() {
      return backing.size;
    },
    clear: () => backing.clear(),
    getItem: (key: string) => {
      if (opts.throwOnGetItem) throw new Error('getItem is not available');
      return backing.has(key) ? (backing.get(key) as string) : null;
    },
    key: (index: number) => Array.from(backing.keys())[index] ?? null,
    removeItem: (key: string) => {
      backing.delete(key);
    },
    setItem: (key: string, value: string) => {
      if (opts.throwOnSetItem) throw new Error('setItem is not available');
      backing.set(key, value);
    },
  };
}

/** Temporarily replaces the global `localStorage` accessor, restoring it afterwards. */
function withThrowingGlobalLocalStorage(run: () => void): void {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('localStorage denied (e.g. private browsing)');
    },
  });
  try {
    run();
  } finally {
    if (original) {
      Object.defineProperty(globalThis, 'localStorage', original);
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  }
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('parseSettings', () => {
  const cases: Array<{ name: string; input: unknown; expected: Settings }> = [
    { name: 'null', input: null, expected: DEFAULT_SETTINGS },
    { name: 'undefined', input: undefined, expected: DEFAULT_SETTINGS },
    { name: 'a string', input: 'not settings', expected: DEFAULT_SETTINGS },
    { name: 'a number', input: 42, expected: DEFAULT_SETTINGS },
    { name: 'a boolean', input: true, expected: DEFAULT_SETTINGS },
    { name: 'an array (valid JSON, wrong shape)', input: [1, 2, 3], expected: DEFAULT_SETTINGS },
    { name: 'an empty object', input: {}, expected: DEFAULT_SETTINGS },
    {
      name: 'a partial object (missing keys fall back individually)',
      input: { notation: 'hidden' },
      expected: { ...DEFAULT_SETTINGS, notation: 'hidden' },
    },
    {
      name: 'a field with the wrong type (string instead of array)',
      input: { keys: 'C, D, E' },
      expected: DEFAULT_SETTINGS,
    },
    {
      name: 'a field with the wrong type (object instead of array)',
      input: { families: { major: true } },
      expected: DEFAULT_SETTINGS,
    },
    {
      name: 'an array containing unknown ids',
      input: { families: ['major', 'bogus', 'harmonicMinor'] },
      expected: { ...DEFAULT_SETTINGS, families: ['major', 'harmonicMinor'] },
    },
    {
      name: 'an array with duplicates, de-duplicated',
      input: { keys: [0, 0, 1, 1, 0] },
      expected: { ...DEFAULT_SETTINGS, keys: [0, 1] },
    },
    {
      name: 'an array out of order, reordered canonically',
      input: { families: ['chromatic', 'major', 'naturalMinor'] },
      expected: { ...DEFAULT_SETTINGS, families: ['major', 'naturalMinor', 'chromatic'] },
    },
    {
      name: 'keys entirely unknown ids, falls back to default keys (empty after filtering)',
      input: { keys: [99, -1, 'C'] },
      expected: DEFAULT_SETTINGS,
    },
    {
      name: 'modes explicitly empty is legitimate and preserved when families is non-empty',
      input: { modes: [] },
      expected: DEFAULT_SETTINGS, // modes already [] by default
    },
    {
      name: 'modes non-empty is kept, in canonical order (families, unset, normalizes to empty but is not defaulted since modes covers the pool)',
      input: { modes: ['locrian', 'dorian'] },
      expected: { ...DEFAULT_SETTINGS, families: [], modes: ['dorian', 'locrian'] },
    },
    {
      name: 'families empty but modes non-empty: families stays empty (modes cover the pool)',
      input: { families: [], modes: ['dorian'] },
      expected: { ...DEFAULT_SETTINGS, families: [], modes: ['dorian'] },
    },
    {
      name: 'families and modes both empty: families falls back to default, modes stays empty',
      input: { families: [], modes: [] },
      expected: { ...DEFAULT_SETTINGS, families: DEFAULT_SETTINGS.families, modes: [] },
    },
    {
      name: 'families all-unknown collapses to empty and, with modes also empty, falls back',
      input: { families: ['bogus'], modes: [] },
      expected: { ...DEFAULT_SETTINGS, families: DEFAULT_SETTINGS.families, modes: [] },
    },
    { name: 'motions empty falls back to default', input: { motions: [] }, expected: DEFAULT_SETTINGS },
    { name: 'octaves empty falls back to default', input: { octaves: [] }, expected: DEFAULT_SETTINGS },
    { name: 'directions empty falls back to default', input: { directions: [] }, expected: DEFAULT_SETTINGS },
    {
      name: 'octaves with unknown numeric values filtered out and de-duplicated',
      input: { octaves: [1, 1, 5, 2, 0] },
      expected: { ...DEFAULT_SETTINGS, octaves: [1, 2] },
    },
    {
      name: 'notation with an invalid value falls back to default',
      input: { notation: 'sometimes' },
      expected: DEFAULT_SETTINGS,
    },
    {
      name: 'notation with a valid value is kept',
      input: { notation: 'always' },
      expected: { ...DEFAULT_SETTINGS, notation: 'always' },
    },
    {
      name: 'fingering with an invalid value falls back to default',
      input: { fingering: 123 },
      expected: DEFAULT_SETTINGS,
    },
    {
      name: 'a fully valid, already-canonical Settings object round-trips exactly',
      input: DEFAULT_SETTINGS,
      expected: DEFAULT_SETTINGS,
    },
    {
      // The app used to persist a `hands` list. Nothing reads it any more, and
      // an unknown key is simply not looked at — which is why STORAGE_KEY is
      // still v1 and no migration exists.
      name: 'a legacy `hands` key left over from an older build is ignored',
      input: { ...DEFAULT_SETTINGS, hands: ['right', 'left', 'both'] },
      expected: DEFAULT_SETTINGS,
    },
    {
      name: 'a legacy `hands` key does not disturb the settings alongside it',
      input: { hands: ['separately'], keys: [0, 7], notation: 'always' },
      expected: { ...DEFAULT_SETTINGS, keys: [0, 7], notation: 'always' },
    },
    {
      name: 'any other unrecognised key is ignored too',
      input: { ...DEFAULT_SETTINGS, tempo: 120, favouriteScale: 'major' },
      expected: DEFAULT_SETTINGS,
    },

    // --- the Rule of the Octave -------------------------------------------
    {
      // The shape the app persisted before the rule existed: no roo* keys at
      // all. It must load cleanly, with the rule switched off, which is also
      // what a first-time user gets.
      name: 'a payload from the currently released shape loads to the defaults, rule off',
      input: {
        keys: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        families: ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor', 'chromatic'],
        modes: [],
        motions: ['similar'],
        octaves: [1, 2],
        directions: ['both'],
        notation: 'reveal',
        fingering: 'reveal',
      },
      expected: DEFAULT_SETTINGS,
    },
    {
      name: 'a released-shape payload with customised scales keeps them and adds the rule defaults',
      input: {
        keys: [0, 7],
        families: ['harmonicMinor'],
        modes: ['dorian'],
        motions: ['contrary'],
        octaves: [2],
        directions: ['ascending'],
        notation: 'always',
        fingering: 'hidden',
      },
      expected: {
        ...DEFAULT_SETTINGS,
        keys: [0, 7],
        families: ['harmonicMinor'],
        modes: ['dorian'],
        motions: ['contrary'],
        octaves: [2],
        directions: ['ascending'],
        notation: 'always',
        fingering: 'hidden',
      },
    },
    {
      name: 'rooVersions empty is preserved — that is how the rule is switched off',
      input: { rooVersions: [] },
      expected: DEFAULT_SETTINGS,
    },
    {
      name: 'rooVersions entirely unknown collapses to empty rather than falling back',
      input: { rooVersions: ['heinichen', 'gasparini'] },
      expected: { ...DEFAULT_SETTINGS, rooVersions: [] },
    },
    {
      name: 'rooVersions keeps known ids and drops unknown ones',
      input: { ...DEFAULT_SETTINGS, rooVersions: ['campion', 'heinichen'] },
      expected: { ...DEFAULT_SETTINGS, rooVersions: ['campion'] },
    },
    {
      name: 'rooVersions is de-duplicated and reordered canonically',
      input: { ...DEFAULT_SETTINGS, rooVersions: ['campion', 'fenaroli', 'campion'] },
      expected: { ...DEFAULT_SETTINGS, rooVersions: ['fenaroli', 'campion'] },
    },
    {
      // An absent list has always meant an empty one (see the `modes` cases
      // above), and the scale rescue only fires when nothing else can fill the
      // pool — so naming a version is enough to leave the scales genuinely off.
      name: 'a payload naming only a rule version leaves the scale lists empty',
      input: { rooVersions: ['fenaroli'] },
      expected: { ...DEFAULT_SETTINGS, families: [], modes: [], rooVersions: ['fenaroli'] },
    },
    {
      name: 'rooVersions with the wrong type is dropped, leaving the rule off',
      input: { rooVersions: 'fenaroli' },
      expected: DEFAULT_SETTINGS,
    },
    {
      name: 'rooModes empty falls back to the default (both)',
      input: { rooModes: [] },
      expected: DEFAULT_SETTINGS,
    },
    {
      name: 'rooModes keeps one mode and reorders canonically',
      input: { rooModes: ['minor'] },
      expected: { ...DEFAULT_SETTINGS, rooModes: ['minor'] },
    },
    {
      name: 'rooModes drops unknown modes and de-duplicates',
      input: { rooModes: ['minor', 'lydian', 'major', 'minor'] },
      expected: { ...DEFAULT_SETTINGS, rooModes: ['major', 'minor'] },
    },
    {
      name: 'rooPositions empty falls back to all three',
      input: { rooPositions: [] },
      expected: DEFAULT_SETTINGS,
    },
    {
      name: 'rooPositions drops out-of-range values and de-duplicates',
      input: { rooPositions: [3, 3, 0, 4, 1] },
      expected: { ...DEFAULT_SETTINGS, rooPositions: [1, 3] },
    },
    {
      name: 'rooPositions entirely unknown falls back to the default',
      input: { rooPositions: [7, 8] },
      expected: DEFAULT_SETTINGS,
    },
    {
      name: 'a rule-only payload survives: every scale list empty, the rule on',
      input: { families: [], modes: [], rooVersions: ['fenaroli'] },
      expected: { ...DEFAULT_SETTINGS, families: [], modes: [], rooVersions: ['fenaroli'] },
    },
    {
      name: 'with the rule off, both scale lists empty still rescues families',
      input: { families: [], modes: [], rooVersions: [] },
      expected: DEFAULT_SETTINGS,
    },
  ];

  it.each(cases)('$name', ({ input, expected }) => {
    expect(parseSettings(input)).toEqual(expected);
  });

  it('always returns every family id in canonical order regardless of input order/dupes', () => {
    const shuffled = [...SCALE_FAMILY_IDS].reverse().concat(SCALE_FAMILY_IDS);
    const result = parseSettings({ families: shuffled });
    expect(result.families).toEqual(SCALE_FAMILY_IDS);
  });

  it('canonical mode order matches MODE_IDS', () => {
    const result = parseSettings({ modes: [...MODE_IDS].reverse() });
    expect(result.modes).toEqual(MODE_IDS);
  });

  it('canonical motions order matches MOTION_OPTIONS', () => {
    const result = parseSettings({ motions: [...MOTION_OPTIONS].reverse() });
    expect(result.motions).toEqual(MOTION_OPTIONS);
  });

  it('canonical octaves order matches OCTAVE_OPTIONS', () => {
    const result = parseSettings({ octaves: [...OCTAVE_OPTIONS].reverse() });
    expect(result.octaves).toEqual(OCTAVE_OPTIONS);
  });

  it('canonical directions order matches DIRECTION_OPTIONS', () => {
    const result = parseSettings({ directions: [...DIRECTION_OPTIONS].reverse() });
    expect(result.directions).toEqual(DIRECTION_OPTIONS);
  });

  it('never leaves both families and modes empty', () => {
    const result = parseSettings({ families: [], modes: [] });
    expect(result.families.length + result.modes.length).toBeGreaterThan(0);
  });

  it('canonical rooVersions order matches ROO_VERSION_IDS', () => {
    const result = parseSettings({ rooVersions: [...ROO_VERSION_IDS].reverse() });
    expect(result.rooVersions).toEqual(ROO_VERSION_IDS);
  });

  it('canonical rooModes order matches ROO_MODES', () => {
    const result = parseSettings({ rooModes: [...ROO_MODES].reverse() });
    expect(result.rooModes).toEqual(ROO_MODES);
  });

  it('canonical rooPositions order matches ROO_POSITIONS', () => {
    const result = parseSettings({ rooPositions: [...ROO_POSITIONS].reverse() });
    expect(result.rooPositions).toEqual(ROO_POSITIONS);
  });

  it('leaves the rule switched off unless a payload asks for it', () => {
    // The one list with no empty-fallback: every route into parseSettings that
    // does not name a version must come out with none.
    for (const input of [null, {}, { rooVersions: [] }, { rooVersions: ['bogus'] }, { keys: [0] }]) {
      expect(parseSettings(input).rooVersions).toEqual([]);
    }
    expect(parseSettings({ rooVersions: ['fenaroli'] }).rooVersions).toEqual(['fenaroli']);
  });
});

describe('STORAGE_KEY', () => {
  it('is the versioned key', () => {
    expect(STORAGE_KEY).toBe('scales.settings.v1');
  });
});

describe('loadSettings', () => {
  it('returns defaults when nothing has been saved', () => {
    const storage = createStorage();
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips a saved, valid Settings object', () => {
    const storage = createStorage();
    const custom: Settings = { ...DEFAULT_SETTINGS, notation: 'hidden', keys: [0, 4, 7] };
    storage.setItem(STORAGE_KEY, JSON.stringify(custom));
    expect(loadSettings(storage)).toEqual(custom);
  });

  it('loads a payload written before the hands setting was removed', () => {
    // Exactly what an older build of the app would have left in localStorage,
    // under the same (unbumped) storage key.
    const legacy = {
      keys: [0, 4, 7],
      families: ['major', 'harmonicMinor'],
      modes: ['dorian'],
      hands: ['right', 'left', 'separately', 'both'],
      motions: ['similar', 'contrary'],
      octaves: [1, 2],
      directions: ['ascending', 'both'],
      notation: 'always',
      fingering: 'hidden',
    };
    const storage = createStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    // Every surviving preference is carried over; only `hands` disappears, and
    // the Rule of the Octave arrives at its defaults — switched off, so an old
    // payload loads into exactly the app the user left.
    expect(loadSettings(storage)).toEqual({
      keys: [0, 4, 7],
      families: ['major', 'harmonicMinor'],
      modes: ['dorian'],
      motions: ['similar', 'contrary'],
      octaves: [1, 2],
      directions: ['ascending', 'both'],
      rooVersions: [],
      rooModes: ['major', 'minor'],
      rooPositions: [1, 2, 3],
      notation: 'always',
      fingering: 'hidden',
    });
    expect(loadSettings(storage)).not.toHaveProperty('hands');
  });

  it('returns defaults for corrupt (non-JSON) data without throwing', () => {
    const storage = createStorage();
    storage.setItem(STORAGE_KEY, '{not valid json');
    expect(() => loadSettings(storage)).not.toThrow();
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults and never throws when getItem throws', () => {
    const storage = createStorage({ throwOnGetItem: true });
    expect(() => loadSettings(storage)).not.toThrow();
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults and never throws when accessing the global localStorage itself throws', () => {
    withThrowingGlobalLocalStorage(() => {
      expect(() => loadSettings()).not.toThrow();
      expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    });
  });

  it('uses the real global localStorage by default', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, notation: 'always' }));
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, notation: 'always' });
  });
});

describe('saveSettings', () => {
  it('writes JSON that loadSettings can read back', () => {
    const storage = createStorage();
    const custom: Settings = { ...DEFAULT_SETTINGS, fingering: 'always' };
    saveSettings(custom, storage);
    expect(JSON.parse(storage.getItem(STORAGE_KEY) as string)).toEqual(custom);
  });

  it('never throws when setItem throws (quota exceeded, private browsing, etc.)', () => {
    const storage = createStorage({ throwOnSetItem: true });
    expect(() => saveSettings(DEFAULT_SETTINGS, storage)).not.toThrow();
  });

  it('never throws when accessing the global localStorage itself throws', () => {
    withThrowingGlobalLocalStorage(() => {
      expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    });
  });

  it('writes to the real global localStorage by default', () => {
    saveSettings({ ...DEFAULT_SETTINGS, notation: 'hidden' });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({ ...DEFAULT_SETTINGS, notation: 'hidden' });
  });
});
