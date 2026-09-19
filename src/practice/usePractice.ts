import { useCallback, useMemo, useState } from 'react';
import { eligibleExercises, exerciseKey, randomExercise } from '../domain/exercise';
import { realiseExercise } from '../domain/realise';
import type { Exercise, RealisedExercise } from '../domain/types';
import { useSettings } from '../settings/SettingsProvider';
import type { Settings } from '../settings/types';

/**
 * Everything the practice screen needs, and nothing it does not.
 *
 * The hook owns the only mutable state in the app that is not a setting: which
 * exercise is currently on screen, and whether the user has overridden the
 * notation / fingering visibility *for this exercise only*.
 */
export interface Practice {
  /** `null` when the settings admit no exercises at all. */
  realised: RealisedExercise | null;
  poolSize: number;
  next: () => void;
  notationVisible: boolean;
  fingeringVisible: boolean;
  toggleNotation: () => void;
  toggleFingering: () => void;
}

/**
 * A draw and its per-exercise overrides. They live in one state object because
 * they always change together: a new exercise always clears both overrides, and
 * there is no ordering in which they could be observed apart.
 */
interface Draw {
  readonly exercise: Exercise | null;
  readonly notationOverride: boolean | null;
  readonly fingeringOverride: boolean | null;
}

function drawFrom(settings: Settings): Draw {
  return {
    exercise: randomExercise(settings),
    notationOverride: null,
    fingeringOverride: null,
  };
}

export function usePractice(): Practice {
  const { settings } = useSettings();

  // Lazy initialiser: the first exercise is drawn once, on mount, not on every
  // render. The draw is deliberately not memoised on `settings` — repeating a
  // draw for the same settings would make "Next" deterministic.
  const [draw, setDraw] = useState<Draw>(() => drawFrom(settings));

  const pool = useMemo(() => eligibleExercises(settings), [settings]);
  const poolKeys = useMemo(() => new Set(pool.map(exerciseKey)), [pool]);

  // Adjusting state during render (rather than in an effect) so the screen never
  // paints an exercise the settings no longer allow. React discards this render
  // and immediately re-runs it with the new state.
  const [seenSettings, setSeenSettings] = useState<Settings>(settings);
  let current = draw;
  if (seenSettings !== settings) {
    setSeenSettings(settings);
    const stillEligible = current.exercise !== null && poolKeys.has(exerciseKey(current.exercise));
    if (!stillEligible) {
      // Only redraw when the current exercise has actually fallen out of the
      // pool. Changing an unrelated preference must not yank the exercise away
      // in the middle of practising it.
      current = drawFrom(settings);
      setDraw(current);
    }
  }

  const realised = useMemo(
    () => (current.exercise === null ? null : realiseExercise(current.exercise)),
    [current.exercise],
  );

  const next = useCallback(() => {
    setDraw(drawFrom(settings));
  }, [settings]);

  const notationDefault = settings.notation === 'always';
  const fingeringDefault = settings.fingering === 'always';

  const toggleNotation = useCallback(() => {
    setDraw((d) => ({ ...d, notationOverride: !(d.notationOverride ?? notationDefault) }));
  }, [notationDefault]);

  const toggleFingering = useCallback(() => {
    setDraw((d) => ({ ...d, fingeringOverride: !(d.fingeringOverride ?? fingeringDefault) }));
  }, [fingeringDefault]);

  return {
    realised,
    poolSize: pool.length,
    next,
    notationVisible: current.notationOverride ?? notationDefault,
    fingeringVisible: current.fingeringOverride ?? fingeringDefault,
    toggleNotation,
    toggleFingering,
  };
}
