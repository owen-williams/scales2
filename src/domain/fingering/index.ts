/**
 * The public face of the curated fingering catalogue.
 *
 * Everything the rest of the app needs is here: given a scale's fingering set,
 * its tonic and a hand, produce one finger per note of an ascending run — or a
 * run of nulls when no curated fingering covers the scale. Nothing in this
 * module invents a fingering; a gap in the catalogue surfaces as null all the
 * way to the score.
 *
 * The registry below is the single extension point. A new curated collection is
 * a new file exporting a `DiatonicFingeringSet` plus one line here.
 */

import type { FingeringSetId, Hand, Pitch, PitchClass } from '../types';
import { pitchClassOf } from '../pitch';
import { chromaticFinger } from './chromatic';
import { MAJOR_FINGERINGS } from './major';
import { MINOR_FINGERINGS } from './minor';
import { DEGREES_PER_OCTAVE } from './types';
import type { DiatonicFingering, DiatonicFingeringSet } from './types';

export type { DiatonicFingering, DiatonicFingeringSet, HandedFingering } from './types';
export { DEGREES_PER_OCTAVE } from './types';
export { MAJOR_FINGERINGS } from './major';
export { MINOR_FINGERINGS } from './minor';
export { chromaticFinger, isBlackKey } from './chromatic';

/**
 * Every curated diatonic collection, keyed by the id the scale types refer to.
 *
 * `chromatic` is absent on purpose: it is positional rather than cyclic and is
 * handled by `chromaticFinger`, not by a table.
 */
export const DIATONIC_FINGERING_SETS: Readonly<
  Partial<Record<FingeringSetId, DiatonicFingeringSet>>
> = {
  major: MAJOR_FINGERINGS,
  minor: MINOR_FINGERINGS,
};

/**
 * The one place the catalogue is consulted.
 *
 * When alternative fingerings arrive (see `DiatonicFingeringSet`), they are
 * selected here by an extra argument; no caller changes.
 */
export function lookupDiatonicFingering(
  setId: FingeringSetId | null,
  tonic: PitchClass,
  hand: Hand,
): DiatonicFingering | null {
  if (setId === null) return null;
  const set = DIATONIC_FINGERING_SETS[setId];
  if (set === undefined) return null;
  return set.byTonic[tonic]?.[hand] ?? null;
}

/** True when a curated fingering exists for this scale and hand. */
export function hasFingering(setId: FingeringSetId | null, tonic: PitchClass, hand: Hand): boolean {
  if (setId === null) return false;
  if (setId === 'chromatic') return true;
  return lookupDiatonicFingering(setId, tonic, hand) !== null;
}

/**
 * Expand a cycle over a run of `noteCount` notes.
 *
 * The run is the cycle repeated as many times as there are octaves, then the
 * top note, with the first note replaced by `bottom`. Writing it positionally
 * rather than by concatenation keeps it total: a run of any length produces an
 * answer of exactly that length.
 */
function expandDiatonic(fingering: DiatonicFingering, noteCount: number): number[] {
  const fingers: number[] = [];
  for (let index = 0; index < noteCount; index += 1) {
    if (index === noteCount - 1) {
      fingers.push(fingering.top);
    } else {
      fingers.push(fingering.cycle[index % DEGREES_PER_OCTAVE] ?? fingering.cycle[0]);
    }
  }
  if (fingers.length > 0) fingers[0] = fingering.bottom;
  return fingers;
}

/**
 * Fingers for an ASCENDING run of pitches for one hand.
 *
 * `pitches` is the run returned by `buildRun({ direction: 'up' })`; the result
 * has the same length as `noteCount`. Returns null for every entry when no
 * curated fingering covers this scale.
 *
 * Diatonic sets ignore `pitches` — the fingering is a function of scale degree,
 * and degree is position in the run. The chromatic set uses `pitches`, because
 * its fingering is a function of which key each note lands on.
 */
export function fingersForAscendingRun(params: {
  setId: FingeringSetId | null;
  tonic: PitchClass;
  hand: Hand;
  noteCount: number;
  pitches: readonly Pitch[];
}): (number | null)[] {
  const { setId, tonic, hand, noteCount, pitches } = params;
  const length = Math.max(0, noteCount);

  if (setId === 'chromatic') {
    return Array.from({ length }, (_unused, index) => {
      const pitch = pitches[index];
      if (pitch === undefined) return null;
      return chromaticFinger(pitchClassOf(pitch), hand, index === 0);
    });
  }

  const fingering = lookupDiatonicFingering(setId, tonic, hand);
  if (fingering === null) return Array.from({ length }, () => null);
  return expandDiatonic(fingering, length);
}
