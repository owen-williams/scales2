/**
 * Fedele Fenaroli, *Regole musicali per i principianti di cembalo* (Naples,
 * 1775) — the Neapolitan partimento rule, and the version nearly every modern
 * presentation descends from.
 *
 * Curated from Fenaroli's own text, which is unusually generous: he does not
 * merely figure the bass, he writes out the right hand of every chord of the
 * scale as an ordered list of intervals, and does it three times, once for each
 * position. Those lists are what the `upper` triples below record, low to high.
 *
 * Sources
 * -------
 * - **Fenaroli, *Regole musicali per i principianti di cembalo* (Naples: Mazzola-
 *   Vocola, 1775)**, chapters *Posizioni delle mano destra*, *Delle scale*,
 *   *Scala in prima / seconda / terza posizione*, *Scala in terza minore*.
 *   Reading edition, Thesaurus Musicarum Italicarum, Utrecht University:
 *   https://tmiweb.science.uu.nl/text/reading-edition/fenreg.html
 *   Everything below is his, quoted in the row comments.
 * - **Robert Gjerdingen, partimenti.org**, *Learning the Rule of the Octave*
 *   (beginner's guide): confirms the minor-mode rule ("when ascending, 6̂ and 7̂
 *   have the same pitches as in the major mode, but when descending, they are
 *   both flatted"), and names the descending sixth's chord in C minor outright —
 *   "the interval from a lowered 6̂ to a raised 4̂ (e.g., A♭ to F♯ in C minor)".
 *   https://partimenti.org/partimenti/about_parti/beginners_guide/learning_the_rule.pdf
 * - **Gettysburg College, *Counterpoint Resources*, "The Rule of the Octave"**:
 *   the same figures set out degree by degree, attributed to Fenaroli 1775.
 *   https://musictheory.sites.gettysburg.edu/unit-4-1/the-rule-of-the-octave/
 * - **Giorgio Sanguinetti, *The Art of Partimento* (OUP, 2012)**, ch. 9, on the
 *   descending fourth degree: the second and fourth over it are passing
 *   dissonances "prepared by 5/3 on the previous fifth degree" — which is
 *   exactly why the three upper voices are held unchanged from 5̂ to 4̂ here.
 *
 * The one editorial decision, and why
 * ------------------------------------
 * Fenaroli's printed right hand is not always three notes. He adds the octave
 * to the dissonant chords (ascending 4̂ is "6, 8, 3 e 5" — four notes) and drops
 * it from a few where the reach is awkward (descending 7̂ in first position is
 * just "3 e 6" — two). The number he prints is a matter of what falls under the
 * hand, not of what the chord is: in *some* position he prints every chord's
 * three non-bass tones and no more, and the tables below are exactly that
 * reading. Concretely, for the four-note chords the octave is dropped (which is
 * what his second or third position prints), and for the two-note ones it is
 * restored (which is what another position prints). This is the same
 * normalisation modern editions make — fourscoreandmore.org describes its
 * Fenaroli-based version as modified "to preserve a consistent number of voices
 * throughout" — and it is what makes the three positions exact rotations of one
 * voicing rather than three separate hand shapes.
 *
 * Documented variants deliberately NOT taken (Fenaroli's own words, same text):
 * - Descending 4̂: "considerata poi come quarta, ed essendo nota fondamentale,
 *   deve avere 3 e 5" — read as a real fourth degree rather than a passing note
 *   it takes a plain 5/3. The rule proper uses the 4/2, which is what is here.
 * - The descending half "considerata poi nella sua naturalezza": plain 3-and-6
 *   chords from 6̂ down to 2̂, "quale movimento non richiede altro se non una sola
 *   posizione di mano". A simpler alternative he offers to beginners.
 * - Minor: "può farsi la detta scala nel salire fino a sesta minore e dalla sesta
 *   minore discendere poi sino alla prima" — an incomplete octave that avoids
 *   the raised sixth altogether. Not a full octave, so out of scope here.
 * Each is a candidate for a future version file; none may be silently mixed in.
 */

import { v } from './types';
import type { RuleOfOctaveVersion } from './types';

/**
 * Major, C major shown in the comments.
 *
 * Fenaroli, *Scala in prima posizione*, quoted in full and in order:
 * "Alla prima del tono se le dà 3, 5, ed 8; alla seconda se le dà 3, 4 e 6
 * maggiore; alla terza 8, 3, e 6; alla quarta 6, 8, 3 e 5; alla quinta 5, 8 e 3
 * maggiore; alla sesta 6, 8 e 3; alla settima 5 falsa, 6, 8 e terza; ed
 * all'ottava 3, 5 ed 8. Discendendo poi alla settima se le dà 3 e 6; alla sesta
 * 4, 6 maggiore e 3; alla quinta 5, 8 e 3 maggiore; alla quarta 6, 2 e quarta
 * maggiore; alla terza 8, 3 e 6; alla seconda 3, 4 e 6 maggiore; finalmente alla
 * prima 3, 5 ed 8."
 *
 * Read each list as intervals above that bass note, low to high; the `upper`
 * triples restate them as degrees of the key so they spell themselves in every
 * key. Only two chords in the octave are perfect chords, on 1̂ and 5̂ — everything
 * else is a sixth chord of some kind, which is the point of the rule.
 */
const FENAROLI_MAJOR = {
  ascending: [
    // 1̂ C: 5/3, the tonic. RH E–G–C ("3, 5, ed 8"). Octave on top: first position.
    { bass: 1, bassAlter: 0, figure: '5/3', upper: [v(3), v(5), v(1)] },
    // 2̂ D: 4/3 — G7 over its fifth. RH F–G–B ("3, 4 e 6 maggiore").
    { bass: 2, bassAlter: 0, figure: '6/4/3', upper: [v(4), v(5), v(7)] },
    // 3̂ E: 6/3, the tonic chord over its third. RH E–G–C ("8, 3, e 6").
    { bass: 3, bassAlter: 0, figure: '6/3', upper: [v(3), v(5), v(1)] },
    // 4̂ F: 6/5 — Dm7 over its third, leading to the dominant. RH D–A–C
    // ("6, 8, 3 e 5", less the octave F).
    { bass: 4, bassAlter: 0, figure: '6/5/3', upper: [v(2), v(6), v(1)] },
    // 5̂ G: 5/3, the dominant. RH D–G–B ("5, 8 e 3 maggiore").
    { bass: 5, bassAlter: 0, figure: '5/3', upper: [v(2), v(5), v(7)] },
    // 6̂ A: 6/3 — the subdominant over its third. RH F–A–C ("6, 8 e 3").
    { bass: 6, bassAlter: 0, figure: '6/3', upper: [v(4), v(6), v(1)] },
    // 7̂ B: 6/5 on the leading tone, the fifth diminished — G7 over its third.
    // RH F–G–D ("5 falsa, 6, 8 e terza", less the octave B, which would double
    // the leading tone).
    { bass: 7, bassAlter: 0, figure: '6/♭5/3', upper: [v(4), v(5), v(2)] },
    // 8̂ C: 5/3, the tonic reached. RH E–G–C ("3, 5 ed 8") — the hand is back
    // where it started, which is what a position means.
    { bass: 1, bassAlter: 0, figure: '5/3', upper: [v(3), v(5), v(1)] },
  ],
  descending: [
    // 7̂ B: 6/3 — the dominant over its third, no seventh coming down.
    // RH D–G–B ("3 e 6", with the octave B restored).
    { bass: 7, bassAlter: 0, figure: '6/3', upper: [v(2), v(5), v(7)] },
    // 6̂ A: ♯6/4/3 — D7, the dominant of the dominant, over its fifth. The
    // sharpened fourth degree (F♯) is the one chromatic note of the major rule.
    // RH D–F♯–C ("4, 6 maggiore e 3").
    { bass: 6, bassAlter: 0, figure: '♯6/4/3', upper: [v(2), v(4, 1), v(1)] },
    // 5̂ G: 5/3, the dominant. RH D–G–B ("5, 8 e 3 maggiore").
    { bass: 5, bassAlter: 0, figure: '5/3', upper: [v(2), v(5), v(7)] },
    // 4̂ F: 4/2 — the same G7, now over its seventh. The upper voices do not
    // move at all from 5̂; only the bass steps down under them, which is what
    // Sanguinetti means by dissonances "prepared by 5/3 on the previous fifth
    // degree". RH D–G–B ("6, 2 e quarta maggiore").
    { bass: 4, bassAlter: 0, figure: '6/4/2', upper: [v(2), v(5), v(7)] },
    // 3̂ E: 6/3, the tonic over its third. RH E–G–C ("8, 3 e 6").
    { bass: 3, bassAlter: 0, figure: '6/3', upper: [v(3), v(5), v(1)] },
    // 2̂ D: 4/3, as ascending. RH F–G–B ("3, 4 e 6 maggiore").
    { bass: 2, bassAlter: 0, figure: '6/4/3', upper: [v(4), v(5), v(7)] },
    // 1̂ C: 5/3, home. RH E–G–C ("3, 5 ed 8").
    { bass: 1, bassAlter: 0, figure: '5/3', upper: [v(3), v(5), v(1)] },
  ],
} as const;

/**
 * Minor, C minor shown in the comments.
 *
 * Fenaroli, *Scala in terza minore*: "La scala in terza minore si fa ancora in
 * tutte tre le posizioni colla medesima situazione di mano, eccetto però che
 * nella sesta minore del tono, discendendo alla quinta, non ci li mette
 * l'ottava; ma se le dà soltanto nella prima posizione 4, 6 superflua e 3."
 * So the minor is the major table note for note, with two changes:
 *
 * 1. The degrees themselves follow the melodic minor: "nella scala in terza
 *    minore ascendendo, la sesta del tono si fa maggiore e discendendo la
 *    settima del tono si fa minore; e tutto ciò per evitare il ditono, che vi è
 *    tra la sesta minore e la settima maggiore". Raised 6̂ and 7̂ going up,
 *    natural going down — the same rule Gjerdingen states.
 * 2. The descending sixth's major sixth becomes a *superfluous* (augmented)
 *    sixth, because the bass under it is now the flattened sixth degree: A♭
 *    against F♯ in C minor. Fenaroli notes it cannot even be called a second of
 *    the dominant, "perché la seconda deve essere sempre maggiore".
 *
 * The other alterations are the leading tone doing its ordinary work: the third
 * of the dominant on 5̂, the sixth of the 4/3 on 2̂, the fourth of the 4/2 on 4̂.
 * Note the ascending fourth degree keeps the *lowered* sixth degree (A♭ in C
 * minor): it is on its way down to the fifth, not up to the leading tone.
 */
const FENAROLI_MINOR = {
  ascending: [
    // 1̂ C: 5/3, the tonic minor. RH E♭–G–C.
    { bass: 1, bassAlter: 0, figure: '5/3', upper: [v(3), v(5), v(1)] },
    // 2̂ D: 4/3 with the raised seventh — G7 over its fifth. RH F–G–B♮.
    { bass: 2, bassAlter: 0, figure: '♯6/4/3', upper: [v(4), v(5), v(7, 1)] },
    // 3̂ E♭: 6/3, the tonic over its third. RH E♭–G–C.
    { bass: 3, bassAlter: 0, figure: '6/3', upper: [v(3), v(5), v(1)] },
    // 4̂ F: 6/5 — the diminished supertonic seventh over its third. The A♭ is the
    // key's own sixth degree, unraised, because it steps down to G. RH D–A♭–C.
    { bass: 4, bassAlter: 0, figure: '6/5/3', upper: [v(2), v(6), v(1)] },
    // 5̂ G: 5/3 with the major third — the dominant. RH D–G–B♮.
    { bass: 5, bassAlter: 0, figure: '5/♯3', upper: [v(2), v(5), v(7, 1)] },
    // 6̂ A♮ (raised): 6/3 — the subdominant, major here, over its third.
    // RH F–A♮–C.
    { bass: 6, bassAlter: 1, figure: '6/3', upper: [v(4), v(6, 1), v(1)] },
    // 7̂ B♮ (raised): 6/5 on the leading tone, fifth diminished. RH F–G–D.
    { bass: 7, bassAlter: 1, figure: '6/♭5/3', upper: [v(4), v(5), v(2)] },
    // 8̂ C: 5/3, the tonic reached. RH E♭–G–C.
    { bass: 1, bassAlter: 0, figure: '5/3', upper: [v(3), v(5), v(1)] },
  ],
  descending: [
    // 7̂ B♭ (natural, lowered): 6/3 — the *minor* dominant over its third,
    // G minor in C minor. RH D–G–B♭.
    { bass: 7, bassAlter: 0, figure: '6/3', upper: [v(2), v(5), v(7)] },
    // 6̂ A♭ (natural, lowered): the augmented sixth. Fenaroli's "4, 6 superflua e
    // 3" — A♭ in the bass against F♯ above it. RH D–F♯–C: a French sixth
    // (A♭–C–D–F♯), resolving onto the dominant.
    // The one place the two versions in this app part company: Campion's 1716
    // plate figures the same degree 6/4/3 with no sharp at all. See campion.ts.
    { bass: 6, bassAlter: 0, figure: '♯6/4/3', upper: [v(2), v(4, 1), v(1)] },
    // 5̂ G: 5/3 with the major third. RH D–G–B♮.
    { bass: 5, bassAlter: 0, figure: '5/♯3', upper: [v(2), v(5), v(7, 1)] },
    // 4̂ F: 4/2, the fourth raised because it is the leading tone. The upper
    // voices are held from 5̂ exactly as in major. RH D–G–B♮.
    { bass: 4, bassAlter: 0, figure: '6/♯4/2', upper: [v(2), v(5), v(7, 1)] },
    // 3̂ E♭: 6/3, the tonic over its third. RH E♭–G–C.
    { bass: 3, bassAlter: 0, figure: '6/3', upper: [v(3), v(5), v(1)] },
    // 2̂ D: 4/3 with the raised seventh. RH F–G–B♮.
    { bass: 2, bassAlter: 0, figure: '♯6/4/3', upper: [v(4), v(5), v(7, 1)] },
    // 1̂ C: 5/3, home. RH E♭–G–C.
    { bass: 1, bassAlter: 0, figure: '5/3', upper: [v(3), v(5), v(1)] },
  ],
} as const;

export const FENAROLI_RULE: RuleOfOctaveVersion = {
  id: 'fenaroli',
  label: 'Fenaroli',
  source: 'Fedele Fenaroli, Regole musicali per i principianti di cembalo (Naples, 1775)',
  major: FENAROLI_MAJOR,
  minor: FENAROLI_MINOR,
};
