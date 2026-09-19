import type {
  DirectionOption,
  ModeId,
  MotionOption,
  OctaveCount,
  PitchClass,
  RuleOfOctavePosition,
  RuleOfOctaveVersionId,
  ScaleFamilyId,
} from '../domain/types';

/**
 * How a panel behaves for each exercise.
 *
 * - `always`  — shown as soon as the exercise appears
 * - `reveal`  — hidden until the user asks; resets with every new exercise
 * - `hidden`  — never shown
 */
export const VISIBILITY_OPTIONS = ['always', 'reveal', 'hidden'] as const;
export type Visibility = (typeof VISIBILITY_OPTIONS)[number];

/**
 * Everything the user can configure. Persisted verbatim to localStorage.
 *
 * The enabled-* sets define the pool of eligible exercises; the generator draws
 * uniformly from every valid combination of them.
 *
 * The `roo*` lists describe the Rule of the Octave, the app's second kind of
 * exercise. They have no `keys` of their own: a key is a key, and the rule is
 * drawn in whichever keys the scales are. `rooVersions` doubles as the on/off
 * switch — no version selected means no Rule of the Octave in the pool — which
 * is why it is the one list allowed to be empty without falling back.
 */
export interface Settings {
  readonly keys: readonly PitchClass[];
  readonly families: readonly ScaleFamilyId[];
  readonly modes: readonly ModeId[];
  readonly motions: readonly MotionOption[];
  readonly octaves: readonly OctaveCount[];
  readonly directions: readonly DirectionOption[];
  /** Empty = the Rule of the Octave is switched off. */
  readonly rooVersions: readonly RuleOfOctaveVersionId[];
  readonly rooModes: readonly ('major' | 'minor')[];
  readonly rooPositions: readonly RuleOfOctavePosition[];
  readonly notation: Visibility;
  readonly fingering: Visibility;
}
