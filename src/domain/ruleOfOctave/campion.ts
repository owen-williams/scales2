/**
 * François Campion, *Traité d'accompagnement et de composition, selon la règle
 * des octaves de musique* (Paris: veuve G. Adam, 1716) — the first printed rule
 * of the octave, and the one that gave it its name.
 *
 * Curated from the two engraved plates bound between pages 6 and 7 of the
 * treatise, headed TON MAJEUR and TON MINEUR, each giving the figured octave in
 * all twelve keys. The figures below were read off the first stave of each
 * plate — C major on the major plate, D minor "réyen" (written, as Campion
 * writes all his flat minors, with one flat fewer than today) on the minor.
 *
 * Sources
 * -------
 * - **Campion 1716, plates *Ton Majeur* and *Ton Mineur*.** Digitised by the
 *   Bibliothèque nationale de France:
 *   https://gallica.bnf.fr/ark:/12148/bpt6k1175541j  (images f14 and f15)
 *   Read directly. Major, in order:
 *     8/5/3 · 6/4/3 · 8/6/3 · 6/5/3 · 8/5/3 · 3/6/3 · 6/5̸/3 · 8/5/3 ‖
 *     3/6/3 · ♯6/4/3 · 8/5/3 · 2/6/4 · 8/6/3 · 6/4/3 · 8/5/3
 *   Minor, the same, with ♯ on the sixth of 2̂, ♭ on the third of 4̂ and ♯ on the
 *   third of 5̂ (Campion's signature-light spelling), the bass sharpened on the
 *   ascending 6̂ and 7̂ and flattened on the descending 6̂, and — the point of this
 *   file — **6/4/3 with no sharp anywhere** on that descending 6̂.
 * - **Nicolas Meeùs, *Théorie de la musique*, "1716 Campion"**, which prints
 *   Campion's major règle as a table and reduces it to fundamentals
 *   "I V I II V IV V I | V II♯ V V I V I":
 *   http://nicolas.meeus.free.fr/mt/1716_Campion.html
 * - **Patrice Nicolas, "Challenging Some Misconceptions about the *Règle de
 *   l'octave*", *Music Theory Online* 25/4 (2019)**, §2.10 and §2.14:
 *   "Campion's règle and minor key progression make clear that whenever 6̂
 *   descends to 5̂, it calls for a four-three chord", and the augmented-sixth
 *   sonority ("chord of the superfluous second") is one of the *extraordinary*
 *   chords Campion gives 6̂ "instead of its regular four-three chord".
 *   https://www.mtosmt.org/issues/mto.19.25.4/mto.19.25.4.nicolas.html
 * - **Jean-Marc Toillon, "La Règle de l'Octave"** (harmony sheet in the French
 *   tradition), whose minor is "comme en Majeur, sans l'emprunt au ton de la
 *   dominante en descendant" — as in major, without the borrowing from the key
 *   of the dominant on the way down: exactly the II rather than V/V on 6̂.
 *   https://jmt-musique.com/harmonie_files/fiches/13-regle-octave.pdf
 *
 * How this differs from Fenaroli — and how it does not
 * ----------------------------------------------------
 * In **major the two are the same harmonisation, figure for figure.** That is
 * not an oversight in the curation, it is the historically interesting fact:
 * Heinichen, comparing his own version with Campion's and Gasparini's in 1728,
 * asked "how it comes to pass that three subjects of different nations could
 * fall on the same principle", and answered that the thing is simply "so
 * natural, so well-founded" that no author could arrive at another. The major
 * table below is therefore identical to Fenaroli's, and both are reproduced in
 * full rather than one aliasing the other, so each stands on its own source.
 *
 * In **minor they differ at one chord**, the descending sixth degree, and it is
 * the most characteristic sonority of the whole rule:
 *   Fenaroli  A♭ · C–D–F♯  an augmented sixth ("sesta superflua")
 *   Campion   A♭ · C–D–F   a plain four-three, the supertonic seventh
 * Campion's plate has no sharp there; Fenaroli's text names the augmented sixth
 * explicitly. Both readings are attested, so both ship.
 *
 * One documented reading NOT taken. Campion's plates figure the ascending 6̂ and
 * the descending 7̂ `3/6/3` — the *third* doubled at the octave — where every
 * other sixth chord is figured `8/6/3`, the bass doubled. Musically that is the
 * better choice (the descending 7̂ is the leading tone, and doubling it is
 * avoided). It is not implemented, because a chord holding one pitch class twice
 * an octave apart cannot be rotated into a second and third position: the
 * rotation would carry the lower copy above the upper one, spreading the right
 * hand across a twelfth. Campion prints only one disposition, so there is
 * nothing to say what he would have done; Fenaroli, who prints all three, gives
 * the bass's octave in that slot. The tables below follow Fenaroli's
 * disposition, which is what makes the three positions rotations of one voicing.
 */

import { v } from './types';
import type { RuleOfOctaveVersion } from './types';

/**
 * Major, C major shown in the comments. Identical to Fenaroli's — see the note
 * above. The figures are Campion's own, less the octave he prints on the perfect
 * and sixth chords, which the ordered `upper` triple carries instead.
 */
const CAMPION_MAJOR = {
  ascending: [
    // 1̂ C: 8/5/3, the tonic. RH E–G–C.
    { bass: 1, bassAlter: 0, figure: '5/3', upper: [v(3), v(5), v(1)] },
    // 2̂ D: 6/4/3 — the dominant seventh over its fifth. RH F–G–B.
    { bass: 2, bassAlter: 0, figure: '6/4/3', upper: [v(4), v(5), v(7)] },
    // 3̂ E: 8/6/3, the tonic over its third. RH E–G–C.
    { bass: 3, bassAlter: 0, figure: '6/3', upper: [v(3), v(5), v(1)] },
    // 4̂ F: 6/5/3 — the supertonic seventh over its third. RH D–A–C.
    { bass: 4, bassAlter: 0, figure: '6/5/3', upper: [v(2), v(6), v(1)] },
    // 5̂ G: 8/5/3, the dominant. RH D–G–B.
    { bass: 5, bassAlter: 0, figure: '5/3', upper: [v(2), v(5), v(7)] },
    // 6̂ A: sixth chord, the subdominant over its third. Campion figures it
    // 3/6/3, doubling the third; the octave is used here instead — see above.
    // RH F–A–C.
    { bass: 6, bassAlter: 0, figure: '6/3', upper: [v(4), v(6), v(1)] },
    // 7̂ B: 6/5̸/3, the false (diminished) fifth — the dominant seventh over its
    // third. RH F–G–D.
    { bass: 7, bassAlter: 0, figure: '6/♭5/3', upper: [v(4), v(5), v(2)] },
    // 8̂ C: 8/5/3, the tonic reached. RH E–G–C.
    { bass: 1, bassAlter: 0, figure: '5/3', upper: [v(3), v(5), v(1)] },
  ],
  descending: [
    // 7̂ B: sixth chord, the dominant over its third. Campion figures it 3/6/3
    // — the third doubled rather than the leading tone. RH D–G–B.
    { bass: 7, bassAlter: 0, figure: '6/3', upper: [v(2), v(5), v(7)] },
    // 6̂ A: ♯6/4/3 — the dominant of the dominant, Meeùs's "II♯". The sharpened
    // fourth degree is the only chromatic note in the major rule. RH D–F♯–C.
    { bass: 6, bassAlter: 0, figure: '♯6/4/3', upper: [v(2), v(4, 1), v(1)] },
    // 5̂ G: 8/5/3, the dominant. RH D–G–B.
    { bass: 5, bassAlter: 0, figure: '5/3', upper: [v(2), v(5), v(7)] },
    // 4̂ F: 2/6/4 — the same dominant seventh, now over its seventh, the upper
    // voices held over unchanged from 5̂. RH D–G–B.
    { bass: 4, bassAlter: 0, figure: '6/4/2', upper: [v(2), v(5), v(7)] },
    // 3̂ E: 8/6/3, the tonic over its third. RH E–G–C.
    { bass: 3, bassAlter: 0, figure: '6/3', upper: [v(3), v(5), v(1)] },
    // 2̂ D: 6/4/3. RH F–G–B.
    { bass: 2, bassAlter: 0, figure: '6/4/3', upper: [v(4), v(5), v(7)] },
    // 1̂ C: 8/5/3, home. RH E–G–C.
    { bass: 1, bassAlter: 0, figure: '5/3', upper: [v(3), v(5), v(1)] },
  ],
} as const;

/**
 * Minor, C minor shown in the comments.
 *
 * Campion's minor is the major table with the melodic-minor bass — his tables
 * are, in Meeùs's summary, "mélodiques en montant, antiques (éoliens) en
 * descendant" — and one genuine harmonic difference: the descending sixth
 * degree takes a plain four-three, so no augmented sixth ever sounds. Everything
 * chromatic that remains is the leading tone doing its ordinary work.
 */
const CAMPION_MINOR = {
  ascending: [
    // 1̂ C: 8/5/3, the tonic minor. RH E♭–G–C.
    { bass: 1, bassAlter: 0, figure: '5/3', upper: [v(3), v(5), v(1)] },
    // 2̂ D: ♯6/4/3 — Campion's plate sharpens the sixth: the leading tone.
    // RH F–G–B♮.
    { bass: 2, bassAlter: 0, figure: '♯6/4/3', upper: [v(4), v(5), v(7, 1)] },
    // 3̂ E♭: 8/6/3, the tonic over its third. RH E♭–G–C.
    { bass: 3, bassAlter: 0, figure: '6/3', upper: [v(3), v(5), v(1)] },
    // 4̂ F: 6/5/♭3 on the plate — the flat is Campion's, whose minor key
    // signatures carry one flat fewer than ours; the note is the key's own sixth
    // degree, unraised, on its way down to the dominant. RH D–A♭–C.
    { bass: 4, bassAlter: 0, figure: '6/5/3', upper: [v(2), v(6), v(1)] },
    // 5̂ G: 8/5/♯3, the dominant with its major third. RH D–G–B♮.
    { bass: 5, bassAlter: 0, figure: '5/♯3', upper: [v(2), v(5), v(7, 1)] },
    // 6̂ A♮ (raised, sharpened on the plate): sixth chord, the major
    // subdominant over its third. RH F–A♮–C.
    { bass: 6, bassAlter: 1, figure: '6/3', upper: [v(4), v(6, 1), v(1)] },
    // 7̂ B♮ (raised): 6/5̸/3 on the leading tone. RH F–G–D.
    { bass: 7, bassAlter: 1, figure: '6/♭5/3', upper: [v(4), v(5), v(2)] },
    // 8̂ C: 8/5/3, the tonic reached. RH E♭–G–C.
    { bass: 1, bassAlter: 0, figure: '5/3', upper: [v(3), v(5), v(1)] },
  ],
  descending: [
    // 7̂ B♭ (natural, lowered): sixth chord — the minor dominant over its third.
    // RH D–G–B♭.
    { bass: 7, bassAlter: 0, figure: '6/3', upper: [v(2), v(5), v(7)] },
    // 6̂ A♭ (natural, lowered): 6/4/3, and on Campion's plate no sharp appears in
    // the figure — the supertonic seventh over its fifth, not an augmented
    // sixth. RH D–F♮–C. This is the one chord where the two versions in this app
    // disagree; Fenaroli reads F♯ here. See fenaroli.ts.
    { bass: 6, bassAlter: 0, figure: '6/4/3', upper: [v(2), v(4), v(1)] },
    // 5̂ G: 8/5/♯3, the dominant. RH D–G–B♮.
    { bass: 5, bassAlter: 0, figure: '5/♯3', upper: [v(2), v(5), v(7, 1)] },
    // 4̂ F: 2/6/♯4 — the fourth sharpened because it is the leading tone; the
    // upper voices held over from 5̂. RH D–G–B♮.
    { bass: 4, bassAlter: 0, figure: '6/♯4/2', upper: [v(2), v(5), v(7, 1)] },
    // 3̂ E♭: 8/6/3, the tonic over its third. RH E♭–G–C.
    { bass: 3, bassAlter: 0, figure: '6/3', upper: [v(3), v(5), v(1)] },
    // 2̂ D: ♯6/4/3. RH F–G–B♮.
    { bass: 2, bassAlter: 0, figure: '♯6/4/3', upper: [v(4), v(5), v(7, 1)] },
    // 1̂ C: 8/5/3, home. RH E♭–G–C.
    { bass: 1, bassAlter: 0, figure: '5/3', upper: [v(3), v(5), v(1)] },
  ],
} as const;

export const CAMPION_RULE: RuleOfOctaveVersion = {
  id: 'campion',
  label: 'Campion',
  source:
    "François Campion, Traité d'accompagnement et de composition, selon la règle des octaves de musique (Paris, 1716)",
  major: CAMPION_MAJOR,
  minor: CAMPION_MINOR,
};
