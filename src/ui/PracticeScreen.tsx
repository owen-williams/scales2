import { useId, useMemo } from 'react';
import { describeExercise } from '../domain/realise';
import type { RealisedExercise } from '../domain/types';
import type { Visibility } from '../settings/types';
import { EmptyPool } from './EmptyPool';
import { ExerciseHeadline } from './ExerciseHeadline';
import { NotationPanel } from './NotationPanel';

export interface PracticeScreenProps {
  realised: RealisedExercise | null;
  poolSize: number;
  notationVisible: boolean;
  fingeringVisible: boolean;
  notationPreference: Visibility;
  fingeringPreference: Visibility;
  /** Why the pool is empty, if it is. */
  poolConflicts: readonly string[];
  onNext: () => void;
  onToggleNotation: () => void;
  onToggleFingering: () => void;
  onOpenSettings: () => void;
}

/**
 * Whether to offer a Show/Hide button for a panel.
 *
 * `reveal` always offers one. The other two normally offer none — but the
 * keyboard shortcut overrides the preference for the current exercise either
 * way, and whenever it has, there must be a visible way back. Without this,
 * pressing N under `always` hid the notation *and* the button that would bring
 * it back, stranding the user until the next exercise.
 */
function showsRevealButton(preference: Visibility, visible: boolean): boolean {
  if (preference === 'reveal') return true;
  return visible !== (preference === 'always');
}

export function PracticeScreen(props: PracticeScreenProps) {
  const {
    realised,
    poolSize,
    notationVisible,
    fingeringVisible,
    notationPreference,
    fingeringPreference,
    poolConflicts,
    onNext,
    onToggleNotation,
    onToggleFingering,
    onOpenSettings,
  } = props;

  const id = useId();
  const exercise = realised?.exercise ?? null;
  const descriptors = useMemo(
    () => (exercise === null ? [] : describeExercise(exercise)),
    [exercise],
  );

  if (poolSize === 0 || realised === null) {
    return <EmptyPool reasons={poolConflicts} onOpenSettings={onOpenSettings} />;
  }

  const notationButton = showsRevealButton(notationPreference, notationVisible);
  // Fingerings are engraved on the score itself, so a control for them only
  // means anything while the score is on screen and the catalogue covers it.
  const showsFingeringControl =
    showsRevealButton(fingeringPreference, fingeringVisible) &&
    notationVisible &&
    realised.hasFingering;

  return (
    <div className="practice">
      <ExerciseHeadline title={realised.title} descriptors={descriptors} />

      <div className="practice__panels">
        {notationVisible || notationButton ? (
          <section
            className={`panel panel--notation${notationVisible ? ' panel--open' : ''}`}
            aria-label="Notation"
          >
            {notationButton || showsFingeringControl ? (
              <div className="panel__head">
                {notationButton ? (
                  <button
                    type="button"
                    className="reveal"
                    onClick={onToggleNotation}
                    aria-expanded={notationVisible}
                    aria-controls={`${id}-notation`}
                  >
                    {notationVisible ? 'Hide notation' : 'Show notation'}
                  </button>
                ) : null}
                {showsFingeringControl ? (
                  // A pressed-state toggle, not an expander: this does not show
                  // or hide the region it sits above, it changes whether the
                  // score inside it is engraved with finger numbers. Saying
                  // `aria-expanded` here announced the score as collapsed while
                  // it was plainly on screen.
                  <button
                    type="button"
                    className="reveal"
                    onClick={onToggleFingering}
                    aria-pressed={fingeringVisible}
                  >
                    {fingeringVisible ? 'Hide fingering' : 'Show fingering'}
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="panel__body panel__body--notation" id={`${id}-notation`}>
              {notationVisible ? (
                <NotationPanel
                  realised={realised}
                  descriptors={descriptors}
                  showFingerings={fingeringVisible && realised.hasFingering}
                />
              ) : null}
            </div>
            {/* Only for the *scales* the catalogue does not cover, and worth
                saying there: without it the missing numbers look like a bug.
                The Rule of the Octave is not a scale and never carries
                fingering — chord fingerings are not standard curated data —
                so for it there is no absence to explain. */}
            {notationVisible &&
            fingeringVisible &&
            !realised.hasFingering &&
            realised.exercise.kind === 'scale' ? (
              <p className="panel__note">No curated fingering for this scale.</p>
            ) : null}
          </section>
        ) : null}
      </div>

      <div className="next-bar">
        <button type="button" className="next" onClick={onNext}>
          Next
        </button>
      </div>

      <p className="hints">
        <span>
          <kbd>Space</kbd> next
        </span>
        <span>
          <kbd>N</kbd> notation
        </span>
        <span>
          <kbd>F</kbd> fingering
        </span>
        <span>
          <kbd>S</kbd> settings
        </span>
      </p>
    </div>
  );
}
