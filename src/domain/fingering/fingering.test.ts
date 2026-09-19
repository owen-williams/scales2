/**
 * Verification of the curated fingering catalogue.
 *
 * The catalogue is data, so these tests are not "does the code work" — they are
 * an independent audit of the data itself. Each entry was *derived* from the
 * standard fingering principles; these tests re-derive the same facts from a
 * different direction and check they agree:
 *
 * - the thumb positions are read back out of the cycle, and the cycle is
 *   regenerated from them;
 * - the scales' pitch classes are computed here from interval formulae, with no
 *   dependency on the scale module, so the thumb-on-white-key check is genuinely
 *   independent of the rest of the domain;
 * - the published one-octave fingerings are reproduced literally.
 */

import { describe, expect, it } from 'vitest';

import type { FingeringSetId, Hand, Letter, Pitch, PitchClass } from '../types';
import {
  DEGREES_PER_OCTAVE,
  fingersForAscendingRun,
  hasFingering,
  MAJOR_FINGERINGS,
  MINOR_FINGERINGS,
} from './index';
import type { DiatonicFingering, DiatonicFingeringSet } from './types';

// ---------------------------------------------------------------------------
// Local helpers — deliberately independent of pitch.ts / scale.ts
// ---------------------------------------------------------------------------

const WHITE_PITCH_CLASSES: ReadonlySet<number> = new Set([0, 2, 4, 5, 7, 9, 11]);

const ALL_PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const HANDS: readonly Hand[] = ['right', 'left'];

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;
const NATURAL_MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10] as const;
const HARMONIC_MINOR_STEPS = [0, 2, 3, 5, 7, 8, 11] as const;
const MELODIC_MINOR_STEPS = [0, 2, 3, 5, 7, 9, 11] as const;

/** Sounding pitch classes of one octave of a scale, degrees 1..7. */
function scalePitchClasses(tonic: PitchClass, steps: readonly number[]): number[] {
  return steps.map((step) => (tonic + step) % 12);
}

/** Zero-based degree indices at which the thumb falls, read back out of a cycle. */
function thumbDegrees(cycle: readonly number[]): number[] {
  const degrees: number[] = [];
  cycle.forEach((finger, degree) => {
    if (finger === 1) degrees.push(degree);
  });
  return degrees;
}

/** Distance forwards from `from` to `to` around a seven-degree cycle. */
function forwardDistance(from: number, to: number): number {
  return (to - from + DEGREES_PER_OCTAVE) % DEGREES_PER_OCTAVE;
}

/** Every entry of the catalogue, flattened for table-driven tests. */
function entriesOf(
  set: DiatonicFingeringSet,
): { tonic: PitchClass; hand: Hand; fingering: DiatonicFingering }[] {
  const rows: { tonic: PitchClass; hand: Hand; fingering: DiatonicFingering }[] = [];
  for (const tonic of ALL_PITCH_CLASSES) {
    const handed = set.byTonic[tonic];
    if (handed === undefined) continue;
    for (const hand of HANDS) rows.push({ tonic, hand, fingering: handed[hand] });
  }
  return rows;
}

/** Sharp spellings, one per pitch class — only the sounding pitch matters here. */
const SHARP_SPELLINGS: readonly (readonly [Letter, number])[] = [
  ['C', 0],
  ['C', 1],
  ['D', 0],
  ['D', 1],
  ['E', 0],
  ['F', 0],
  ['F', 1],
  ['G', 0],
  ['G', 1],
  ['A', 0],
  ['A', 1],
  ['B', 0],
];

function pitchFor(pitchClass: number, octave: number): Pitch {
  const spelling = SHARP_SPELLINGS[((pitchClass % 12) + 12) % 12];
  if (spelling === undefined) throw new Error(`no spelling for ${pitchClass}`);
  return { letter: spelling[0], alter: spelling[1], octave };
}

/** A chromatic run of `octaves * 12 + 1` pitches from `tonic`. */
function chromaticPitches(tonic: PitchClass, octaves: number): Pitch[] {
  const pitches: Pitch[] = [];
  for (let step = 0; step <= octaves * 12; step += 1) {
    pitches.push(pitchFor(tonic + step, 4 + Math.floor((tonic + step) / 12)));
  }
  return pitches;
}

function diatonicRun(
  setId: FingeringSetId,
  tonic: PitchClass,
  hand: Hand,
  octaves: number,
): (number | null)[] {
  return fingersForAscendingRun({
    setId,
    tonic,
    hand,
    noteCount: octaves * DEGREES_PER_OCTAVE + 1,
    pitches: [],
  });
}

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

describe('catalogue coverage', () => {
  it.each([
    ['major', MAJOR_FINGERINGS],
    ['minor', MINOR_FINGERINGS],
  ] as const)('%s covers all twelve keys in both hands', (_label, set) => {
    expect(entriesOf(set)).toHaveLength(24);
    for (const tonic of ALL_PITCH_CLASSES) {
      expect(set.byTonic[tonic], `missing tonic ${tonic}`).toBeDefined();
    }
  });

  it('reports coverage through hasFingering', () => {
    for (const tonic of ALL_PITCH_CLASSES) {
      for (const hand of HANDS) {
        expect(hasFingering('major', tonic, hand)).toBe(true);
        expect(hasFingering('minor', tonic, hand)).toBe(true);
        expect(hasFingering('chromatic', tonic, hand)).toBe(true);
        expect(hasFingering(null, tonic, hand)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Structural invariants of every curated entry
// ---------------------------------------------------------------------------

describe.each([
  ['major', MAJOR_FINGERINGS],
  ['minor', MINOR_FINGERINGS],
] as const)('%s set structure', (setLabel, set) => {
  const rows = entriesOf(set);

  it('uses fingers 1–5 only', () => {
    for (const { tonic, hand, fingering } of rows) {
      const where = `${setLabel} ${tonic} ${hand}`;
      for (const finger of [...fingering.cycle, fingering.bottom, fingering.top]) {
        expect(Number.isInteger(finger), where).toBe(true);
        expect(finger, where).toBeGreaterThanOrEqual(1);
        expect(finger, where).toBeLessThanOrEqual(5);
      }
    }
  });

  it('has a seven-degree cycle with exactly two thumbs, three and four apart', () => {
    for (const { tonic, hand, fingering } of rows) {
      const where = `${setLabel} ${tonic} ${hand}`;
      expect(fingering.cycle, where).toHaveLength(DEGREES_PER_OCTAVE);

      const thumbs = thumbDegrees(fingering.cycle);
      expect(thumbs, `${where}: thumb must fall exactly twice per octave`).toHaveLength(2);

      const [first, second] = thumbs as [number, number];
      const gaps = [forwardDistance(first, second), forwardDistance(second, first)].sort();
      expect(gaps, `${where}: groups must partition seven degrees as 3 + 4`).toEqual([3, 4]);
    }
  });

  it('regenerates the cycle from its thumb positions', () => {
    for (const { tonic, hand, fingering } of rows) {
      const where = `${setLabel} ${tonic} ${hand}`;
      const thumbs = thumbDegrees(fingering.cycle);

      const expected = fingering.cycle.map((_finger, degree) => {
        // Ascending, the right hand counts up away from each thumb and the left
        // hand counts down into the next one.
        const distances = thumbs.map((thumb) =>
          hand === 'right' ? forwardDistance(thumb, degree) : forwardDistance(degree, thumb),
        );
        return 1 + Math.min(...distances);
      });

      expect(fingering.cycle, where).toEqual(expected);
    }
  });

  it('steps by one between notes except at a thumb crossing', () => {
    for (const { tonic, hand, fingering } of rows) {
      const where = `${setLabel} ${tonic} ${hand}`;
      for (let degree = 0; degree < DEGREES_PER_OCTAVE; degree += 1) {
        const here = fingering.cycle[degree] ?? 0;
        const next = fingering.cycle[(degree + 1) % DEGREES_PER_OCTAVE] ?? 0;
        if (here === 1 || next === 1) continue; // thumb crossing: any jump is fine
        expect(next - here, `${where} at degree ${degree + 1}`).toBe(hand === 'right' ? 1 : -1);
      }
    }
  });

  /**
   * The 5th finger only ever appears at the far end of a run. The end-of-run
   * fingers therefore follow from the cycle: the right hand stops instead of
   * crossing under at the top, the left hand starts one note early at the
   * bottom. B♭ minor's right hand is the single deliberate exception — see the
   * comment on that entry.
   */
  it('derives bottom and top from the cycle', () => {
    for (const { tonic, hand, fingering } of rows) {
      const where = `${setLabel} ${tonic} ${hand}`;
      const { cycle, bottom, top } = fingering;
      const tonicIsThumb = cycle[0] === 1;

      if (hand === 'right') {
        expect(top, where).toBe(tonicIsThumb ? cycle[6] + 1 : cycle[0]);
        if (setLabel === 'minor' && tonic === 10) {
          expect(bottom, 'B♭ minor RH traditionally starts the run on 2').toBe(2);
        } else {
          expect(bottom, where).toBe(cycle[0]);
        }
      } else {
        expect(bottom, where).toBe(tonicIsThumb ? cycle[1] + 1 : cycle[0]);
        expect(top, where).toBe(cycle[0]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The thumb never lands on a black key
// ---------------------------------------------------------------------------

describe('thumbs avoid the black keys', () => {
  it('holds for every major scale', () => {
    for (const { tonic, hand, fingering } of entriesOf(MAJOR_FINGERINGS)) {
      const pitchClasses = scalePitchClasses(tonic, MAJOR_STEPS);
      for (const degree of thumbDegrees(fingering.cycle)) {
        const pitchClass = pitchClasses[degree] ?? -1;
        expect(
          WHITE_PITCH_CLASSES.has(pitchClass),
          `major ${tonic} ${hand}: thumb on degree ${degree + 1} (pc ${pitchClass})`,
        ).toBe(true);
      }
    }
  });

  it.each([
    ['natural', NATURAL_MINOR_STEPS],
    ['harmonic', HARMONIC_MINOR_STEPS],
  ] as const)('holds for every %s minor scale', (formLabel, steps) => {
    for (const { tonic, hand, fingering } of entriesOf(MINOR_FINGERINGS)) {
      const pitchClasses = scalePitchClasses(tonic, steps);
      for (const degree of thumbDegrees(fingering.cycle)) {
        const pitchClass = pitchClasses[degree] ?? -1;
        expect(
          WHITE_PITCH_CLASSES.has(pitchClass),
          `${formLabel} minor ${tonic} ${hand}: thumb on degree ${degree + 1} (pc ${pitchClass})`,
        ).toBe(true);
      }
    }
  });

  /**
   * Melodic minor raises the 6th on the way up, which moves two right-hand
   * thumbs onto black keys. Those are the traditional fingerings and the usual
   * compromise of using one fingering for all three forms of a minor key — this
   * test pins the exceptions down so they cannot grow silently.
   */
  it('holds for melodic minor except the two documented right hands', () => {
    const expectedExceptions = new Set(['1:right', '6:right']); // C♯ minor, F♯ minor
    const found = new Set<string>();

    for (const { tonic, hand, fingering } of entriesOf(MINOR_FINGERINGS)) {
      const pitchClasses = scalePitchClasses(tonic, MELODIC_MINOR_STEPS);
      for (const degree of thumbDegrees(fingering.cycle)) {
        if (!WHITE_PITCH_CLASSES.has(pitchClasses[degree] ?? -1)) found.add(`${tonic}:${hand}`);
      }
    }

    expect([...found].sort()).toEqual([...expectedExceptions].sort());
  });
});

// ---------------------------------------------------------------------------
// Invariants of the generated runs
// ---------------------------------------------------------------------------

describe.each([
  ['major', MAJOR_FINGERINGS],
  ['minor', MINOR_FINGERINGS],
] as const)('%s runs', (setLabel, set) => {
  const setId = set.id;

  it('produces one finger per note for one to four octaves', () => {
    for (const tonic of ALL_PITCH_CLASSES) {
      for (const hand of HANDS) {
        for (const octaves of [1, 2, 3, 4]) {
          const fingers = diatonicRun(setId, tonic, hand, octaves);
          expect(fingers).toHaveLength(octaves * DEGREES_PER_OCTAVE + 1);
          expect(fingers.every((finger) => finger !== null)).toBe(true);
        }
      }
    }
  });

  it('never repeats a finger on consecutive notes', () => {
    for (const tonic of ALL_PITCH_CLASSES) {
      for (const hand of HANDS) {
        for (const octaves of [1, 2, 3, 4]) {
          const fingers = diatonicRun(setId, tonic, hand, octaves);
          for (let index = 1; index < fingers.length; index += 1) {
            expect(
              fingers[index],
              `${setLabel} ${tonic} ${hand} ${octaves}oct at note ${index}`,
            ).not.toBe(fingers[index - 1]);
          }
        }
      }
    }
  });

  it('uses the 5th finger at most once, and only at an extreme', () => {
    for (const tonic of ALL_PITCH_CLASSES) {
      for (const hand of HANDS) {
        for (const octaves of [1, 2, 3, 4]) {
          const fingers = diatonicRun(setId, tonic, hand, octaves);
          const positions = fingers.flatMap((finger, index) => (finger === 5 ? [index] : []));
          const where = `${setLabel} ${tonic} ${hand} ${octaves}oct`;
          expect(positions.length, where).toBeLessThanOrEqual(1);
          for (const position of positions) {
            expect([0, fingers.length - 1], where).toContain(position);
            // The right hand reaches its 5th at the top, the left at the bottom.
            expect(position, where).toBe(hand === 'right' ? fingers.length - 1 : 0);
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Published one-octave fingerings, reproduced literally
// ---------------------------------------------------------------------------

describe('published one-octave fingerings', () => {
  const examples = [
    { scale: 'C major', setId: 'major', tonic: 0, hand: 'right', oneOctave: [1, 2, 3, 1, 2, 3, 4, 5] },
    { scale: 'C major', setId: 'major', tonic: 0, hand: 'left', oneOctave: [5, 4, 3, 2, 1, 3, 2, 1] },
    { scale: 'B♭ major', setId: 'major', tonic: 10, hand: 'right', oneOctave: [4, 1, 2, 3, 1, 2, 3, 4] },
    { scale: 'B♭ major', setId: 'major', tonic: 10, hand: 'left', oneOctave: [3, 2, 1, 4, 3, 2, 1, 3] },
    { scale: 'F♯ major', setId: 'major', tonic: 6, hand: 'right', oneOctave: [2, 3, 4, 1, 2, 3, 1, 2] },
    { scale: 'F♯ major', setId: 'major', tonic: 6, hand: 'left', oneOctave: [4, 3, 2, 1, 3, 2, 1, 4] },
    { scale: 'B major', setId: 'major', tonic: 11, hand: 'left', oneOctave: [4, 3, 2, 1, 4, 3, 2, 1] },
  ] as const;

  it.each(examples)('$scale $hand — one octave ascending', ({ setId, tonic, hand, oneOctave }) => {
    expect(diatonicRun(setId, tonic, hand, 1)).toEqual([...oneOctave]);
  });

  it.each([
    { scale: 'C major', tonic: 0, hand: 'right', cycle: [1, 2, 3, 1, 2, 3, 4], bottom: 1, top: 5 },
    { scale: 'C major', tonic: 0, hand: 'left', cycle: [1, 4, 3, 2, 1, 3, 2], bottom: 5, top: 1 },
    { scale: 'B♭ major', tonic: 10, hand: 'right', cycle: [4, 1, 2, 3, 1, 2, 3], bottom: 4, top: 4 },
    { scale: 'B♭ major', tonic: 10, hand: 'left', cycle: [3, 2, 1, 4, 3, 2, 1], bottom: 3, top: 3 },
    { scale: 'F♯ major', tonic: 6, hand: 'right', cycle: [2, 3, 4, 1, 2, 3, 1], bottom: 2, top: 2 },
    { scale: 'F♯ major', tonic: 6, hand: 'left', cycle: [4, 3, 2, 1, 3, 2, 1], bottom: 4, top: 4 },
  ] as const)('$scale $hand — cycle, bottom and top', ({ tonic, hand, cycle, bottom, top }) => {
    const entry = MAJOR_FINGERINGS.byTonic[tonic]?.[hand];
    expect(entry).toBeDefined();
    expect(entry?.cycle).toEqual([...cycle]);
    expect(entry?.bottom).toBe(bottom);
    expect(entry?.top).toBe(top);
  });

  /**
   * A one-octave chart gives B major's left hand as 4 3 2 1 4 3 2 1. That gives
   * the right one-octave answer (asserted above), but as a *cycle* it repeats
   * the 4 on the interior B of a longer run, where the thumb has to fall — the
   * contract's own rule that the thumb lands on the same degrees every octave.
   * The stored cycle is the one that also expands correctly, and this test pins
   * the two-octave run that follows from it.
   */
  it('B major left hand expands correctly over two octaves', () => {
    expect(diatonicRun('major', 11, 'left', 2)).toEqual([
      4, 3, 2, 1, 4, 3, 2, // B C♯ D♯ E F♯ G♯ A♯
      1, 3, 2, 1, 4, 3, 2, // B C♯ D♯ E F♯ G♯ A♯ — thumb on the interior B
      1, //                   B
    ]);
  });

  it('expands C major over two octaves', () => {
    expect(diatonicRun('major', 0, 'right', 2)).toEqual([
      1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5,
    ]);
    expect(diatonicRun('major', 0, 'left', 2)).toEqual([
      5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1,
    ]);
  });
});

// ---------------------------------------------------------------------------
// The curated table, spelled out
// ---------------------------------------------------------------------------

describe('curated one-octave fingerings', () => {
  it.each([
    ['C major', 0, [1, 2, 3, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 3, 2, 1]],
    ['D♭ major', 1, [2, 3, 1, 2, 3, 4, 1, 2], [3, 2, 1, 4, 3, 2, 1, 3]],
    ['D major', 2, [1, 2, 3, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 3, 2, 1]],
    ['E♭ major', 3, [3, 1, 2, 3, 4, 1, 2, 3], [3, 2, 1, 4, 3, 2, 1, 3]],
    ['E major', 4, [1, 2, 3, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 3, 2, 1]],
    ['F major', 5, [1, 2, 3, 4, 1, 2, 3, 4], [5, 4, 3, 2, 1, 3, 2, 1]],
    ['F♯ major', 6, [2, 3, 4, 1, 2, 3, 1, 2], [4, 3, 2, 1, 3, 2, 1, 4]],
    ['G major', 7, [1, 2, 3, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 3, 2, 1]],
    ['A♭ major', 8, [3, 4, 1, 2, 3, 1, 2, 3], [3, 2, 1, 4, 3, 2, 1, 3]],
    ['A major', 9, [1, 2, 3, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 3, 2, 1]],
    ['B♭ major', 10, [4, 1, 2, 3, 1, 2, 3, 4], [3, 2, 1, 4, 3, 2, 1, 3]],
    ['B major', 11, [1, 2, 3, 1, 2, 3, 4, 5], [4, 3, 2, 1, 4, 3, 2, 1]],
  ] as const)('%s', (_name, tonic, right, left) => {
    expect(diatonicRun('major', tonic, 'right', 1)).toEqual([...right]);
    expect(diatonicRun('major', tonic, 'left', 1)).toEqual([...left]);
  });

  it.each([
    ['C minor', 0, [1, 2, 3, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 3, 2, 1]],
    ['C♯ minor', 1, [3, 4, 1, 2, 3, 1, 2, 3], [3, 2, 1, 4, 3, 2, 1, 3]],
    ['D minor', 2, [1, 2, 3, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 3, 2, 1]],
    ['E♭ minor', 3, [3, 1, 2, 3, 4, 1, 2, 3], [2, 1, 4, 3, 2, 1, 3, 2]],
    ['E minor', 4, [1, 2, 3, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 3, 2, 1]],
    ['F minor', 5, [1, 2, 3, 4, 1, 2, 3, 4], [5, 4, 3, 2, 1, 3, 2, 1]],
    ['F♯ minor', 6, [3, 4, 1, 2, 3, 1, 2, 3], [4, 3, 2, 1, 3, 2, 1, 4]],
    ['G minor', 7, [1, 2, 3, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 3, 2, 1]],
    ['G♯ minor', 8, [3, 4, 1, 2, 3, 1, 2, 3], [3, 2, 1, 3, 2, 1, 4, 3]],
    ['A minor', 9, [1, 2, 3, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 3, 2, 1]],
    ['B♭ minor', 10, [2, 1, 2, 3, 1, 2, 3, 4], [2, 1, 3, 2, 1, 4, 3, 2]],
    ['B minor', 11, [1, 2, 3, 1, 2, 3, 4, 5], [4, 3, 2, 1, 4, 3, 2, 1]],
  ] as const)('%s', (_name, tonic, right, left) => {
    expect(diatonicRun('minor', tonic, 'right', 1)).toEqual([...right]);
    expect(diatonicRun('minor', tonic, 'left', 1)).toEqual([...left]);
  });

  it('gives B♭ minor the interior 4 on the second octave', () => {
    // The lowest B♭ takes 2; every B♭ above it takes 4.
    expect(diatonicRun('minor', 10, 'right', 2)).toEqual([
      2, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4,
    ]);
  });
});

// ---------------------------------------------------------------------------
// Chromatic
// ---------------------------------------------------------------------------

describe('chromatic fingering', () => {
  function chromaticRun(tonic: PitchClass, hand: Hand, octaves: number): (number | null)[] {
    const pitches = chromaticPitches(tonic, octaves);
    return fingersForAscendingRun({
      setId: 'chromatic',
      tonic,
      hand,
      noteCount: pitches.length,
      pitches,
    });
  }

  it('fingers a C chromatic scale', () => {
    // C C♯ D D♯ E F F♯ G G♯ A A♯ B C — the opening C takes the thumb because
    // nothing precedes it; the closing C takes 2 as usual.
    expect(chromaticRun(0, 'right', 1)).toEqual([1, 3, 1, 3, 1, 2, 3, 1, 3, 1, 3, 1, 2]);
    expect(chromaticRun(0, 'left', 1)).toEqual([1, 3, 1, 3, 2, 1, 3, 1, 3, 1, 3, 2, 1]);
  });

  it('fingers an F♯ chromatic scale', () => {
    // F♯ G G♯ A A♯ B C C♯ D D♯ E F F♯
    expect(chromaticRun(6, 'right', 1)).toEqual([3, 1, 3, 1, 3, 1, 2, 3, 1, 3, 1, 2, 3]);
    expect(chromaticRun(6, 'left', 1)).toEqual([3, 1, 3, 1, 3, 2, 1, 3, 1, 3, 2, 1, 3]);
  });

  it('repeats positionally over two octaves', () => {
    const oneOctave = chromaticRun(0, 'right', 1);
    const twoOctaves = chromaticRun(0, 'right', 2);
    expect(twoOctaves).toHaveLength(25);
    // Everything after the first note is a pure function of the key it lands on,
    // so the second octave repeats the first with the start-of-run exception gone.
    expect(twoOctaves.slice(12)).toEqual(oneOctave.slice(0, 13).map((f, i) => (i === 0 ? 2 : f)));
  });

  it('never repeats a finger and stays within 1–3, in every key and both hands', () => {
    for (const tonic of ALL_PITCH_CLASSES) {
      for (const hand of HANDS) {
        const fingers = chromaticRun(tonic, hand, 2);
        for (const [index, finger] of fingers.entries()) {
          expect(finger, `chromatic ${tonic} ${hand} note ${index}`).toBeGreaterThanOrEqual(1);
          expect(finger, `chromatic ${tonic} ${hand} note ${index}`).toBeLessThanOrEqual(3);
          if (index > 0) expect(finger).not.toBe(fingers[index - 1]);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Scales with no curated fingering
// ---------------------------------------------------------------------------

describe('uncovered scales', () => {
  it('returns all nulls when the scale type has no fingering set', () => {
    const fingers = fingersForAscendingRun({
      setId: null,
      tonic: 3,
      hand: 'right',
      noteCount: 15,
      pitches: [],
    });
    expect(fingers).toHaveLength(15);
    expect(fingers.every((finger) => finger === null)).toBe(true);
  });

  it('returns an empty array for an empty run', () => {
    expect(
      fingersForAscendingRun({
        setId: 'major',
        tonic: 0,
        hand: 'right',
        noteCount: 0,
        pitches: [],
      }),
    ).toEqual([]);
  });
});
