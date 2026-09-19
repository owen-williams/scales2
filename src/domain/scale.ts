/**
 * Scale generation: from a pitch class and a scale type to spelled notes.
 *
 * The whole module rests on one rule — a diatonic scale uses each letter once,
 * in order, and the accidental is whatever makes that letter sound the right
 * semitone. Everything a musician would call "correct spelling" follows from
 * that, including G♯ harmonic minor's F𝄪, which is a genuine note and is never
 * simplified to G.
 *
 * The one free choice is how to spell the *tonic*: D♭ or C♯ both sound alike.
 * That is settled by key-signature economy — whichever spelling needs fewer
 * accidentals in the underlying diatonic collection wins.
 */

import { formatNote, letterAtStep, letterIndex, noteAt, pitchClassOf } from './pitch';
import type { Letter, Pitch, PitchClass, ScaleType, SpelledNote } from './types';

const SEMITONES_PER_OCTAVE = 12;
const LETTERS_PER_OCTAVE = 7;

/** Which form of the scale is wanted; only melodic minor and chromatic differ. */
type ScaleForm = 'ascending' | 'descending';

/** The largest alteration this app will write. Triple accidentals are not music. */
const MAX_ALTER = 2;

const note = (letter: Letter, alter: number): SpelledNote => ({ letter, alter });

/**
 * Candidate spellings for each pitch class, in preference order — ties in the
 * accidental count break toward the earlier entry. The exotic doubles are
 * listed for completeness; they always lose, but including them means the
 * choice is made by the scoring rule rather than by a curated shortlist.
 */
const TONIC_CANDIDATES: Readonly<Record<PitchClass, readonly SpelledNote[]>> = {
  0: [note('C', 0), note('B', 1)],
  1: [note('D', -1), note('C', 1)],
  2: [note('D', 0), note('C', 2), note('E', -2)],
  3: [note('E', -1), note('D', 1)],
  4: [note('E', 0), note('F', -1)],
  5: [note('F', 0), note('E', 1)],
  6: [note('F', 1), note('G', -1)],
  7: [note('G', 0), note('F', 2), note('A', -2)],
  8: [note('A', -1), note('G', 1)],
  9: [note('A', 0), note('B', -2), note('G', 2)],
  10: [note('B', -1), note('A', 1)],
  11: [note('B', 0), note('C', -1)],
};

/**
 * Chromatic spellings by pitch class. Ascending chromatic scales are written
 * with sharps and descending ones with flats — the standard convention, which
 * keeps every accidental pointing in the direction of travel.
 */
const SHARP_SPELLINGS: Readonly<Record<PitchClass, SpelledNote>> = {
  0: note('C', 0),
  1: note('C', 1),
  2: note('D', 0),
  3: note('D', 1),
  4: note('E', 0),
  5: note('F', 0),
  6: note('F', 1),
  7: note('G', 0),
  8: note('G', 1),
  9: note('A', 0),
  10: note('A', 1),
  11: note('B', 0),
};

const FLAT_SPELLINGS: Readonly<Record<PitchClass, SpelledNote>> = {
  0: note('C', 0),
  1: note('D', -1),
  2: note('D', 0),
  3: note('E', -1),
  4: note('E', 0),
  5: note('F', 0),
  6: note('G', -1),
  7: note('G', 0),
  8: note('A', -1),
  9: note('A', 0),
  10: note('B', -1),
  11: note('B', 0),
};

/** Transpose a pitch class up by a (non-negative) semitone offset. */
function transpose(pitchClass: PitchClass, semitones: number): PitchClass {
  return ((pitchClass + semitones) % SEMITONES_PER_OCTAVE) as PitchClass;
}

/**
 * Spell a collection one letter per degree: degree *n* takes the letter *n*
 * steps above the tonic and whatever accidental lands it on the right semitone.
 */
function spellDiatonic(tonic: SpelledNote, formula: readonly number[]): SpelledNote[] {
  const tonicPc = pitchClassOf(tonic);
  return formula.map((semitones, degree) =>
    noteAt(letterAtStep(tonic.letter, degree), transpose(tonicPc, semitones)),
  );
}

/**
 * Spell a chromatic scale from the fixed sharp or flat table, except for the
 * tonic itself, which always keeps the spelling it was chosen with: an F♯
 * chromatic scale begins and ends on F♯, never on G♭.
 *
 * The table is chosen by the tonic rather than purely by direction. The usual
 * rule of thumb — sharps ascending, flats descending — assumes a natural tonic,
 * and applied blindly it produces D♭ D D♯ on the way up from D♭: three notes in
 * a row on the same letter, which no editor would print. An accidented tonic
 * therefore keeps its own accidental in both directions, so D♭ chromatic reads
 * D♭ D E♭ E F G♭ … and F♯ chromatic reads F♯ G G♯ A A♯ B … .
 */
function spellChromatic(
  tonic: SpelledNote,
  formula: readonly number[],
  form: ScaleForm,
): SpelledNote[] {
  const useSharps =
    tonic.alter > 0 || (tonic.alter === 0 && form === 'ascending');
  const table = useSharps ? SHARP_SPELLINGS : FLAT_SPELLINGS;
  const tonicPc = pitchClassOf(tonic);
  return formula.map((semitones, degree) =>
    degree === 0 ? tonic : table[transpose(tonicPc, semitones)],
  );
}

/**
 * The spelling of the tonic for this scale type, chosen by key-signature
 * economy: generate the underlying diatonic collection with each candidate and
 * keep the one needing the fewest accidentals. Scoring against
 * `signatureFormula` rather than the ascending formula means the comparison is
 * between the two key *signatures*, ignoring the raised seventh that either
 * spelling would write as an accidental anyway. That is what makes G♯ harmonic
 * minor (5 sharps) beat A♭ harmonic minor (7 flats); scored against the
 * ascending formula the raised seventh would flip it the wrong way.
 *
 * Where the two signatures genuinely tie — E♭ against D♯ minor, F♯ against G♭
 * major, and ten other pairs — the winner is the earlier entry in
 * `TONIC_CANDIDATES`, which is ordered by convention. The rule decides most
 * keys; the ordering decides the ties, and both are load-bearing.
 *
 * Yields the conventional key lists: majors C D♭ D E♭ E F F♯ G A♭ A B♭ B;
 * minors C C♯ D E♭ E F F♯ G G♯ A B♭ B.
 */
export function chooseTonicSpelling(pc: PitchClass, scaleType: ScaleType): SpelledNote {
  let best: SpelledNote | undefined;
  let bestScore = Infinity;

  for (const candidate of TONIC_CANDIDATES[pc]) {
    const collection = spellDiatonic(candidate, scaleType.signatureFormula);
    // A spelling that would need a triple accidental anywhere is not a key.
    if (collection.some((degree) => Math.abs(degree.alter) > MAX_ALTER)) continue;

    const score = collection.reduce((total, degree) => total + Math.abs(degree.alter), 0);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  // Unreachable: every pitch class has at least one plain-enough spelling.
  if (best === undefined) throw new Error(`No usable spelling for pitch class ${pc}`);
  return best;
}

/**
 * The key signature, in fifths: positive for sharps, negative for flats.
 *
 * A diatonic collection is never mixed, so summing its alterations counts the
 * accidentals *and* gets their direction right for free — and a double flat
 * correctly counts as two flats. Harmonic and melodic minor are notated with
 * the natural minor signature, which is what `signatureFormula` holds.
 */
export function keySignatureFifths(tonic: SpelledNote, scaleType: ScaleType): number {
  // A chromatic scale is written without a key signature.
  if (scaleType.spelling === 'chromatic') return 0;

  return spellDiatonic(tonic, scaleType.signatureFormula).reduce(
    (total, degree) => total + degree.alter,
    0,
  );
}

/** Display name, e.g. "E♭ Harmonic Minor". */
export function scaleName(tonic: SpelledNote, scaleType: ScaleType): string {
  return `${formatNote(tonic)} ${scaleType.name}`;
}

/**
 * One octave of spelled degrees, ascending, EXCLUDING the upper tonic.
 * Length 7 for diatonic scales, 12 for chromatic.
 * `form: 'descending'` returns the descending form still written in ascending
 * order (differs from 'ascending' only for melodic minor and chromatic).
 */
export function scaleDegrees(
  tonic: SpelledNote,
  scaleType: ScaleType,
  form: ScaleForm,
): SpelledNote[] {
  const formula = form === 'ascending' ? scaleType.ascendingFormula : scaleType.descendingFormula;
  return scaleType.spelling === 'chromatic'
    ? spellChromatic(tonic, formula, form)
    : spellDiatonic(tonic, formula);
}

interface PlacedDegree {
  readonly note: SpelledNote;
  /** Octaves above the tonic's own octave — 0 or 1 within a single octave. */
  readonly octaveShift: number;
}

/** Forward distance in letters, 0…6, so a repeated letter counts as no step. */
function forwardLetterSteps(from: Letter, to: Letter): number {
  return (letterIndex(to) - letterIndex(from) + LETTERS_PER_OCTAVE) % LETTERS_PER_OCTAVE;
}

/**
 * Work out which octave number each degree carries.
 *
 * Octave numbers change at C — a *letter* boundary — so this counts letters
 * rather than semitones. That is what writes B♯3 → C𝄪4 (the two sound a
 * semitone apart but straddle the octave number change) and keeps C♭4 in
 * octave 4 even though it sounds like B3. Successive degrees are always
 * either the same letter (chromatic) or the next one up, so accumulating the
 * forward letter distance never over- or under-counts a wrap.
 */
function placeDegrees(tonic: SpelledNote, degrees: readonly SpelledNote[]): PlacedDegree[] {
  let position = letterIndex(tonic.letter);
  let previous = tonic.letter;

  return degrees.map((degree) => {
    position += forwardLetterSteps(previous, degree.letter);
    previous = degree.letter;
    return { note: degree, octaveShift: Math.floor(position / LETTERS_PER_OCTAVE) };
  });
}

/**
 * A full run of spelled pitches in one direction.
 * `startOctave` is the scientific octave of the LOWEST tonic in the run,
 * regardless of direction. Length is always `octaves * degreeCount + 1`.
 * `direction: 'up'` returns lowest→highest using the ascending form;
 * `direction: 'down'` returns highest→lowest using the descending form.
 */
export function buildRun(params: {
  tonic: SpelledNote;
  scaleType: ScaleType;
  octaves: number;
  startOctave: number;
  direction: 'up' | 'down';
}): Pitch[] {
  const { tonic, scaleType, octaves, startOctave, direction } = params;

  // A descending run is the descending form built upwards and then turned
  // round, so both directions share one octave-placement path.
  const form: ScaleForm = direction === 'up' ? 'ascending' : 'descending';
  const block = placeDegrees(tonic, scaleDegrees(tonic, scaleType, form));

  const pitches: Pitch[] = [];
  for (let octave = 0; octave < octaves; octave += 1) {
    for (const { note: degree, octaveShift } of block) {
      pitches.push({
        letter: degree.letter,
        alter: degree.alter,
        octave: startOctave + octave + octaveShift,
      });
    }
  }
  // The run closes on the tonic an exact number of octaves above where it began.
  pitches.push({ letter: tonic.letter, alter: tonic.alter, octave: startOctave + octaves });

  return direction === 'up' ? pitches : pitches.reverse();
}
