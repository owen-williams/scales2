/**
 * Curated minor-scale fingerings, all twelve keys, both hands.
 *
 * **One fingering per key covers natural, harmonic and melodic minor.** That is
 * standard pedagogical practice: the three forms differ only in degrees 6 and 7,
 * and method books print a single fingering for the key. The fingerings here are
 * chosen so that they work in all three forms rather than in any one of them.
 * No entry here places a thumb on a note that is only white in the harmonic
 * form: the two entries that do put a thumb on the seventh degree (C♯ minor and
 * F♯ minor, left hand) land on B and E, which are white in the natural form
 * too. Where a chart fingers the harmonic form alone and gets a thumb that the
 * natural form would put on a black key — G♯ minor's F𝄪, sounding G — this
 * catalogue takes the shared fingering instead. See that entry below.
 *
 * Each entry was then re-checked against the natural and melodic forms. Every
 * thumb here lands on a white key in *both* the natural and the harmonic minor.
 * Two entries put a thumb on a black key in the melodic-minor **ascending** form
 * only, where the 6th is raised — see C♯ minor and F♯ minor below. Both are the
 * traditional published fingerings, and the compromise is the usual one; the
 * alternative would be a different fingering per form, which no method book uses
 * and which this app's data model deliberately does not offer.
 *
 * Notes named in the comments are the harmonic minor spellings.
 */

import type { DiatonicFingeringSet } from './types';
import { DEGREES_PER_OCTAVE } from './types';

export const MINOR_FINGERINGS: DiatonicFingeringSet = {
  id: 'minor',
  label: 'Minor',
  degreesPerOctave: DEGREES_PER_OCTAVE,
  byTonic: {
    // C minor: C D E♭ F G A♭ B — RH thumbs on C and F; LH thumbs on C and G.
    // Same shape as C major: the thumb notes are unaffected by the flattened
    // 3rd and 6th.
    // One octave: RH 1 2 3 1 2 3 4 5 · LH 5 4 3 2 1 3 2 1.
    0: {
      right: { cycle: [1, 2, 3, 1, 2, 3, 4], bottom: 1, top: 5 },
      left: { cycle: [1, 4, 3, 2, 1, 3, 2], bottom: 5, top: 1 },
    },

    // C♯ minor: C♯ D♯ E F♯ G♯ A B♯ — RH thumbs on E and A; LH thumbs on E and B♯.
    // B♯ sounds as C, a white key, so the left hand's thumb on the raised 7th is
    // on a white key in the harmonic form and on B in the natural form.
    // Melodic-ascending caveat: the RH thumb on degree 6 falls on A♯ when the
    // 6th is raised. Traditional; kept deliberately.
    // One octave: RH 3 4 1 2 3 1 2 3 · LH 3 2 1 4 3 2 1 3.
    1: {
      right: { cycle: [3, 4, 1, 2, 3, 1, 2], bottom: 3, top: 3 },
      left: { cycle: [3, 2, 1, 4, 3, 2, 1], bottom: 3, top: 3 },
    },

    // D minor: D E F G A B♭ C♯ — RH thumbs on D and G; LH thumbs on D and A.
    // One octave: RH 1 2 3 1 2 3 4 5 · LH 5 4 3 2 1 3 2 1.
    2: {
      right: { cycle: [1, 2, 3, 1, 2, 3, 4], bottom: 1, top: 5 },
      left: { cycle: [1, 4, 3, 2, 1, 3, 2], bottom: 5, top: 1 },
    },

    // E♭ minor: E♭ F G♭ A♭ B♭ C♭ D — RH thumbs on F and C♭; LH thumbs on F and C♭.
    // C♭ sounds as B, a white key; F and C♭ are the scale's only white keys
    // besides the raised 7th, so the thumbs are forced onto them in both hands.
    // The left hand therefore differs from E♭ major (thumbs on G and D), whose
    // G and D are G♭ and D♭ here.
    // One octave: RH 3 1 2 3 4 1 2 3 · LH 2 1 4 3 2 1 3 2.
    3: {
      right: { cycle: [3, 1, 2, 3, 4, 1, 2], bottom: 3, top: 3 },
      left: { cycle: [2, 1, 4, 3, 2, 1, 3], bottom: 2, top: 2 },
    },

    // E minor: E F♯ G A B C D♯ — RH thumbs on E and A; LH thumbs on E and B.
    // One octave: RH 1 2 3 1 2 3 4 5 · LH 5 4 3 2 1 3 2 1.
    4: {
      right: { cycle: [1, 2, 3, 1, 2, 3, 4], bottom: 1, top: 5 },
      left: { cycle: [1, 4, 3, 2, 1, 3, 2], bottom: 5, top: 1 },
    },

    // F minor: F G A♭ B♭ C D♭ E — RH thumbs on F and C; LH thumbs on F and C.
    // Same shape as F major, including the RH ending on 4 rather than 5.
    // One octave: RH 1 2 3 4 1 2 3 4 · LH 5 4 3 2 1 3 2 1.
    5: {
      right: { cycle: [1, 2, 3, 4, 1, 2, 3], bottom: 1, top: 4 },
      left: { cycle: [1, 4, 3, 2, 1, 3, 2], bottom: 5, top: 1 },
    },

    // F♯ minor: F♯ G♯ A B C♯ D E♯ — RH thumbs on A and D; LH thumbs on B and E♯.
    // The hands take different partitions here, which is what the scale charts
    // print: the LH keeps the F♯ major shape (thumbs on B and E♯, both white in
    // every form), the RH moves its thumbs to A and D.
    // Melodic-ascending caveat: the RH thumb on degree 6 falls on D♯ when the
    // 6th is raised. Traditional; kept deliberately.
    // Some editions start the RH run on 2 (2 3 1 2 3 1 2 3), shortening the
    // opening group rather than beginning on the interior finger; that variant
    // cannot be expressed as one cycle plus endpoints, so the interior-finger
    // form (also attested) is used.
    // One octave: RH 3 4 1 2 3 1 2 3 · LH 4 3 2 1 3 2 1 4.
    6: {
      right: { cycle: [3, 4, 1, 2, 3, 1, 2], bottom: 3, top: 3 },
      left: { cycle: [4, 3, 2, 1, 3, 2, 1], bottom: 4, top: 4 },
    },

    // G minor: G A B♭ C D E♭ F♯ — RH thumbs on G and C; LH thumbs on G and D.
    // One octave: RH 1 2 3 1 2 3 4 5 · LH 5 4 3 2 1 3 2 1.
    7: {
      right: { cycle: [1, 2, 3, 1, 2, 3, 4], bottom: 1, top: 5 },
      left: { cycle: [1, 4, 3, 2, 1, 3, 2], bottom: 5, top: 1 },
    },

    // G♯ minor: G♯ A♯ B C♯ D♯ E F𝄪 — RH thumbs on B and E; LH thumbs on B and E.
    // Thumbs on degrees 3 and 6, which are white in all three forms (degree 6 is
    // E in the natural and harmonic forms and E♯, sounding F, in the melodic).
    // Charts that finger the harmonic form alone sometimes put the LH thumb on
    // the raised 7th, F𝄪 sounding G (LH 3 2 1 4 3 2 1 3); that thumb lands on
    // F♯, a black key, as soon as the natural or melodic-descending form is
    // played, so the shared fingering here uses B and E instead.
    // One octave: RH 3 4 1 2 3 1 2 3 · LH 3 2 1 3 2 1 4 3.
    8: {
      right: { cycle: [3, 4, 1, 2, 3, 1, 2], bottom: 3, top: 3 },
      left: { cycle: [3, 2, 1, 3, 2, 1, 4], bottom: 3, top: 3 },
    },

    // A minor: A B C D E F G♯ — RH thumbs on A and D; LH thumbs on A and E.
    // The G♯ of the harmonic form is degree 7, fingered 4 (RH) / 2 (LH); the
    // thumbs never touch it.
    // One octave: RH 1 2 3 1 2 3 4 5 · LH 5 4 3 2 1 3 2 1.
    9: {
      right: { cycle: [1, 2, 3, 1, 2, 3, 4], bottom: 1, top: 5 },
      left: { cycle: [1, 4, 3, 2, 1, 3, 2], bottom: 5, top: 1 },
    },

    // B♭ minor: B♭ C D♭ E♭ F G♭ A — RH thumbs on C and F; LH thumbs on C and F.
    // The cycle matches B♭ major, but the traditional RH *starts* the run on 2
    // rather than on the interior 4 (2 1 2 3 1 2 3 4, not 4 1 2 3 1 2 3 4): the
    // tonic is one step below the first thumb, so the hand needs no more than
    // the second finger to reach it. This is the catalogue's only entry whose
    // `bottom` is not derivable from the cycle; it is kept because the scale
    // charts agree on it. Editions that print 4 1 2 3 1 2 3 4 differ only in
    // that first note.
    // One octave: RH 2 1 2 3 1 2 3 4 · LH 2 1 3 2 1 4 3 2.
    10: {
      right: { cycle: [4, 1, 2, 3, 1, 2, 3], bottom: 2, top: 4 },
      left: { cycle: [2, 1, 3, 2, 1, 4, 3], bottom: 2, top: 2 },
    },

    // B minor: B C♯ D E F♯ G A♯ — RH thumbs on B and E; LH thumbs on B and E.
    // The left hand cannot use the A-minor shape (thumbs on degrees 1 and 5)
    // because degree 5 is F♯, a black key — so B minor's LH is 4 3 2 1 4 3 2 1,
    // not 5 4 3 2 1 3 2 1. As in B major, degree 1 is a left-hand thumb, so
    // cycle[0] = 1 and only the lowest B of the run takes 4.
    // One octave: RH 1 2 3 1 2 3 4 5 · LH 4 3 2 1 4 3 2 1.
    11: {
      right: { cycle: [1, 2, 3, 1, 2, 3, 4], bottom: 1, top: 5 },
      left: { cycle: [1, 3, 2, 1, 4, 3, 2], bottom: 4, top: 1 },
    },
  },
};
