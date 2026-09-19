import type {
  DirectionOption,
  MotionOption,
  PitchClass,
  RuleOfOctaveMode,
  RuleOfOctavePosition,
} from '../domain/types';
import type { Visibility } from './types';

/**
 * Display strings for the UI — the single source of truth so labels never
 * drift between settings panels, exercise summaries and anywhere else they're
 * shown.
 */

/** Sharp spelling first for the black keys: the app spells each scale
 * conventionally, so the chip label should make clear it covers both. */
export const KEY_LABELS: Readonly<Record<PitchClass, string>> = {
  0: 'C',
  1: 'C♯ / D♭',
  2: 'D',
  3: 'E♭ / D♯',
  4: 'E',
  5: 'F',
  6: 'F♯ / G♭',
  7: 'G',
  8: 'G♯ / A♭',
  9: 'A',
  10: 'B♭ / A♯',
  11: 'B',
};

export const MOTION_LABELS: Readonly<Record<MotionOption, string>> = {
  similar: 'Similar Motion',
  contrary: 'Contrary Motion',
};

export const DIRECTION_LABELS: Readonly<Record<DirectionOption, string>> = {
  ascending: 'Ascending',
  descending: 'Descending',
  both: 'Ascending & Descending',
};

/**
 * The Rule of the Octave's own axes. Version labels are not here: they belong to
 * the curated catalogue (`ROO_VERSIONS`), exactly as a scale type's name belongs
 * to `scaleTypes.ts` rather than to this file.
 */
export const ROO_MODE_LABELS: Readonly<Record<RuleOfOctaveMode, string>> = {
  major: 'Major',
  minor: 'Minor',
};

export const ROO_POSITION_LABELS: Readonly<Record<RuleOfOctavePosition, string>> = {
  1: 'First Position',
  2: 'Second Position',
  3: 'Third Position',
};

export const VISIBILITY_LABELS: Readonly<Record<Visibility, string>> = {
  always: 'Always',
  reveal: 'Reveal',
  hidden: 'Hidden',
};
