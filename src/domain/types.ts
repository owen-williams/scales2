/**
 * Core domain vocabulary.
 *
 * Everything in the application is expressed in terms of these types. They are
 * deliberately free of any UI, rendering or storage concerns.
 *
 * The three ideas that carry the most weight:
 *
 * 1. A pitch is a *spelled* thing (letter + alteration), never a bare semitone.
 *    Correct enharmonic spelling falls out of the representation rather than
 *    being patched on afterwards.
 * 2. A scale type is *data* (interval formulae + metadata), not code. Adding
 *    arpeggios, dominant sevenths or a new scale system means adding entries to
 *    a catalogue, not editing the engine.
 * 3. An exercise is a *discriminated union*. A scale and the Rule of the Octave
 *    have almost nothing in common but a tonic, so each kind carries only the
 *    parameters that mean something to it, and every consumer switches
 *    exhaustively on `kind` rather than reading fields that may not apply.
 */

// ---------------------------------------------------------------------------
// Pitch
// ---------------------------------------------------------------------------

/** The seven natural letter names, in ascending order from C. */
export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = (typeof LETTERS)[number];

/**
 * A spelled pitch.
 *
 * `alter` is in semitones: -2 = double flat, -1 = flat, 0 = natural,
 * 1 = sharp, 2 = double sharp.
 *
 * `octave` is scientific pitch notation, so middle C is `{ letter: 'C', alter: 0, octave: 4 }`.
 */
export interface Pitch {
  readonly letter: Letter;
  readonly alter: number;
  readonly octave: number;
}

/** A pitch class: 0 = C, 1 = C#/Db, … 11 = B. */
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/** A spelled pitch with no octave — used for tonics and scale degrees. */
export interface SpelledNote {
  readonly letter: Letter;
  readonly alter: number;
}

// ---------------------------------------------------------------------------
// Scale types
// ---------------------------------------------------------------------------

export const SCALE_FAMILY_IDS = [
  'major',
  'naturalMinor',
  'harmonicMinor',
  'melodicMinor',
  'chromatic',
] as const;
export type ScaleFamilyId = (typeof SCALE_FAMILY_IDS)[number];

export const MODE_IDS = [
  'ionian',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian',
] as const;
export type ModeId = (typeof MODE_IDS)[number];

/** Every scale the app can generate, whether the user selects it as a family or a mode. */
export type ScaleTypeId = ScaleFamilyId | ModeId;

/**
 * How a scale's notes are spelled.
 *
 * - `diatonic`: one note per letter name, so degree *n* always uses the letter
 *   *n* steps above the tonic. This produces textbook spellings, including the
 *   double sharps that genuinely belong (G# harmonic minor's F double sharp).
 * - `chromatic`: twelve notes to the octave, so letters must repeat. Spelling
 *   follows the conventional sharps-ascending / flats-descending rule.
 */
export type SpellingStrategy = 'diatonic' | 'chromatic';

/**
 * A scale type: the definition of a scale, independent of any particular key.
 *
 * Formulae are semitone offsets from the tonic, ascending, *excluding* the
 * octave. The octave is implied and added by the generator.
 */
export interface ScaleType {
  readonly id: ScaleTypeId;
  /** Display name, e.g. "Harmonic Minor". */
  readonly name: string;
  /** Which settings group the user selects this from. */
  readonly category: 'family' | 'mode';
  readonly spelling: SpellingStrategy;
  /** Semitone offsets from the tonic, ascending. */
  readonly ascendingFormula: readonly number[];
  /**
   * Semitone offsets from the tonic for the descending form, written ascending.
   * Identical to `ascendingFormula` for every scale except melodic minor.
   */
  readonly descendingFormula: readonly number[];
  /**
   * The diatonic collection used to *choose the tonic's spelling* — i.e. the
   * underlying key signature. Harmonic and melodic minor score against natural
   * minor, so that E-flat minor is preferred over D-sharp minor for its key
   * signature rather than for its raised seventh.
   */
  readonly signatureFormula: readonly number[];
  /**
   * Which curated fingering set this scale uses. Scales that share a physical
   * key layout share fingerings (Ionian is Major; Aeolian is Natural Minor).
   * `null` means no curated fingering exists and none must be invented.
   */
  readonly fingeringSet: FingeringSetId | null;
}

/** Named collections of curated fingerings. */
export type FingeringSetId = 'major' | 'minor' | 'chromatic';

// ---------------------------------------------------------------------------
// Exercise parameters
// ---------------------------------------------------------------------------

export const MOTION_OPTIONS = ['similar', 'contrary'] as const;
export type MotionOption = (typeof MOTION_OPTIONS)[number];

export const OCTAVE_OPTIONS = [1, 2, 3, 4] as const;
export type OctaveCount = (typeof OCTAVE_OPTIONS)[number];

export const DIRECTION_OPTIONS = ['ascending', 'descending', 'both'] as const;
export type DirectionOption = (typeof DIRECTION_OPTIONS)[number];

/**
 * A scale: the app's original exercise, and the complete random draw for it.
 *
 * Every exercise is played hands together, so there is no hands axis: what the
 * user chooses is which scale, how the two hands move against each other, how
 * far, and which way.
 */
export interface ScaleExercise {
  readonly kind: 'scale';
  readonly tonic: PitchClass;
  readonly scaleTypeId: ScaleTypeId;
  readonly motion: MotionOption;
  readonly octaves: OctaveCount;
  readonly direction: DirectionOption;
}

/**
 * The harmonisations of the Rule of the Octave the app offers. Both are
 * historical conventions with named sources, so this is a closed list of
 * curated data rather than a setting with an open range.
 */
export const ROO_VERSION_IDS = ['fenaroli', 'campion'] as const;
export type RuleOfOctaveVersionId = (typeof ROO_VERSION_IDS)[number];

export const ROO_POSITIONS = [1, 2, 3] as const;
/** Which chord tone of the opening chord the top voice takes: 1 = octave, 2 = third, 3 = fifth. */
export type RuleOfOctavePosition = (typeof ROO_POSITIONS)[number];

/**
 * The two modes the rule is curated in, in canonical order.
 *
 * The same list as the `mode` field of a `RuleOfOctaveExercise`, written out so
 * that the settings layer can enumerate, order and validate it the way it does
 * every other axis.
 */
export const ROO_MODES = ['major', 'minor'] as const;
export type RuleOfOctaveMode = (typeof ROO_MODES)[number];

/**
 * The Rule of the Octave: the thoroughbass convention that assigns a chord to
 * every degree of the ascending and descending scale in the bass.
 *
 * It shares only the tonic with a scale. Motion, octaves and direction mean
 * nothing here — the rule is always one octave up and back down, hands playing
 * different music — which is exactly why `Exercise` is a union rather than a
 * scale with unused fields.
 */
export interface RuleOfOctaveExercise {
  readonly kind: 'ruleOfOctave';
  /** Major or minor: the rule is a different harmonisation in each. */
  readonly mode: 'major' | 'minor';
  readonly tonic: PitchClass;
  readonly version: RuleOfOctaveVersionId;
  readonly position: RuleOfOctavePosition;
}

/**
 * A single practice exercise: the complete random draw, of whichever kind.
 *
 * This is a plain value — everything needed to render it is derived, never
 * stored, so an exercise can be compared, logged or recreated trivially.
 */
export type Exercise = ScaleExercise | RuleOfOctaveExercise;

/**
 * The compiler's proof that a `switch` covered every member of a union.
 *
 * Passing the fallthrough case here makes adding a third exercise kind a
 * compile error at every site that has to say something about each kind, rather
 * than a silent default. The throw exists only so the call can stand where a
 * value is expected; by the time it could run, the code has already failed to
 * compile.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}

// ---------------------------------------------------------------------------
// Realised (rendered) exercise
// ---------------------------------------------------------------------------

/**
 * Which hand plays a part. Not something the user chooses — every exercise is
 * hands together — but parts, clefs and fingerings all have to say which hand
 * they belong to.
 */
export type Hand = 'right' | 'left';

/**
 * One rhythmic slot of an exercise: a single note in a scale, a chord in the
 * Rule of the Octave.
 */
export interface ExerciseEvent {
  /** Sounding together. One pitch for a scale note; three or four for a chord. */
  readonly pitches: readonly Pitch[];
  /**
   * Curated fingering, one entry per pitch and the same length as `pitches`.
   * `null` where no curated fingering covers this note.
   */
  readonly fingers: readonly (number | null)[];
}

/** The events one hand plays, in performance order. */
export interface HandPart {
  readonly hand: Hand;
  readonly events: readonly ExerciseEvent[];
}

/**
 * How long one event lasts.
 *
 * A property of the exercise rather than of the notation, because it is a
 * pedagogical choice: a scale runs in eighths, while the Rule of the Octave is
 * read vertically — four notes to think about at once — and is practised
 * slower.
 */
export type NoteType = 'eighth' | 'quarter' | 'whole';

/**
 * An exercise resolved into actual notes: the bridge between the domain model
 * and the renderer.
 */
export interface RealisedExercise {
  readonly exercise: Exercise;
  /** Absent for exercises that are not scales. */
  readonly scaleType?: ScaleType;
  /**
   * The tonic as spelled for this scale, e.g. E-flat rather than D-sharp.
   * Absent for exercises that are not scales.
   */
  readonly tonicNote?: SpelledNote;
  /** What the exercise is called: "E♭ Harmonic Minor", "C Minor — Rule of the Octave". */
  readonly title: string;
  /** Parts in score order: always exactly two, the right hand then the left. */
  readonly parts: readonly HandPart[];
  /** Key signature for notation, in fifths (-7…7). Zero for chromatic. */
  readonly fifths: number;
  /**
   * True when curated fingering data covers every part of this exercise. False
   * means the UI should say so rather than display invented numbers.
   */
  readonly hasFingering: boolean;
  readonly noteType: NoteType;
  /**
   * Event indices where the engraver should start a new line, if it can.
   *
   * A request rather than an instruction: a break only happens where the index
   * falls on a barline, since a system cannot start mid-bar. The Rule of the
   * Octave uses it to put its ascending and descending halves on separate
   * lines, which is how the rule is read — up the scale, then back down.
   */
  readonly systemBreaks?: readonly number[];
}
