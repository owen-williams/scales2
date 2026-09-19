/**
 * Exercise generation: from the user's settings to a single random exercise.
 *
 * An exercise is a plain value — a point in the cross-product of everything the
 * settings enable. Rather than sampling each axis independently and hoping the
 * result is coherent, this module *enumerates* the whole pool and draws one
 * entry uniformly. Enumeration costs a few milliseconds even at its largest
 * (twelve keys × twelve scale types × every other axis is a couple of thousand
 * entries) and buys two things worth far more than that: the draw is genuinely
 * uniform over legal exercises, and "how many exercises can I get?" becomes a
 * question with an exact answer rather than an estimate.
 *
 * The draw is deliberately memoryless. No repeat avoidance, no weighting, no
 * history: a practice app that quietly steers away from repeats is lying about
 * randomness, and a student who draws C major twice running should see that.
 */

import { distinctVersionsFor, isRuleOfOctaveComplete } from './ruleOfOctave';
import { assertNever, MODE_IDS, SCALE_FAMILY_IDS } from './types';
import type { Exercise, RuleOfOctaveExercise, ScaleExercise, ScaleTypeId } from './types';
import type { Settings } from '../settings/types';

/**
 * Whether a combination of parameters describes a playable exercise.
 *
 * Exactly one rule: contrary motion is capped at two octaves, because that is
 * how it is conventionally practised. It is *not* a keyboard limit, despite the
 * hands diverging — three octaves each way spans C1 to B7 and fits an 88-note
 * piano comfortably. Only four would run off the ends.
 *
 * Everything else combines freely — and the Rule of the Octave has no axis that
 * can conflict with another, since it is always one octave, hands together.
 */
export function isValidExercise(e: Exercise): boolean {
  switch (e.kind) {
    case 'scale':
      return !(e.motion === 'contrary' && e.octaves > 2);
    case 'ruleOfOctave':
      return true;
    default:
      return assertNever(e);
  }
}

/**
 * The scale types the settings enable, in canonical catalogue order.
 *
 * Families come before modes, and each group keeps the order of its id list, so
 * the pool's order depends only on *which* settings are enabled and never on
 * the order the user happened to tick them in.
 */
function enabledScaleTypeIds(settings: Settings): ScaleTypeId[] {
  const families: ScaleTypeId[] = SCALE_FAMILY_IDS.filter((id) => settings.families.includes(id));
  const modes: ScaleTypeId[] = MODE_IDS.filter((id) => settings.modes.includes(id));
  return [...families, ...modes];
}

/**
 * Every valid scale the settings allow, in a deterministic order.
 *
 * The nesting order is keys → scale types → motions → octaves → directions.
 * Nothing depends on that order — the draw is uniform, so any order would do —
 * but fixing it makes the pool reproducible, which is what lets the tests
 * assert on indices and lets a seeded rng replay a session.
 */
function eligibleScales(settings: Settings): ScaleExercise[] {
  const scaleTypeIds = enabledScaleTypeIds(settings);
  const pool: ScaleExercise[] = [];

  for (const tonic of settings.keys) {
    for (const scaleTypeId of scaleTypeIds) {
      for (const motion of settings.motions) {
        for (const octaves of settings.octaves) {
          for (const direction of settings.directions) {
            const exercise: ScaleExercise = {
              kind: 'scale',
              tonic,
              scaleTypeId,
              motion,
              octaves,
              direction,
            };
            if (isValidExercise(exercise)) pool.push(exercise);
          }
        }
      }
    }
  }

  return pool;
}

/**
 * Every Rule of the Octave the settings allow, in a deterministic order.
 *
 * The nesting order is keys → modes → versions → positions, and there is no
 * key list of its own: the rule is drawn in whatever keys the user has ticked
 * for the scales, because a key is a key.
 *
 * The versions are filtered through `distinctVersionsFor`, which is the whole
 * subtlety of this function. Campion's rule and Fenaroli's are the same
 * harmonisation in major and differ at one chord in minor, so enumerating both
 * in major would enter every major exercise twice and quietly bias a uniform
 * draw towards major. What the pool contains is *distinct music*, and the two
 * names are one exercise wherever the tables agree.
 */
function eligibleRuleOfOctave(settings: Settings): RuleOfOctaveExercise[] {
  const pool: RuleOfOctaveExercise[] = [];

  // Which versions survive is a property of the mode, not of the key, so the
  // tables are compared twice rather than once per key.
  //
  // A version whose table has an uncorroborated degree is dropped here rather
  // than offered and then thrown on. `RuleRow` is nullable precisely so that a
  // future curator can leave an honest hole instead of inventing a chord, and
  // this is what makes that safe: the exercise simply never appears.
  const versionsByMode = new Map(
    settings.rooModes.map((mode) => [
      mode,
      distinctVersionsFor(mode, settings.rooVersions).filter((version) =>
        isRuleOfOctaveComplete(version, mode),
      ),
    ]),
  );

  for (const tonic of settings.keys) {
    for (const mode of settings.rooModes) {
      for (const version of versionsByMode.get(mode) ?? []) {
        for (const position of settings.rooPositions) {
          const exercise: RuleOfOctaveExercise = {
            kind: 'ruleOfOctave',
            mode,
            tonic,
            version,
            position,
          };
          if (isValidExercise(exercise)) pool.push(exercise);
        }
      }
    }
  }

  return pool;
}

/**
 * Every valid exercise the settings allow, in a deterministic order: one kind
 * of exercise after another, each enumerated by its own rules.
 *
 * The two halves are simply concatenated, and the draw stays uniform over the
 * whole. There is no dice for "scale or rule" and no weighting: a user who
 * enables the rule and leaves every scale family on will mostly get scales,
 * which is exactly what the pool says — 108 rule exercises at most, against as
 * many as 2,592 scales. Turning scale families off is how you practise the rule.
 *
 * Built fresh on every call: the pool is a pure function of the settings, and
 * the settings change whenever the user touches a checkbox, so a global cache
 * would be a stale-data bug waiting to happen.
 */
export function eligibleExercises(settings: Settings): Exercise[] {
  return [...eligibleScales(settings), ...eligibleRuleOfOctave(settings)];
}

/**
 * One exercise drawn uniformly from everything the settings allow, or `null`
 * when the settings allow nothing at all (a list left empty, or only contrary
 * motion at more than two octaves).
 *
 * `rng` is injectable purely so tests can pin the outcome; production always
 * uses `Math.random`. The index is clamped because `Math.random` is specified to
 * return values in [0, 1) but an injected generator — or a floating-point
 * rounding edge in a user-supplied one — can hand back exactly 1, and reading
 * one past the end would silently produce `undefined`.
 */
export function randomExercise(settings: Settings, rng: () => number = Math.random): Exercise | null {
  const pool = eligibleExercises(settings);
  if (pool.length === 0) return null;

  const raw = Math.floor(rng() * pool.length);
  const index = Math.min(Math.max(raw, 0), pool.length - 1);
  return pool[index] ?? null;
}

/**
 * A stable identity string for an exercise, e.g.
 * `"scale:3:harmonicMinor:similar:2:both"` or `"ruleOfOctave:0:minor:fenaroli:2"`.
 *
 * Exercises are compared by value, and structural equality is awkward in
 * JavaScript, so this gives them a key usable in a `Set`, a `Map` or a React
 * `key`. Every field is included and the kind leads, which makes the key a
 * bijection with the exercise: distinct exercises can never collide, not even
 * across kinds.
 */
export function exerciseKey(e: Exercise): string {
  switch (e.kind) {
    case 'scale':
      return [e.kind, e.tonic, e.scaleTypeId, e.motion, e.octaves, e.direction].join(':');
    case 'ruleOfOctave':
      return [e.kind, e.tonic, e.mode, e.version, e.position].join(':');
    default:
      return assertNever(e);
  }
}
