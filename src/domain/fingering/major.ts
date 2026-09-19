/**
 * Curated major-scale fingerings, all twelve keys, both hands.
 *
 * These are the traditional published fingerings. Each was derived from the two
 * principles that generate them — the thumb falls on the same scale degrees in
 * every octave, and the thumb never lands on a black key — and then checked
 * against standard scale charts. All twenty-four entries agree with the charts.
 *
 * The comment on each key names the scale and the notes the thumbs fall on, so
 * the data can be audited without decoding the numbers. Read `1` as thumb.
 *
 * Two structural facts hold for every entry here, and the tests assert them:
 *
 * - Right hand. `bottom` is always `cycle[0]`: the run starts on the finger the
 *   interior would use. `top` is `cycle[6] + 1` when degree 1 is a thumb (the
 *   hand finishes the group instead of crossing under again) and `cycle[0]`
 *   otherwise. That is why C major ends on 5 but F major ends on 4 — F major's
 *   top group is the group of three, so its last finger is 4, not 5.
 * - Left hand. `top` is always `cycle[0]`. `bottom` is `cycle[1] + 1` when
 *   degree 1 is a thumb (the run starts one note early, extending the group
 *   downwards) and `cycle[0]` otherwise. That is why C major starts on 5 but
 *   B major starts on 4.
 */

import type { DiatonicFingeringSet } from './types';
import { DEGREES_PER_OCTAVE } from './types';

export const MAJOR_FINGERINGS: DiatonicFingeringSet = {
  id: 'major',
  label: 'Major',
  degreesPerOctave: DEGREES_PER_OCTAVE,
  byTonic: {
    // C major: C D E F G A B — RH thumbs on C and F; LH thumbs on C and G.
    // One octave: RH 1 2 3 1 2 3 4 5 · LH 5 4 3 2 1 3 2 1.
    0: {
      right: { cycle: [1, 2, 3, 1, 2, 3, 4], bottom: 1, top: 5 },
      left: { cycle: [1, 4, 3, 2, 1, 3, 2], bottom: 5, top: 1 },
    },

    // D♭ major: D♭ E♭ F G♭ A♭ B♭ C — RH thumbs on F and C; LH thumbs on F and C.
    // The only white keys in the scale are F and C, so the thumbs are forced.
    // One octave: RH 2 3 1 2 3 4 1 2 · LH 3 2 1 4 3 2 1 3.
    1: {
      right: { cycle: [2, 3, 1, 2, 3, 4, 1], bottom: 2, top: 2 },
      left: { cycle: [3, 2, 1, 4, 3, 2, 1], bottom: 3, top: 3 },
    },

    // D major: D E F♯ G A B C♯ — RH thumbs on D and G; LH thumbs on D and A.
    // One octave: RH 1 2 3 1 2 3 4 5 · LH 5 4 3 2 1 3 2 1.
    2: {
      right: { cycle: [1, 2, 3, 1, 2, 3, 4], bottom: 1, top: 5 },
      left: { cycle: [1, 4, 3, 2, 1, 3, 2], bottom: 5, top: 1 },
    },

    // E♭ major: E♭ F G A♭ B♭ C D — RH thumbs on F and C; LH thumbs on G and D.
    // The hands use different thumb notes here, which is normal: each hand picks
    // the partition that keeps its own 4-group off the black keys.
    // One octave: RH 3 1 2 3 4 1 2 3 · LH 3 2 1 4 3 2 1 3.
    3: {
      right: { cycle: [3, 1, 2, 3, 4, 1, 2], bottom: 3, top: 3 },
      left: { cycle: [3, 2, 1, 4, 3, 2, 1], bottom: 3, top: 3 },
    },

    // E major: E F♯ G♯ A B C♯ D♯ — RH thumbs on E and A; LH thumbs on E and B.
    // One octave: RH 1 2 3 1 2 3 4 5 · LH 5 4 3 2 1 3 2 1.
    4: {
      right: { cycle: [1, 2, 3, 1, 2, 3, 4], bottom: 1, top: 5 },
      left: { cycle: [1, 4, 3, 2, 1, 3, 2], bottom: 5, top: 1 },
    },

    // F major: F G A B♭ C D E — RH thumbs on F and C; LH thumbs on F and C.
    // The one major scale whose RH does not reach the 5th finger: the group of
    // four sits at the bottom (F G A B♭), so the top F takes 4.
    // One octave: RH 1 2 3 4 1 2 3 4 · LH 5 4 3 2 1 3 2 1.
    5: {
      right: { cycle: [1, 2, 3, 4, 1, 2, 3], bottom: 1, top: 4 },
      left: { cycle: [1, 4, 3, 2, 1, 3, 2], bottom: 5, top: 1 },
    },

    // F♯ major: F♯ G♯ A♯ B C♯ D♯ E♯ — RH thumbs on B and E♯; LH thumbs on B and E♯.
    // E♯ sounds as F, a white key, so the thumb rule is satisfied by the spelling
    // the scale actually uses.
    // One octave: RH 2 3 4 1 2 3 1 2 · LH 4 3 2 1 3 2 1 4.
    6: {
      right: { cycle: [2, 3, 4, 1, 2, 3, 1], bottom: 2, top: 2 },
      left: { cycle: [4, 3, 2, 1, 3, 2, 1], bottom: 4, top: 4 },
    },

    // G major: G A B C D E F♯ — RH thumbs on G and C; LH thumbs on G and D.
    // One octave: RH 1 2 3 1 2 3 4 5 · LH 5 4 3 2 1 3 2 1.
    7: {
      right: { cycle: [1, 2, 3, 1, 2, 3, 4], bottom: 1, top: 5 },
      left: { cycle: [1, 4, 3, 2, 1, 3, 2], bottom: 5, top: 1 },
    },

    // A♭ major: A♭ B♭ C D♭ E♭ F G — RH thumbs on C and F; LH thumbs on C and G.
    // One octave: RH 3 4 1 2 3 1 2 3 · LH 3 2 1 4 3 2 1 3.
    8: {
      right: { cycle: [3, 4, 1, 2, 3, 1, 2], bottom: 3, top: 3 },
      left: { cycle: [3, 2, 1, 4, 3, 2, 1], bottom: 3, top: 3 },
    },

    // A major: A B C♯ D E F♯ G♯ — RH thumbs on A and D; LH thumbs on A and E.
    // One octave: RH 1 2 3 1 2 3 4 5 · LH 5 4 3 2 1 3 2 1.
    9: {
      right: { cycle: [1, 2, 3, 1, 2, 3, 4], bottom: 1, top: 5 },
      left: { cycle: [1, 4, 3, 2, 1, 3, 2], bottom: 5, top: 1 },
    },

    // B♭ major: B♭ C D E♭ F G A — RH thumbs on C and F; LH thumbs on D and A.
    // One octave: RH 4 1 2 3 1 2 3 4 · LH 3 2 1 4 3 2 1 3.
    10: {
      right: { cycle: [4, 1, 2, 3, 1, 2, 3], bottom: 4, top: 4 },
      left: { cycle: [3, 2, 1, 4, 3, 2, 1], bottom: 3, top: 3 },
    },

    // B major: B C♯ D♯ E F♯ G♯ A♯ — RH thumbs on B and E; LH thumbs on B and E.
    // B and E are the scale's only white keys, so both hands are forced onto
    // them. In the left hand degree 1 *is* a thumb, so the interior B takes 1
    // and only the lowest B of the run takes 4 — hence cycle[0] = 1, bottom = 4.
    // (A one-octave chart would give this cycle as 4 3 2 1 4 3 2, which prints
    // the right eight notes but repeats 4 on the interior B of a two-octave
    // run, where the thumb must fall. The one-octave output is identical; the
    // cycle here is the one that also expands correctly.)
    // One octave: RH 1 2 3 1 2 3 4 5 · LH 4 3 2 1 4 3 2 1.
    11: {
      right: { cycle: [1, 2, 3, 1, 2, 3, 4], bottom: 1, top: 5 },
      left: { cycle: [1, 3, 2, 1, 4, 3, 2], bottom: 4, top: 1 },
    },
  },
};
