/**
 * The chromatic scale fingering.
 *
 * Chromatic fingering is *positional*, not cyclic: the finger depends on which
 * key of the keyboard the note is, never on which degree of the scale it is. A
 * chromatic scale starting on E and one starting on A♭ finger the note C
 * identically. So this is a function of pitch class, not a table of cycles.
 *
 * Right hand: 3 on every black key, 1 on every white key, except that where two
 * white keys are adjacent (E–F and B–C) the upper one takes 2, so the hand can
 * step through the pair without the thumb playing twice in a row. That makes C
 * and F the twos. The exception is the very first note of a run: nothing
 * precedes it, so a C or F at the bottom takes the thumb.
 *
 * Left hand: mirror image. 3 on every black key, 2 on E and B (the lower note of
 * each adjacent white pair, reading the hand downwards), 1 on the rest. No
 * start-of-run exception is needed — the pattern already begins cleanly on any
 * note.
 *
 * Descending is the reverse of the ascending run; the caller handles that.
 */

import type { Hand, PitchClass } from '../types';

/** Pitch classes that sound on a black key: C♯ D♯ F♯ G♯ A♯. */
const BLACK_PITCH_CLASSES: ReadonlySet<number> = new Set([1, 3, 6, 8, 10]);

/** True when this pitch class sounds on a black key of the piano. */
export function isBlackKey(pitchClass: number): boolean {
  return BLACK_PITCH_CLASSES.has(((pitchClass % 12) + 12) % 12);
}

const C = 0;
const E = 4;
const F = 5;
const B = 11;

/**
 * The finger for one note of a chromatic run.
 *
 * `isLowestNote` marks the first note of an ascending run, which is the only
 * place the right-hand pattern is adjusted.
 */
export function chromaticFinger(pitchClass: PitchClass, hand: Hand, isLowestNote: boolean): number {
  if (isBlackKey(pitchClass)) return 3;

  if (hand === 'right') {
    // C and F sit directly above a white key, so they take 2 — unless the run
    // starts on them, when there is no preceding note to make room for.
    if (pitchClass === C || pitchClass === F) return isLowestNote ? 1 : 2;
    return 1;
  }

  // E and B sit directly below a white key: the left-hand mirror of C and F.
  if (pitchClass === E || pitchClass === B) return 2;
  return 1;
}

/** Display name for the chromatic set, matching the diatonic sets' `label`. */
export const CHROMATIC_LABEL = 'Chromatic';
