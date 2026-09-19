/**
 * Regression tests for `ScoreView`'s size fitting.
 *
 * These exist because the fitting logic has been wrong three times, each time in
 * a way the other notation tests could not see: `ScoreView.test.tsx` accepts
 * either a rendered or an errored outcome, and `rendering.test.ts` drives OSMD
 * directly rather than through the component. Neither notices a score that is
 * engraved at three percent of its panel.
 *
 * So these assert the one thing the fit actually promises: the score ends up
 * inside its panel, and *using* it.
 *
 * `vitest.setup.ts` gives every element a 900x600 box, so that is the panel
 * being fitted to here.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Exercise } from '../domain/types';
import { realiseExercise } from '../domain/realise';
import { toMusicXml } from './musicxml';
import { ScoreView } from './ScoreView';

const PANEL_HEIGHT = 600;
const SETTLE_TIMEOUT_MS = 20_000;

async function engravedHeight(exercise: Exercise): Promise<number> {
  const musicXml = toMusicXml(realiseExercise(exercise));
  render(<ScoreView musicXml={musicXml} showFingerings label="test score" />);

  const canvas = await waitFor(
    () => {
      const svg = screen.getByRole('img').querySelector('svg');
      if (svg === null) throw new Error('not engraved yet');
      return svg;
    },
    { timeout: SETTLE_TIMEOUT_MS },
  );

  const height = Number(canvas.getAttribute('height') ?? Number.NaN);
  if (!Number.isFinite(height)) throw new Error('no height on the engraved SVG');
  return height;
}

/** The extremes, plus one in between: short scores grow, long ones shrink. */
const CASES: ReadonlyArray<{ name: string; exercise: Exercise }> = [
  {
    name: 'a one-octave scale, which has to grow to fill the panel',
    exercise: {
      kind: 'scale',
      tonic: 0,
      scaleTypeId: 'major',
      motion: 'similar',
      octaves: 1,
      direction: 'ascending',
    },
  },
  {
    name: 'a two-octave scale up and down',
    exercise: {
      kind: 'scale',
      tonic: 3,
      scaleTypeId: 'harmonicMinor',
      motion: 'similar',
      octaves: 2,
      direction: 'both',
    },
  },
  {
    name: 'four octaves of chromatic, which has to shrink to fit',
    exercise: {
      kind: 'scale',
      tonic: 1,
      scaleTypeId: 'chromatic',
      motion: 'similar',
      octaves: 4,
      direction: 'both',
    },
  },
  {
    name: 'the Rule of the Octave, which is chords rather than single notes',
    exercise: {
      kind: 'ruleOfOctave',
      tonic: 0,
      mode: 'minor',
      version: 'fenaroli',
      position: 1,
    },
  },
];

describe('fitting the score to its panel', () => {
  for (const { name, exercise } of CASES) {
    it(`fits ${name}`, async () => {
      const height = await engravedHeight(exercise);

      // Never overflows. This is the promise the app makes: the practice screen
      // is one page and the notation is what gives.
      expect(height, 'engraved height').toBeLessThanOrEqual(PANEL_HEIGHT);

      // ...and never collapses. A previous version of the search returned an
      // unmeasured floor zoom whenever none of its probes happened to fit,
      // engraving a four-octave chromatic at 18px in a 600px panel. Every case
      // here comfortably cleared a third of the panel once that was fixed; the
      // bar is set below that so ordinary engraving differences do not trip it,
      // but far above a collapse.
      expect(height, 'engraved height').toBeGreaterThan(PANEL_HEIGHT * 0.25);
    }, 30_000);
  }
});
