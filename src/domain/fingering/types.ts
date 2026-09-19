/**
 * Shapes for the curated fingering catalogue.
 *
 * A diatonic scale fingering is not a string of numbers — it is a *repeating
 * cycle*. The thumb falls on the same scale degrees in every octave, and between
 * consecutive thumbs the hand plays a group of three or a group of four. Those
 * two groups partition the seven degrees as 3 + 4, which is why one cycle of
 * seven fingers plus two end-of-run adjustments describes a run of any length.
 *
 * The cycle is written for the *right hand's* reading order in both hands, i.e.
 * ascending scale degrees 1…7. Ascending, the right hand counts up from each
 * thumb (1 2 3 / 1 2 3 4) and the left hand counts down into each thumb
 * (3 2 1 / 4 3 2 1), so the same seven-slot array serves both.
 *
 * Two invariants make the data auditable, and are asserted in the tests:
 *
 * - the thumb (finger 1) appears exactly twice in a cycle, at degrees 3 or 4
 *   apart, and every thumb lands on a white key;
 * - `bottom` and `top` differ from the cycle only at the extremes of a run,
 *   where the hand starts or stops instead of crossing.
 */

import type { FingeringSetId, Hand, PitchClass } from '../types';

/** Every diatonic scale in this app has seven degrees to the octave. */
export const DEGREES_PER_OCTAVE = 7;

/**
 * One hand's fingering for one diatonic scale.
 *
 * Matches the shape frozen in the catalogue's worked examples.
 */
export interface DiatonicFingering {
  /** Finger for scale degrees 1..7 ascending, as used in the interior of a multi-octave run. */
  readonly cycle: readonly [number, number, number, number, number, number, number];
  /** Finger for the lowest note of the run (differs from `cycle[0]` at the start of a run). */
  readonly bottom: number;
  /** Finger for the highest note of the run. */
  readonly top: number;
}

/** Both hands' fingerings for one scale. */
export type HandedFingering = Readonly<Record<Hand, DiatonicFingering>>;

/**
 * Fingerings keyed by tonic pitch class.
 *
 * Keyed by *pitch class*, not by spelling: D♭ major and C♯ major are the same
 * physical scale and share a fingering, and the app only ever asks for one
 * spelling of each pitch class anyway.
 *
 * Partial by design. A missing key means "no curated fingering exists" and the
 * lookup returns null — fingerings are never fabricated to fill a gap.
 */
export type DiatonicFingeringTable = Readonly<Partial<Record<PitchClass, HandedFingering>>>;

/**
 * A named collection of curated diatonic fingerings.
 *
 * Adding a new collection — arpeggios, scales in sixths, a particular exam
 * syllabus — means adding a file that exports one of these and registering it
 * in `index.ts`. No engine code changes.
 *
 * *Extension point for alternative fingerings*: a second fingering for the same
 * scale (an editorial variant, a small-hand alternative) belongs as a further
 * key on this record — e.g. `byTonicAlternatives?: Readonly<Partial<Record<
 * PitchClass, readonly HandedFingering[]>>>` — resolved by an extra `variant`
 * argument threaded through `lookupDiatonicFingering`. Deliberately not built
 * yet: there is nothing to put in it that is better attested than what is here.
 */
export interface DiatonicFingeringSet {
  readonly id: FingeringSetId;
  /** Human-readable name, for debugging and any future catalogue UI. */
  readonly label: string;
  readonly degreesPerOctave: typeof DEGREES_PER_OCTAVE;
  readonly byTonic: DiatonicFingeringTable;
}
