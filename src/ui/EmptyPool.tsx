import { eligibleExercises } from '../domain/exercise';
import type { Settings } from '../settings/types';

/**
 * Why the current settings produce no exercises at all.
 *
 * Returned as plain sentences so both the practice screen and the settings
 * dialog can say the same thing, in the place the user is looking.
 *
 * The pool is two halves — scales and the Rule of the Octave — and it is empty
 * only when *both* are, which is why the enumeration itself is the first
 * question asked. Without that guard "No motion is selected" would be reported
 * to someone happily drawing the rule, for whom motion means nothing.
 *
 * Each half then empties in its own way:
 *
 * - **Scales**: no keys, no families *and* no modes, no motion, no octave
 *   count, no direction, or the single combination the rules reject — contrary
 *   motion beyond two octaves, which runs off the ends of the keyboard.
 * - **The rule**: no keys, no version (which is how it is switched off), no
 *   mode, or no position.
 *
 * "No keys" empties both at once and is listed once. The rule's own axes are
 * reported only while it is switched on: a pool emptied by the scales while the
 * rule is simply off is fully explained by the scale lines, and "no version is
 * selected" would be describing the default rather than a mistake.
 *
 * Between them these cover every empty pool the settings can reach, and every
 * one of them is reachable.
 */
export function describePoolConflicts(settings: Settings): string[] {
  const reasons: string[] = [];
  if (eligibleExercises(settings).length > 0) return reasons;

  if (settings.keys.length === 0) reasons.push('No keys are selected.');

  // The scales.
  if (settings.families.length === 0 && settings.modes.length === 0) {
    reasons.push('No scale families or modes are selected.');
  }
  if (settings.motions.length === 0) reasons.push('No motion is selected.');
  if (settings.octaves.length === 0) reasons.push('No octave count is selected.');
  if (settings.directions.length === 0) reasons.push('No direction is selected.');

  const onlyContrary =
    settings.motions.length > 0 && settings.motions.every((motion) => motion === 'contrary');

  if (onlyContrary && settings.octaves.length > 0 && settings.octaves.every((n) => n > 2)) {
    reasons.push(
      'Contrary motion only goes up to 2 octaves. Add 1 or 2 octaves, or add similar motion.',
    );
  }

  // The Rule of the Octave, only once it is switched on.
  if (settings.rooVersions.length > 0) {
    if (settings.rooModes.length === 0) {
      reasons.push('No mode is selected for the Rule of the Octave.');
    }
    if (settings.rooPositions.length === 0) {
      reasons.push('No position is selected for the Rule of the Octave.');
    }
  }

  return reasons;
}

export interface EmptyPoolProps {
  reasons: readonly string[];
  onOpenSettings: () => void;
}

export function EmptyPool({ reasons, onOpenSettings }: EmptyPoolProps) {
  return (
    <div className="empty">
      <h1 className="empty__title">Nothing to practise</h1>
      <p className="empty__body">
        The current settings don’t describe any exercise, so there is nothing to draw.
      </p>
      {reasons.length > 0 ? (
        <ul className="empty__reasons">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="button button--primary" onClick={onOpenSettings}>
        Open settings
      </button>
    </div>
  );
}
