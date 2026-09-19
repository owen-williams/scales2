/**
 * The public face of the curated Rule of the Octave catalogue.
 *
 * Given a key, a mode, a version and a position, produce the music: the bass in
 * the left hand, three upper voices in the right, one octave up and back down.
 * Nothing here invents harmony — every note comes from a table in `fenaroli.ts`
 * or `campion.ts`, spelled through the key's own collection by the same
 * machinery the scales use.
 *
 * Three decisions carry the module.
 *
 * **The tables hold scale degrees; this module holds octaves.** A row says
 * "third, fifth, tonic, low to high" and nothing about register. Placing them is
 * one rule: the lowest voice takes the *lowest* written position of its letter
 * that is not below the right hand's floor, and each voice above it takes the
 * next position of its own letter. The floor is the top of the bass's octave, so
 * the right hand can never cross under the left, and because voices are stacked
 * by written position rather than by pitch, two of them can never land on the
 * same line or space — which is exactly what the notation layer refuses to
 * engrave.
 *
 * **A position is a rotation, not a table.** Fenaroli defines the three
 * positions by which chord tone is on top — "la prima posizione è quella quando
 * l'ottava sta da sopra; la seconda quando la terza sta da sopra; e la terza
 * quando la quinta sta da sopra" — and prints the tonic chord's three positions
 * as 3-5-8, 5-8-3, 8-3-5. That is one voicing turned over twice, and it is
 * generated here by moving the lowest voice above the highest, twice. The three
 * upper parts are therefore literally the same three lines, entered at different
 * points, which is what makes them one rule rather than three.
 *
 * **The bass sits where a one-octave scale's left hand sits.** Same convention
 * as `realise.ts`: the tonic in octave 3, up an octave and back. Keeping it
 * identical to the scales means the two exercise kinds read at the same size on
 * the same page.
 */

import { formatNote, letterIndex } from '../pitch';
import { chooseTonicSpelling, keySignatureFifths, scaleDegrees } from '../scale';
import { SCALE_TYPES } from '../scaleTypes';
import type {
  Hand,
  HandPart,
  Letter,
  Pitch,
  RuleOfOctaveExercise,
  RuleOfOctaveVersionId,
  ScaleType,
  SpelledNote,
} from '../types';
import { CAMPION_RULE } from './campion';
import { FENAROLI_RULE } from './fenaroli';
import type {
  RuleChord,
  RuleOfOctaveModeTable,
  RuleOfOctaveVersion,
  RuleRow,
  Voice,
} from './types';

export type {
  Alteration,
  Degree,
  RuleChord,
  RuleOfOctaveModeTable,
  RuleOfOctaveVersion,
  RuleRow,
  Voice,
} from './types';
export {
  ASCENDING_BASS_DEGREES,
  DESCENDING_BASS_DEGREES,
  DEGREES,
  EVENTS_PER_RULE,
} from './types';
export { FENAROLI_RULE } from './fenaroli';
export { CAMPION_RULE } from './campion';

const LETTERS_PER_OCTAVE = 7;

/**
 * Where the bass's lowest tonic sits — the same octave a one-octave scale's left
 * hand starts from in `realise.ts`, so the two exercise kinds share a register.
 */
const BASS_OCTAVE = 3;

/**
 * Every curated version, keyed by the id the exercise refers to.
 *
 * The single extension point: a third version is a new file exporting a
 * `RuleOfOctaveVersion` plus one line here, exactly as a new fingering
 * collection is one line in `DIATONIC_FINGERING_SETS`.
 */
export const RULE_OF_OCTAVE_VERSIONS: Readonly<
  Record<RuleOfOctaveVersionId, RuleOfOctaveVersion>
> = {
  fenaroli: FENAROLI_RULE,
  campion: CAMPION_RULE,
};

/** Every version, in display order, with its label. */
export const ROO_VERSIONS: readonly { id: RuleOfOctaveVersionId; label: string }[] = [
  { id: FENAROLI_RULE.id, label: FENAROLI_RULE.label },
  { id: CAMPION_RULE.id, label: CAMPION_RULE.label },
];

/** The table for one version and mode. */
export function ruleOfOctaveTable(
  version: RuleOfOctaveVersionId,
  mode: 'major' | 'minor',
): RuleOfOctaveModeTable {
  const entry = RULE_OF_OCTAVE_VERSIONS[version];
  return mode === 'major' ? entry.major : entry.minor;
}

/** The fifteen rows of a complete scale, ascending then descending. */
function rowsOf(table: RuleOfOctaveModeTable): readonly (RuleChord | null)[] {
  return [...table.ascending, ...table.descending];
}

/**
 * True when every degree of this version and mode is corroborated.
 *
 * A `null` row is a gap in the historical record, not a licence to invent a
 * chord, so an incomplete table means the app must not offer that exercise.
 * Mirrors `hasFingering` in the fingering catalogue.
 */
export function isRuleOfOctaveComplete(
  version: RuleOfOctaveVersionId,
  mode: 'major' | 'minor',
): boolean {
  return rowsOf(ruleOfOctaveTable(version, mode)).every((row) => row !== null);
}

/** Two voices singing the same note of the key. */
function sameVoice(a: Voice, b: Voice): boolean {
  return a.degree === b.degree && a.alter === b.alter;
}

/**
 * Whether two rows put the same notes in the same order.
 *
 * The `figure` is deliberately not compared. It is how a source *prints* the
 * chord — Campion's plates and Fenaroli's text figure several identical chords
 * differently, and Campion writes his minors a flat light — whereas what reaches
 * the player is notes on a stave. Two rows that sound alike are the same music
 * however they were engraved in 1716.
 *
 * A `null` row equals only another `null`: a gap in one source is not agreement
 * with a chord in another.
 */
function sameRow(a: RuleRow, b: RuleRow): boolean {
  if (a === null || b === null) return a === b;
  if (a.bass !== b.bass || a.bassAlter !== b.bassAlter) return false;
  return a.upper.every((voice, index) => {
    const other = b.upper[index];
    return other !== undefined && sameVoice(voice, other);
  });
}

/** Whether two tables agree on every one of the fifteen slots. */
function tablesAgree(a: RuleOfOctaveModeTable, b: RuleOfOctaveModeTable): boolean {
  const left = rowsOf(a);
  const right = rowsOf(b);
  return left.length === right.length && left.every((row, i) => sameRow(row, right[i] ?? null));
}

/**
 * The enabled versions that actually produce different music in this mode.
 * Two versions whose tables agree are one exercise wearing two names.
 *
 * This is not a curation shortcut but a historical fact with consequences for
 * the pool: Campion's rule and Fenaroli's are identical in major, figure for
 * figure, and part company in minor at exactly one chord. Enumerating both in
 * major would put every major exercise into the pool twice, halving the variety
 * of the major half of a uniform draw and telling the user, in the descriptor
 * line, a difference that is not there.
 *
 * The tables are compared structurally rather than the fact being hard-coded, so
 * a third version that *does* differ in major — Heinichen's (1728), say — simply
 * works: it will not collapse into the others, and no code here changes.
 *
 * The result keeps the canonical order of `ROO_VERSIONS` (which is also the
 * order the settings store) and returns the first member of each equal group,
 * so the pool it feeds is deterministic whatever order the user ticked.
 */
export function distinctVersionsFor(
  mode: 'major' | 'minor',
  enabled: readonly RuleOfOctaveVersionId[],
): RuleOfOctaveVersionId[] {
  const kept: RuleOfOctaveVersionId[] = [];

  for (const { id } of ROO_VERSIONS) {
    if (!enabled.includes(id)) continue;
    const table = ruleOfOctaveTable(id, mode);
    const alreadyHeard = kept.some((seen) => tablesAgree(ruleOfOctaveTable(seen, mode), table));
    if (!alreadyHeard) kept.push(id);
  }

  return kept;
}

/** Which scale type supplies the key's collection, spelling and signature. */
function collectionType(mode: 'major' | 'minor'): ScaleType {
  return mode === 'major' ? SCALE_TYPES.major : SCALE_TYPES.naturalMinor;
}

/**
 * A note's position on the stave, counted in letters: C4 is 28, D4 is 29.
 *
 * Written position rather than pitch is the right currency here. It is what
 * decides whether two notes of a chord would collide on the same line or space
 * (which the notation layer treats as a data error), and it ignores
 * accidentals — B♯3 and C4 sound alike but are different places to put a
 * notehead, and a chord may legitimately contain both.
 */
function writtenPosition(letter: Letter, octave: number): number {
  return octave * LETTERS_PER_OCTAVE + letterIndex(letter);
}

/** The lowest pitch spelling this note whose written position is at least `floor`. */
function placeAtOrAbove(note: SpelledNote, floor: number): Pitch {
  const octave = Math.ceil((floor - letterIndex(note.letter)) / LETTERS_PER_OCTAVE);
  return { letter: note.letter, alter: note.alter, octave };
}

const positionOf = (pitch: Pitch): number => writtenPosition(pitch.letter, pitch.octave);

/**
 * The note a voice sings: its degree of the key, plus the table's alteration.
 *
 * The collection is the key's own — major, or natural minor, which is also the
 * key signature — so the raised leading tone of a minor key is written as an
 * alteration of the seventh degree and comes out as B♮ in C minor, F𝄪 in G♯
 * minor, without a special case anywhere.
 */
function noteForVoice(collection: readonly SpelledNote[], voice: Voice): SpelledNote {
  const degree = collection[voice.degree - 1];
  // Unreachable: Degree is 1…7 and a diatonic collection has seven members.
  if (degree === undefined) throw new Error(`Unreachable: no degree ${String(voice.degree)}`);
  return { letter: degree.letter, alter: degree.alter + voice.alter };
}

/**
 * The bass note `steps` letters above the tonic, in the octave that puts it.
 *
 * Octave numbers change at C — a letter boundary — so counting letters from the
 * tonic gets the octave right for every spelling, including the C♭ that lives in
 * the octave above the B it sounds like.
 */
function bassPitch(
  collection: readonly SpelledNote[],
  tonic: SpelledNote,
  steps: number,
  alter: number,
): Pitch {
  const degree = collection[steps % LETTERS_PER_OCTAVE];
  // Unreachable: `steps` is 0…7 and the collection has seven members.
  if (degree === undefined) throw new Error(`Unreachable: no bass ${String(steps)} steps up`);
  return {
    letter: degree.letter,
    alter: degree.alter + alter,
    octave:
      BASS_OCTAVE + Math.floor((letterIndex(tonic.letter) + steps) / LETTERS_PER_OCTAVE),
  };
}

/**
 * The three upper voices as pitches, low to high, in the first position.
 *
 * `floor` is the top of the bass's octave, so the right hand always sits above
 * the whole of the left hand's line. Each voice is then placed at the next
 * written position of its own letter, which keeps the three strictly apart on
 * the stave.
 */
function placeUpperVoices(
  chord: RuleChord,
  collection: readonly SpelledNote[],
  floor: number,
): Pitch[] {
  let next = floor;
  return chord.upper.map((voice) => {
    const pitch = placeAtOrAbove(noteForVoice(collection, voice), next);
    next = positionOf(pitch) + 1;
    return pitch;
  });
}

/**
 * Turn a voicing over: the lowest voice moves above the highest.
 *
 * For the close-position trios the tables produce this is simply the bottom note
 * up an octave, which is what a keyboard player does; writing it as "above the
 * top" rather than "up an octave" is what makes it a rotation in general, and
 * keeps the three written positions strictly increasing whatever the spacing.
 */
function rotateUp(voicing: readonly Pitch[]): Pitch[] {
  const [lowest, ...rest] = voicing;
  const highest = rest[rest.length - 1];
  // Unreachable: every voicing here has exactly three voices.
  if (lowest === undefined || highest === undefined) {
    throw new Error('Unreachable: a voicing must have at least two voices');
  }
  return [...rest, placeAtOrAbove(lowest, positionOf(highest) + 1)];
}

/** An event with no curated fingering — which is every event of this exercise. */
function unfingered(pitches: readonly Pitch[]) {
  return { pitches, fingers: pitches.map(() => null) };
}

const MODE_NAME: Readonly<Record<'major' | 'minor', string>> = {
  major: 'Major',
  minor: 'Minor',
};

/**
 * Realise the rule: the bass as the left-hand part, three upper voices as the
 * right-hand part, ascending then descending, the upper tonic written once.
 * Both parts have the same number of events.
 *
 * Throws if the chosen table has an uncorroborated degree. That cannot happen
 * with the versions shipped today — the tests prove it — but a future version
 * with a genuine hole in its source must fail loudly here rather than quietly
 * produce a bar of invented harmony. `isRuleOfOctaveComplete` is the check to
 * make before offering such an exercise.
 */
export function realiseRuleOfOctave(exercise: RuleOfOctaveExercise): {
  readonly title: string;
  readonly fifths: number;
  readonly parts: readonly HandPart[];
} {
  const { tonic, mode, version, position } = exercise;

  const scaleType = collectionType(mode);
  const tonicNote = chooseTonicSpelling(tonic, scaleType);
  const collection = scaleDegrees(tonicNote, scaleType, 'ascending');

  const table = ruleOfOctaveTable(version, mode);
  const rows = rowsOf(table);

  // The right hand starts where the bass finishes, so the two never meet.
  const floor = writtenPosition(tonicNote.letter, BASS_OCTAVE + 1);

  const bass: Pitch[] = [];
  const upper: Pitch[][] = [];

  rows.forEach((row, index) => {
    if (row === null) {
      throw new Error(
        `No curated Rule of the Octave chord: ${version} ${mode}, slot ${String(index + 1)}`,
      );
    }
    // The ascending half walks up letter by letter and ends on the upper tonic;
    // the descending half walks back down from the seventh.
    const steps =
      index < table.ascending.length
        ? index
        : table.ascending.length - 2 - (index - table.ascending.length);

    bass.push(bassPitch(collection, tonicNote, steps, row.bassAlter));

    let voicing = placeUpperVoices(row, collection, floor);
    for (let turn = 1; turn < position; turn += 1) voicing = rotateUp(voicing);
    upper.push(voicing);
  });

  // Score order: the right hand on top, then the left, as everywhere else.
  const right: Hand = 'right';
  const left: Hand = 'left';
  const parts: readonly HandPart[] = [
    { hand: right, events: upper.map((voicing) => unfingered(voicing)) },
    { hand: left, events: bass.map((pitch) => unfingered([pitch])) },
  ];

  return {
    title: `${formatNote(tonicNote)} ${MODE_NAME[mode]} — Rule of the Octave`,
    fifths: keySignatureFifths(tonicNote, scaleType),
    parts,
  };
}
