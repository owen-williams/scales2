/**
 * Realisation: from an abstract exercise to actual spelled notes with fingering.
 *
 * `Exercise` is a handful of parameters; `RealisedExercise` is the music those
 * parameters describe. Everything downstream — notation, the fingering readout,
 * the accessible description — reads the realised form, so this module is the
 * single place where "2 octaves, contrary, ascending" turns into pitches.
 *
 * Each kind of exercise has its own realiser and they share nothing but the
 * shape they produce. Scales are built here; the Rule of the Octave is curated
 * data of its own and is built by `./ruleOfOctave`, which this module only
 * dispatches to.
 *
 * Three decisions carry the scale realiser:
 *
 * 1. **Octave placement is a lookup, not a calculation.** Where a scale sits on
 *    the keyboard is a pedagogical convention (a two-octave scale starts at
 *    middle C; a four-octave one starts an octave lower so it fits), so it is
 *    written out as a table rather than derived.
 *
 * 2. **Every hand is described as a range plus a leading direction.** A hand
 *    occupies a fixed span of keyboard and traverses it up-first or down-first;
 *    `direction: 'both'` is simply both traversals with the turning note shared.
 *    Contrary motion then needs no special-casing beyond giving the left hand a
 *    different range and the opposite leading direction.
 *
 * 3. **Fingering is only ever asked for ascending.** The curated catalogue is
 *    defined on ascending runs, so a descending leg reuses the ascending fingers
 *    read backwards. Asking the fingering module about a descending pitch list
 *    would invite it to grow a second, redundant set of rules.
 */

import { formatNote } from './pitch';
import { buildRun, chooseTonicSpelling, keySignatureFifths, scaleName } from './scale';
import { getScaleType } from './scaleTypes';
import { fingersForAscendingRun, hasFingering as setCoversHand } from './fingering';
import {
  ASCENDING_BASS_DEGREES,
  distinctVersionsFor,
  realiseRuleOfOctave,
} from './ruleOfOctave';
import { assertNever, ROO_VERSION_IDS } from './types';
import type {
  DirectionOption,
  Exercise,
  ExerciseEvent,
  Hand,
  HandPart,
  MotionOption,
  RealisedExercise,
  RuleOfOctaveExercise,
  RuleOfOctaveMode,
  RuleOfOctavePosition,
  RuleOfOctaveVersionId,
  ScaleExercise,
  ScaleType,
  SpelledNote,
} from './types';

/**
 * Which way a leg of a run travels. `'up'` and `'down'` are physical directions
 * on the keyboard, deliberately distinct from the exercise's `DirectionOption`,
 * because in contrary motion the two hands travel opposite ways within a single
 * `direction: 'ascending'` exercise.
 */
type Leg = 'up' | 'down';

/**
 * Where each hand's *lowest* tonic sits, by exercise.
 *
 * Similar motion keeps the hands an octave apart with the right hand on middle
 * C, and drops both an octave for the longer scales so that the music sits
 * centred on the keyboard rather than climbing out of it. The hand that would
 * actually run out is the *right* — it is the higher of the two — and only at
 * four octaves, where an undropped right hand would reach B8. Three octaves is
 * dropped for balance, not necessity.
 *
 * Contrary motion instead starts both hands on the *same* pitch — that is what
 * makes it contrary motion — so the left hand's range extends downwards from
 * the shared note, and its lowest tonic is `4 - octaves`.
 */
function lowestTonicOctaves(octaves: number, contrary: boolean): Readonly<Record<Hand, number>> {
  if (contrary) return { right: 4, left: 4 - octaves };
  return octaves <= 2 ? { right: 4, left: 3 } : { right: 3, left: 2 };
}

/** The leg a hand sets off on. Only `'descending'` starts at the top. */
function leadingLeg(direction: DirectionOption): Leg {
  return direction === 'descending' ? 'down' : 'up';
}

const opposite = (leg: Leg): Leg => (leg === 'up' ? 'down' : 'up');

/**
 * One hand's part: its pitches in performance order, each carrying its finger.
 *
 * The ascending run is built regardless of which way the hand actually travels,
 * because it is what the fingering catalogue is defined against; the descending
 * run and its fingers are that same material reversed. For melodic minor and
 * chromatic scales the descending *pitches* genuinely differ (raised sixths and
 * sevenths vanish; sharps become flats), which is why they come from `buildRun`
 * rather than from reversing the ascending pitches — but the *fingers* are
 * positional, so reversing them is exactly right.
 */
function buildPart(params: {
  hand: Hand;
  exercise: ScaleExercise;
  scaleType: ScaleType;
  tonicNote: SpelledNote;
  startOctave: number;
  lead: Leg;
}): HandPart {
  const { hand, exercise, scaleType, tonicNote, startOctave, lead } = params;
  const { octaves, direction } = exercise;

  const shared = { tonic: tonicNote, scaleType, octaves, startOctave };
  const ascending = buildRun({ ...shared, direction: 'up' });
  const descending = buildRun({ ...shared, direction: 'down' });

  const ascendingFingers = fingersForAscendingRun({
    setId: scaleType.fingeringSet,
    tonic: exercise.tonic,
    hand,
    noteCount: ascending.length,
    pitches: ascending,
  });
  const descendingFingers = [...ascendingFingers].reverse();

  const first = lead === 'up' ? ascending : descending;
  const second = lead === 'up' ? descending : ascending;
  const firstFingers = lead === 'up' ? ascendingFingers : descendingFingers;
  const secondFingers = lead === 'up' ? descendingFingers : ascendingFingers;

  // `direction: 'both'` turns round on the extreme note, which belongs to both
  // legs — it is played once, so the return leg drops its first entry.
  const pitches = direction === 'both' ? [...first, ...second.slice(1)] : first;
  const fingers = direction === 'both' ? [...firstFingers, ...secondFingers.slice(1)] : firstFingers;

  // One pitch to an event: a scale is a single line, and the chordal exercises
  // are what the event's plural pitches exist for.
  const events: ExerciseEvent[] = pitches.map((pitch, index) => ({
    pitches: [pitch],
    fingers: [fingers[index] ?? null],
  }));

  return { hand, events };
}

/** The hands in score order, right hand on top. Every exercise sounds both. */
const SCORE_ORDER: readonly Hand[] = ['right', 'left'];

/**
 * A scale resolved into notes.
 *
 * Always two parts, right hand then left: every exercise is played hands
 * together, which is also what makes the motion parameter meaningful — the two
 * hands either move alike or move apart.
 */
function realiseScale(e: ScaleExercise): RealisedExercise {
  const scaleType = getScaleType(e.scaleTypeId);
  const tonicNote = chooseTonicSpelling(e.tonic, scaleType);

  const contrary = e.motion === 'contrary';
  const startOctaves = lowestTonicOctaves(e.octaves, contrary);
  const lead = leadingLeg(e.direction);

  const parts = SCORE_ORDER.map((hand) =>
    buildPart({
      hand,
      exercise: e,
      scaleType,
      tonicNote,
      startOctave: startOctaves[hand],
      // In contrary motion the left hand mirrors the right: where one ascends
      // the other descends, so it leads with the opposite leg.
      lead: contrary && hand === 'left' ? opposite(lead) : lead,
    }),
  );

  const setId = scaleType.fingeringSet;

  return {
    exercise: e,
    scaleType,
    tonicNote,
    title: scaleName(tonicNote, scaleType),
    parts,
    fifths: keySignatureFifths(tonicNote, scaleType),
    // A scale type with no fingering set has no fingering at all; beyond that,
    // ask the catalogue, so a key it deliberately omits also reports false
    // rather than silently rendering a run of blanks.
    hasFingering: setId !== null && parts.every((part) => setCoversHand(setId, e.tonic, part.hand)),
    noteType: 'eighth',
  };
}

const ROO_MODE_TEXT: Readonly<Record<RuleOfOctaveMode, string>> = {
  major: 'Major',
  minor: 'Minor',
};

/**
 * What the exercise is called: the key, and nothing more — "C Minor".
 *
 * A scale's title is its name and its descriptors say everything else, so the
 * rule's title is its key and "Rule of the Octave" is the first descriptor. The
 * curated module names its own output more fully, for its tests and for anyone
 * reading the catalogue directly; what the screen shows is decided here, where
 * every other title is minted, rather than inside the historical data.
 *
 * The spelling comes from the same call the curated module makes —
 * `chooseTonicSpelling` against the key's own collection — so the title can
 * never name a different key from the one in the key signature: E♭ Minor, not
 * D♯ Minor.
 */
function ruleOfOctaveTitle(e: RuleOfOctaveExercise): string {
  const scaleType = getScaleType(e.mode === 'major' ? 'major' : 'naturalMinor');
  return `${formatNote(chooseTonicSpelling(e.tonic, scaleType))} ${ROO_MODE_TEXT[e.mode]}`;
}

/**
 * The Rule of the Octave resolved into notes.
 *
 * The music itself is curated data and comes from `./ruleOfOctave`; all this
 * adds is the pair of judgements that belong to the exercise rather than to the
 * harmonisation — that chords are read at a quarter note apiece, and that they
 * carry no fingering, because fingerings for chords are not standard curated
 * data and must not be invented.
 */
function realiseRuleOfOctaveExercise(e: RuleOfOctaveExercise): RealisedExercise {
  const { fifths, parts } = realiseRuleOfOctave(e);

  return {
    exercise: e,
    title: ruleOfOctaveTitle(e),
    parts,
    fifths,
    hasFingering: false,
    noteType: 'whole',
    // Up the scale on one line, back down on the next, evenly spaced across
    // both so the two halves match.
    systemBreaks: [ASCENDING_BASS_DEGREES.length],
    evenMeasures: true,
  };
}

/**
 * An exercise of any kind resolved into notes.
 *
 * The exhaustive switch is the point: a third kind of exercise is a compile
 * error here rather than a scale realised by accident.
 */
export function realiseExercise(e: Exercise): RealisedExercise {
  switch (e.kind) {
    case 'scale':
      return realiseScale(e);
    case 'ruleOfOctave':
      return realiseRuleOfOctaveExercise(e);
    default:
      return assertNever(e);
  }
}

/*
 * Display strings live here rather than in `src/settings/labels.ts` on purpose.
 * The domain must not depend on the settings layer: an exercise can describe
 * itself without knowing that a settings screen exists. The duplication is a
 * few short lists of fixed musical terms that will not drift.
 */

const MOTION_TEXT: Readonly<Record<MotionOption, string>> = {
  similar: 'Similar Motion',
  contrary: 'Contrary Motion',
};

const DIRECTION_TEXT: Readonly<Record<DirectionOption, string>> = {
  ascending: 'Ascending',
  descending: 'Descending',
  both: 'Ascending & Descending',
};

/**
 * Version labels are held here, rather than read from the Rule of the Octave's
 * own registry, so that what the headline says is fixed by the domain and not
 * by curated data that may grow a longer, sourced description of itself.
 */
const ROO_VERSION_TEXT: Readonly<Record<RuleOfOctaveVersionId, string>> = {
  fenaroli: 'Fenaroli',
  campion: 'Campion',
};

const ROO_POSITION_TEXT: Readonly<Record<RuleOfOctavePosition, string>> = {
  1: 'First Position',
  2: 'Second Position',
  3: 'Third Position',
};

/**
 * Whether naming the version tells the reader anything about the notes.
 *
 * Campion's rule and Fenaroli's are the same harmonisation in major, so a major
 * exercise labelled "Fenaroli" would be claiming a distinction the stave does
 * not contain — a small lie, and the kind this app is built to avoid. In minor
 * they part company at the descending sixth degree, and there the name is worth
 * printing.
 *
 * The question is asked of every shipped version rather than of the user's
 * selection, because a descriptor describes the exercise, not the settings that
 * happened to draw it. Add a version that differs in major and the major
 * exercises start naming themselves, with no change here.
 */
function versionsDifferIn(mode: RuleOfOctaveMode): boolean {
  return distinctVersionsFor(mode, ROO_VERSION_IDS).length > 1;
}

/**
 * The exercise as display lines, e.g.
 * `["Both Hands", "Contrary Motion", "2 Octaves", "Ascending & Descending"]`,
 * `["Rule of the Octave", "Fenaroli", "Second Position"]` in minor or
 * `["Rule of the Octave", "Second Position"]` in major.
 *
 * Every line says something the title does not. For a scale that is how the
 * hands move and how far; for the Rule of the Octave it is which harmonisation
 * and which voicing — there being nothing to say about hands, octaves or
 * direction, all of which the rule fixes.
 */
export function describeExercise(e: Exercise): string[] {
  switch (e.kind) {
    case 'scale':
      return [
        'Both Hands',
        MOTION_TEXT[e.motion],
        e.octaves === 1 ? '1 Octave' : `${String(e.octaves)} Octaves`,
        DIRECTION_TEXT[e.direction],
      ];
    case 'ruleOfOctave':
      return versionsDifferIn(e.mode)
        ? ['Rule of the Octave', ROO_VERSION_TEXT[e.version], ROO_POSITION_TEXT[e.position]]
        : ['Rule of the Octave', ROO_POSITION_TEXT[e.position]];
    default:
      return assertNever(e);
  }
}
