import { describe, expect, it } from 'vitest';

import { eligibleExercises, exerciseKey, isValidExercise, randomExercise } from './exercise';
import {
  DIRECTION_OPTIONS,
  MODE_IDS,
  MOTION_OPTIONS,
  OCTAVE_OPTIONS,
  ROO_POSITIONS,
  ROO_VERSION_IDS,
  SCALE_FAMILY_IDS,
} from './types';
import type { Exercise, PitchClass, RuleOfOctaveExercise, ScaleExercise } from './types';
import type { Settings } from '../settings/types';

/**
 * A minimal, explicitly-enumerated settings object. The tests hand-compute pool
 * sizes, so they must not inherit anything from the app's defaults — if the
 * default settings change, these tests should stay meaningful.
 */
const BASE: Settings = {
  keys: [0],
  families: ['major'],
  modes: [],
  motions: ['similar'],
  octaves: [1],
  directions: ['ascending'],
  // The rule is off here — `rooVersions` empty — so every hand-computed scale
  // count below stays a count of scales. The other two lists are full, so a
  // test that switches the rule on only has to name its versions.
  rooVersions: [],
  rooModes: ['major', 'minor'],
  rooPositions: [1, 2, 3],
  notation: 'reveal',
  fingering: 'reveal',
};

const settings = (overrides: Partial<Settings>): Settings => ({ ...BASE, ...overrides });

const ALL_KEYS: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const exercise = (overrides: Partial<ScaleExercise>): ScaleExercise => ({
  kind: 'scale',
  tonic: 0,
  scaleTypeId: 'major',
  motion: 'similar',
  octaves: 1,
  direction: 'ascending',
  ...overrides,
});

const ruleOfOctave = (overrides: Partial<RuleOfOctaveExercise> = {}): RuleOfOctaveExercise => ({
  kind: 'ruleOfOctave',
  mode: 'major',
  tonic: 0,
  version: 'fenaroli',
  position: 1,
  ...overrides,
});

describe('isValidExercise', () => {
  it('accepts or rejects exactly the right motion/octaves combinations', () => {
    const seen: string[] = [];

    for (const motion of MOTION_OPTIONS) {
      for (const octaves of OCTAVE_OPTIONS) {
        const e = exercise({ motion, octaves });
        // Two hands moving apart for more than two octaves runs off the keyboard.
        const expected = motion === 'similar' || octaves <= 2;
        expect(isValidExercise(e), `${motion}/${String(octaves)}`).toBe(expected);
        if (isValidExercise(e)) seen.push(`${motion}/${String(octaves)}`);
      }
    }

    // Similar motion at all 4 octave counts, plus contrary at 1 and 2.
    expect(seen).toEqual([
      'similar/1',
      'similar/2',
      'similar/3',
      'similar/4',
      'contrary/1',
      'contrary/2',
    ]);
  });

  it('accepts every Rule of the Octave: it has no axis that can conflict', () => {
    for (const version of ROO_VERSION_IDS) {
      for (const position of ROO_POSITIONS) {
        for (const mode of ['major', 'minor'] as const) {
          for (const tonic of ALL_KEYS) {
            expect(isValidExercise(ruleOfOctave({ version, position, mode, tonic }))).toBe(true);
          }
        }
      }
    }
  });

  it('never rejects an exercise for its key, scale type or direction', () => {
    for (const scaleTypeId of [...SCALE_FAMILY_IDS, ...MODE_IDS]) {
      for (const tonic of ALL_KEYS) {
        for (const direction of DIRECTION_OPTIONS) {
          expect(isValidExercise(exercise({ scaleTypeId, tonic, direction }))).toBe(true);
        }
      }
    }
  });

  it('rejects contrary motion beyond two octaves and accepts it at one and two', () => {
    for (const octaves of [1, 2] as const) {
      expect(isValidExercise(exercise({ motion: 'contrary', octaves }))).toBe(true);
    }
    for (const octaves of [3, 4] as const) {
      expect(isValidExercise(exercise({ motion: 'contrary', octaves }))).toBe(false);
    }
    // Similar motion is unconstrained at every octave count.
    for (const octaves of OCTAVE_OPTIONS) {
      expect(isValidExercise(exercise({ motion: 'similar', octaves }))).toBe(true);
    }
  });
});

describe('eligibleExercises', () => {
  it('returns the single combination a fully-pinned settings object allows', () => {
    expect(eligibleExercises(BASE)).toEqual([
      {
        kind: 'scale',
        tonic: 0,
        scaleTypeId: 'major',
        motion: 'similar',
        octaves: 1,
        direction: 'ascending',
      },
    ]);
  });

  it('is empty when any axis is empty', () => {
    expect(eligibleExercises(settings({ keys: [] }))).toEqual([]);
    expect(eligibleExercises(settings({ families: [], modes: [] }))).toEqual([]);
    expect(eligibleExercises(settings({ motions: [] }))).toEqual([]);
    expect(eligibleExercises(settings({ octaves: [] }))).toEqual([]);
    expect(eligibleExercises(settings({ directions: [] }))).toEqual([]);
  });

  it('is empty when the only enabled combination is invalid', () => {
    // Contrary motion at 3+ octaves is off the keyboard, and it is the only
    // combination the rules can reject.
    expect(eligibleExercises(settings({ motions: ['contrary'], octaves: [3, 4] }))).toEqual([]);
    expect(eligibleExercises(settings({ motions: ['contrary'], octaves: [3] }))).toEqual([]);
  });

  it('multiplies out to the hand-computed pool size (simple case)', () => {
    // 12 keys x 5 families x 1 motion x 2 octaves x 1 direction.
    const pool = eligibleExercises(
      settings({
        keys: ALL_KEYS,
        families: ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor', 'chromatic'],
        motions: ['similar'],
        octaves: [1, 2],
        directions: ['both'],
      }),
    );
    expect(pool).toHaveLength(12 * 5 * 1 * 2 * 1);
    expect(pool).toHaveLength(120);
  });

  it('multiplies out to the hand-computed pool size (contrary motion filtered)', () => {
    // motions x octaves valid pairs:
    //   similar x 3 octaves = 3
    //   contrary x {1,2}    = 2
    // => 5 pairs, x 2 directions x 3 keys x 3 scale types = 90.
    const pool = eligibleExercises(
      settings({
        keys: [0, 1, 2],
        families: ['major', 'chromatic'],
        modes: ['dorian'],
        motions: ['similar', 'contrary'],
        octaves: [1, 2, 3],
        directions: ['ascending', 'both'],
      }),
    );
    expect(pool).toHaveLength(5 * 2 * 3 * 3);
    expect(pool).toHaveLength(90);
  });

  it('reaches its maximum size with everything enabled', () => {
    // 6 valid motion/octave pairs (similar x 4, contrary x 2) x 3 directions
    // x 12 keys x 12 scale types.
    const pool = eligibleExercises(
      settings({
        keys: ALL_KEYS,
        families: [...SCALE_FAMILY_IDS],
        modes: [...MODE_IDS],
        motions: [...MOTION_OPTIONS],
        octaves: [...OCTAVE_OPTIONS],
        directions: [...DIRECTION_OPTIONS],
      }),
    );
    expect(pool).toHaveLength(12 * 12 * 6 * 3);
    expect(pool).toHaveLength(2592);
  });

  it('orders scale types canonically: families first, then modes, whatever order they were enabled in', () => {
    const pool = eligibleExercises(
      settings({
        // Deliberately scrambled relative to SCALE_FAMILY_IDS / MODE_IDS.
        families: ['chromatic', 'major'],
        modes: ['locrian', 'dorian'],
      }),
    );
    expect(pool.map((e) => (e.kind === 'scale' ? e.scaleTypeId : e.kind))).toEqual([
      'major',
      'chromatic',
      'dorian',
      'locrian',
    ]);
  });

  it('nests the axes in a fixed order, so the pool is reproducible', () => {
    const pool = eligibleExercises(
      settings({ keys: [0, 1], octaves: [1, 2], directions: ['ascending', 'descending'] }),
    );
    expect(pool.map(exerciseKey)).toEqual([
      'scale:0:major:similar:1:ascending',
      'scale:0:major:similar:1:descending',
      'scale:0:major:similar:2:ascending',
      'scale:0:major:similar:2:descending',
      'scale:1:major:similar:1:ascending',
      'scale:1:major:similar:1:descending',
      'scale:1:major:similar:2:ascending',
      'scale:1:major:similar:2:descending',
    ]);
  });

  it('returns a fresh array each call, so callers cannot corrupt the next draw', () => {
    const first = eligibleExercises(BASE);
    first.pop();
    expect(eligibleExercises(BASE)).toHaveLength(1);
  });

  it('contains only valid exercises', () => {
    const pool = eligibleExercises(
      settings({
        keys: ALL_KEYS,
        families: [...SCALE_FAMILY_IDS],
        modes: [...MODE_IDS],
        motions: [...MOTION_OPTIONS],
        octaves: [...OCTAVE_OPTIONS],
        directions: [...DIRECTION_OPTIONS],
        rooVersions: [...ROO_VERSION_IDS],
      }),
    );
    expect(pool.every(isValidExercise)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The Rule of the Octave in the pool
// ---------------------------------------------------------------------------

describe('eligibleExercises — Rule of the Octave', () => {
  /** Just the rule: no scales at all, so the arithmetic is unobscured. */
  const ruleOnly = (overrides: Partial<Settings> = {}): Settings =>
    settings({ families: [], modes: [], rooVersions: [...ROO_VERSION_IDS], ...overrides });

  const roos = (pool: readonly Exercise[]): RuleOfOctaveExercise[] =>
    pool.filter((e): e is RuleOfOctaveExercise => e.kind === 'ruleOfOctave');

  it('adds nothing while no version is selected — that is how the rule is off', () => {
    expect(roos(eligibleExercises(settings({ rooVersions: [] })))).toEqual([]);
    // And with every other rule axis full: still nothing.
    expect(
      roos(
        eligibleExercises(
          settings({ rooVersions: [], rooModes: ['major', 'minor'], rooPositions: [1, 2, 3] }),
        ),
      ),
    ).toEqual([]);
  });

  it('counts one version in major as one exercise per key and position', () => {
    // 1 key x major x 1 version x 3 positions.
    const pool = eligibleExercises(ruleOnly({ rooVersions: ['fenaroli'], rooModes: ['major'] }));
    expect(pool).toHaveLength(3);
    expect(pool.map(exerciseKey)).toEqual([
      'ruleOfOctave:0:major:fenaroli:1',
      'ruleOfOctave:0:major:fenaroli:2',
      'ruleOfOctave:0:major:fenaroli:3',
    ]);
  });

  it('does NOT double the major half when both versions are on: they are the same music', () => {
    const one = eligibleExercises(ruleOnly({ rooVersions: ['fenaroli'], rooModes: ['major'] }));
    const both = eligibleExercises(ruleOnly({ rooModes: ['major'] }));

    // Campion's major table is Fenaroli's, figure for figure, so enumerating
    // both would put every major exercise into the pool twice and quietly bias
    // a uniform draw.
    expect(both).toEqual(one);
    expect(both.map(exerciseKey).every((key) => key.includes('fenaroli'))).toBe(true);
  });

  it('DOES double the minor half: the two versions differ at the descending sixth', () => {
    const one = eligibleExercises(ruleOnly({ rooVersions: ['fenaroli'], rooModes: ['minor'] }));
    const both = eligibleExercises(ruleOnly({ rooModes: ['minor'] }));

    expect(one).toHaveLength(3);
    expect(both).toHaveLength(6);
    expect(both.map(exerciseKey)).toEqual([
      'ruleOfOctave:0:minor:fenaroli:1',
      'ruleOfOctave:0:minor:fenaroli:2',
      'ruleOfOctave:0:minor:fenaroli:3',
      'ruleOfOctave:0:minor:campion:1',
      'ruleOfOctave:0:minor:campion:2',
      'ruleOfOctave:0:minor:campion:3',
    ]);
  });

  it('keeps the first version of an equal group, whichever one the user ticked', () => {
    // Campion alone is Campion; Campion alongside Fenaroli collapses onto
    // Fenaroli, the canonical first — never onto nothing, and never onto both.
    const campionOnly = eligibleExercises(ruleOnly({ rooVersions: ['campion'], rooModes: ['major'] }));
    expect(campionOnly.map(exerciseKey)).toEqual([
      'ruleOfOctave:0:major:campion:1',
      'ruleOfOctave:0:major:campion:2',
      'ruleOfOctave:0:major:campion:3',
    ]);
  });

  it('multiplies out to the hand-computed size across every axis', () => {
    // 12 keys x (major: 1 distinct version + minor: 2 distinct versions)
    // x 3 positions = 12 x 3 x 3 = 108.
    const pool = eligibleExercises(ruleOnly({ keys: ALL_KEYS }));
    expect(pool).toHaveLength(12 * 3 * 3);
    expect(pool).toHaveLength(108);
    expect(roos(pool)).toHaveLength(108);
  });

  it('nests keys, modes, versions and positions in a fixed order', () => {
    const pool = eligibleExercises(ruleOnly({ keys: [0, 7], rooPositions: [1, 2] }));
    expect(pool.map(exerciseKey)).toEqual([
      'ruleOfOctave:0:major:fenaroli:1',
      'ruleOfOctave:0:major:fenaroli:2',
      'ruleOfOctave:0:minor:fenaroli:1',
      'ruleOfOctave:0:minor:fenaroli:2',
      'ruleOfOctave:0:minor:campion:1',
      'ruleOfOctave:0:minor:campion:2',
      'ruleOfOctave:7:major:fenaroli:1',
      'ruleOfOctave:7:major:fenaroli:2',
      'ruleOfOctave:7:minor:fenaroli:1',
      'ruleOfOctave:7:minor:fenaroli:2',
      'ruleOfOctave:7:minor:campion:1',
      'ruleOfOctave:7:minor:campion:2',
    ]);
  });

  it('is empty when any of its own axes is empty', () => {
    expect(roos(eligibleExercises(ruleOnly({ keys: [] })))).toEqual([]);
    expect(roos(eligibleExercises(ruleOnly({ rooModes: [] })))).toEqual([]);
    expect(roos(eligibleExercises(ruleOnly({ rooPositions: [] })))).toEqual([]);
  });

  it('shares the key list with the scales rather than having one of its own', () => {
    const pool = eligibleExercises(ruleOnly({ keys: [3, 8] }));
    expect(new Set(pool.map((e) => e.tonic))).toEqual(new Set([3, 8]));
  });

  it('joins the scales in one pool, scales first, with no weighting between them', () => {
    // 2 keys x 1 family x 1 motion x 1 octave x 1 direction = 2 scales, plus
    // 2 keys x 3 distinct (mode, version) pairs x 1 position = 6 rule exercises.
    const pool = eligibleExercises(settings({ keys: [0, 7], rooVersions: [...ROO_VERSION_IDS], rooPositions: [1] }));
    expect(pool).toHaveLength(8);
    expect(pool.slice(0, 2).every((e) => e.kind === 'scale')).toBe(true);
    expect(pool.slice(2).every((e) => e.kind === 'ruleOfOctave')).toBe(true);
    // Every entry is one entry: the draw is uniform over the concatenation, so
    // the rule is exactly as likely as its share of the pool and no likelier.
    expect(new Set(pool.map(exerciseKey)).size).toBe(pool.length);
  });

  it('can fill the pool entirely on its own, with every scale family off', () => {
    const pool = eligibleExercises(ruleOnly());
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((e) => e.kind === 'ruleOfOctave')).toBe(true);
  });

  it('reaches its maximum size with everything in the app enabled', () => {
    const pool = eligibleExercises(
      settings({
        keys: ALL_KEYS,
        families: [...SCALE_FAMILY_IDS],
        modes: [...MODE_IDS],
        motions: [...MOTION_OPTIONS],
        octaves: [...OCTAVE_OPTIONS],
        directions: [...DIRECTION_OPTIONS],
        rooVersions: [...ROO_VERSION_IDS],
        rooModes: ['major', 'minor'],
        rooPositions: [...ROO_POSITIONS],
      }),
    );
    // 2592 scales + 108 rule exercises.
    expect(pool).toHaveLength(2592 + 108);
    expect(pool).toHaveLength(2700);
  });
});

describe('exerciseKey', () => {
  it('formats every field of a scale, kind first', () => {
    expect(
      exerciseKey({
        kind: 'scale',
        tonic: 3,
        scaleTypeId: 'harmonicMinor',
        motion: 'similar',
        octaves: 2,
        direction: 'both',
      }),
    ).toBe('scale:3:harmonicMinor:similar:2:both');
  });

  it('formats every field of a Rule of the Octave, kind first', () => {
    expect(exerciseKey(ruleOfOctave({ mode: 'minor', tonic: 3, position: 2 }))).toBe(
      'ruleOfOctave:3:minor:fenaroli:2',
    );
  });

  it('cannot collide across kinds', () => {
    // The two kinds share only the tonic, but nothing about the *shape* of the
    // remaining fields stops one kind's key spelling another's — the leading
    // kind is what makes that impossible rather than merely unlikely.
    const keys = new Set<string>();
    for (const version of ROO_VERSION_IDS) {
      for (const position of ROO_POSITIONS) {
        for (const mode of ['major', 'minor'] as const) {
          for (const tonic of ALL_KEYS) {
            keys.add(exerciseKey(ruleOfOctave({ version, position, mode, tonic })));
          }
        }
      }
    }
    expect(keys.size).toBe(ROO_VERSION_IDS.length * ROO_POSITIONS.length * 2 * ALL_KEYS.length);

    const scaleKeys = eligibleExercises(
      settings({
        keys: ALL_KEYS,
        families: [...SCALE_FAMILY_IDS],
        modes: [...MODE_IDS],
        motions: [...MOTION_OPTIONS],
        octaves: [...OCTAVE_OPTIONS],
        directions: [...DIRECTION_OPTIONS],
      }),
    ).map(exerciseKey);
    expect(scaleKeys.some((key) => keys.has(key))).toBe(false);
  });

  it('is unique across the entire maximal pool', () => {
    const pool = eligibleExercises(
      settings({
        keys: ALL_KEYS,
        families: [...SCALE_FAMILY_IDS],
        modes: [...MODE_IDS],
        motions: [...MOTION_OPTIONS],
        octaves: [...OCTAVE_OPTIONS],
        directions: [...DIRECTION_OPTIONS],
      }),
    );
    const keys = new Set(pool.map(exerciseKey));
    expect(keys.size).toBe(pool.length);
  });

  it('changes when any single field changes', () => {
    const base = exercise({});
    const variants: ScaleExercise[] = [
      exercise({ tonic: 1 }),
      exercise({ scaleTypeId: 'aeolian' }),
      exercise({ motion: 'contrary' }),
      exercise({ octaves: 2 }),
      exercise({ direction: 'both' }),
    ];
    for (const variant of variants) {
      expect(exerciseKey(variant)).not.toBe(exerciseKey(base));
    }
  });
});

describe('randomExercise', () => {
  const sixWide = settings({ octaves: [1, 2, 3], directions: ['ascending', 'descending'] });

  it('returns null when the pool is empty', () => {
    expect(randomExercise(settings({ keys: [] }))).toBeNull();
    expect(randomExercise(settings({ motions: ['contrary'], octaves: [3, 4] }))).toBeNull();
  });

  it('selects the index the rng points at', () => {
    const pool = eligibleExercises(sixWide);
    expect(pool).toHaveLength(6);

    // floor(r * 6) for each r below: 0, 0, 1, 3, 5, 5.
    const cases: readonly [number, number][] = [
      [0, 0],
      [0.16, 0],
      [0.2, 1],
      [0.5, 3],
      [0.9, 5],
      [0.999999999, 5],
    ];
    for (const [value, index] of cases) {
      expect(randomExercise(sixWide, () => value)).toEqual(pool[index]);
    }
  });

  it('clamps an rng that returns exactly 1 rather than indexing past the end', () => {
    const pool = eligibleExercises(sixWide);
    expect(randomExercise(sixWide, () => 1)).toEqual(pool[pool.length - 1]);
    // And a badly-behaved generator that overshoots still yields a real exercise.
    expect(randomExercise(sixWide, () => 1.5)).toEqual(pool[pool.length - 1]);
    expect(randomExercise(sixWide, () => -0.5)).toEqual(pool[0]);
  });

  it('always returns a member of the pool', () => {
    const keys = new Set(eligibleExercises(sixWide).map(exerciseKey));
    for (let i = 0; i < 500; i += 1) {
      const drawn = randomExercise(sixWide);
      expect(drawn).not.toBeNull();
      if (drawn === null) throw new Error('unreachable');
      expect(keys.has(exerciseKey(drawn))).toBe(true);
    }
  });

  it('reaches every member of the pool with a real rng', () => {
    // With a pool of 6 and 2000 draws, the chance of missing any given entry is
    // (5/6)^2000 — far below any threshold that could make this flaky.
    const drawn = new Set<string>();
    for (let i = 0; i < 2000; i += 1) {
      const e = randomExercise(sixWide);
      if (e !== null) drawn.add(exerciseKey(e));
    }
    expect(drawn.size).toBe(6);
  });

  it('draws roughly uniformly — no hidden weighting or repeat avoidance', () => {
    const counts = new Map<string, number>();
    const draws = 6000;
    for (let i = 0; i < draws; i += 1) {
      const e = randomExercise(sixWide);
      if (e === null) continue;
      const key = exerciseKey(e);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // Expected 1000 each; a generous band that still catches real bias.
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(700);
      expect(count).toBeLessThan(1300);
    }
  });

  it('can repeat itself — consecutive draws are independent', () => {
    // A pool of one can only ever return the same exercise; a generator that
    // avoided repeats would have to return null or loop forever here.
    const only = randomExercise(BASE);
    expect(randomExercise(BASE)).toEqual(only);
    expect(randomExercise(BASE)).toEqual(only);
  });

  it('uses Math.random by default', () => {
    // Two hundred draws from a six-entry pool that never vary would mean the
    // default generator is not random at all.
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const e = randomExercise(sixWide);
      if (e !== null) seen.add(exerciseKey(e));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
