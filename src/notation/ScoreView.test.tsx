import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type {
  ExerciseEvent,
  Hand,
  HandPart,
  Letter,
  Pitch,
  RealisedExercise,
  ScaleExercise,
  ScaleType,
} from '../domain/types';
import { toMusicXml } from './musicxml';
import { ScoreView } from './ScoreView';

// ---------------------------------------------------------------------------
// jsdom has no layout engine.
//
// OpenSheetMusicDisplay lays a score out from `container.offsetWidth`, measures
// glyphs, and asks VexFlow to draw into an SVG — none of which jsdom can do
// faithfully. Depending on the OSMD version it may produce an empty-but-valid
// SVG or throw partway through layout, and either outcome is legitimate here.
//
// So these tests assert what the *component* promises regardless of whether
// OSMD manages to draw: that it mounts, exposes an accessible image with the
// right label, and always settles into a definite state ('ready' or 'error')
// without letting an exception escape. Rendering fidelity is a browser
// concern and is verified by eye, not here.
// ---------------------------------------------------------------------------

const SETTLE_TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Fixtures — hand-written, so this file depends only on `types.ts`.
// ---------------------------------------------------------------------------

function p(spec: string): Pitch {
  const match = /^([A-G])(bb|b|##|#|x|)(-?\d+)$/.exec(spec);
  if (match === null) throw new Error(`bad pitch spec: ${spec}`);
  const [, letter = '', accidental = '', octave = ''] = match;
  const alter =
    accidental === 'bb'
      ? -2
      : accidental === 'b'
        ? -1
        : accidental === '#'
          ? 1
          : accidental === '##' || accidental === 'x'
            ? 2
            : 0;
  return { letter: letter as Letter, alter, octave: Number(octave) };
}

function part(hand: Hand, specs: string, fingers: readonly number[]): HandPart {
  const names = specs.trim().split(/\s+/);
  if (names.length !== fingers.length) throw new Error('fixture mismatch');
  const events: ExerciseEvent[] = names.map((name, i) => ({
    pitches: [p(name)],
    fingers: [fingers[i] ?? null],
  }));
  return { hand, events };
}

const HARMONIC_MINOR: ScaleType = {
  id: 'harmonicMinor',
  name: 'Harmonic Minor',
  category: 'family',
  spelling: 'diatonic',
  ascendingFormula: [0, 2, 3, 5, 7, 8, 11],
  descendingFormula: [0, 2, 3, 5, 7, 8, 11],
  signatureFormula: [0, 2, 3, 5, 7, 8, 10],
  fingeringSet: 'minor',
};

const EFLAT_EXERCISE: ScaleExercise = {
  kind: 'scale',
  tonic: 3,
  scaleTypeId: 'harmonicMinor',
  motion: 'similar',
  octaves: 2,
  direction: 'both',
};

/** E♭ harmonic minor, both hands, two octaves up and down. */
const eFlatMinor: RealisedExercise = {
  exercise: EFLAT_EXERCISE,
  scaleType: HARMONIC_MINOR,
  tonicNote: { letter: 'E', alter: -1 },
  title: 'E♭ Harmonic Minor',
  parts: [
    part(
      'right',
      'Eb4 F4 Gb4 Ab4 Bb4 Cb5 D5 Eb5 F5 Gb5 Ab5 Bb5 Cb6 D6 Eb6 ' +
        'D6 Cb6 Bb5 Ab5 Gb5 F5 Eb5 D5 Cb5 Bb4 Ab4 Gb4 F4 Eb4',
      [3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3],
    ),
    part(
      'left',
      'Eb3 F3 Gb3 Ab3 Bb3 Cb4 D4 Eb4 F4 Gb4 Ab4 Bb4 Cb5 D5 Eb5 ' +
        'D5 Cb5 Bb4 Ab4 Gb4 F4 Eb4 D4 Cb4 Bb3 Ab3 Gb3 F3 Eb3',
      [2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2],
    ),
  ],
  fifths: -6,
  hasFingering: true,
  noteType: 'eighth',
};

/** G♯ harmonic minor, a lone right-hand part — the double-sharp case. */
const gSharpMinor: RealisedExercise = {
  exercise: {
    kind: 'scale',
    tonic: 8,
    scaleTypeId: 'harmonicMinor',
    motion: 'similar',
    octaves: 1,
    direction: 'ascending',
  },
  scaleType: HARMONIC_MINOR,
  tonicNote: { letter: 'G', alter: 1 },
  title: 'G♯ Harmonic Minor',
  parts: [part('right', 'G#4 A#4 B4 C#5 D#5 E5 Fx5 G#5', [3, 4, 1, 2, 3, 1, 2, 3])],
  fifths: 5,
  hasFingering: true,
  noteType: 'eighth',
};

const EFLAT_XML = toMusicXml(eFlatMinor);
const GSHARP_XML = toMusicXml(gSharpMinor);

const EFLAT_LABEL = 'Notation for E♭ Harmonic Minor, both hands, 2 octaves';
const GSHARP_LABEL = 'Notation for G♯ Harmonic Minor, right hand, 1 octave';

/** The state machine always ends somewhere definite; jsdom decides which. */
async function settle(root: HTMLElement): Promise<string> {
  await waitFor(
    () => {
      expect(root.getAttribute('data-state')).not.toBe('loading');
    },
    { timeout: SETTLE_TIMEOUT_MS },
  );
  return root.getAttribute('data-state') ?? '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScoreView', () => {
  it('mounts and exposes an accessible image with the given label', () => {
    render(<ScoreView musicXml={EFLAT_XML} showFingerings label={EFLAT_LABEL} />);
    const root = screen.getByRole('img', { name: EFLAT_LABEL });
    expect(root).toBeInTheDocument();
    expect(root).toHaveClass('score');
    expect(root.querySelector('.score__canvas')).not.toBeNull();
  });

  it('hides the drawing surface from assistive technology', () => {
    render(<ScoreView musicXml={EFLAT_XML} showFingerings label={EFLAT_LABEL} />);
    const canvas = screen.getByRole('img', { name: EFLAT_LABEL }).querySelector('.score__canvas');
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows a quiet loading state before OSMD has drawn anything', () => {
    render(<ScoreView musicXml={EFLAT_XML} showFingerings label={EFLAT_LABEL} />);
    const root = screen.getByRole('img', { name: EFLAT_LABEL });
    expect(root.getAttribute('data-state')).toBe('loading');
    expect(root.querySelector('.score__status')?.textContent).toMatch(/loading/i);
  });

  it.each([
    ['E♭ harmonic minor, both hands', EFLAT_XML, EFLAT_LABEL],
    ['G♯ harmonic minor, right hand', GSHARP_XML, GSHARP_LABEL],
  ])('settles without throwing for %s', async (_name, xml, label) => {
    // Either outcome is a pass: see the note about jsdom at the top of the file.
    render(<ScoreView musicXml={xml} showFingerings label={label} />);
    const root = screen.getByRole('img', { name: label });

    const state = await settle(root);
    expect(['ready', 'error']).toContain(state);

    if (state === 'error') {
      expect(root.querySelector('.score__status')?.textContent).toMatch(/unavailable/i);
    } else {
      expect(root.querySelector('.score__status')).toBeNull();
    }
    // Whichever way it went, the component is still mounted and labelled.
    expect(screen.getByRole('img', { name: label })).toBe(root);
  });

  it('keeps the label in sync when the score is replaced', async () => {
    const { rerender } = render(
      <ScoreView musicXml={EFLAT_XML} showFingerings label={EFLAT_LABEL} />,
    );
    await settle(screen.getByRole('img', { name: EFLAT_LABEL }));

    rerender(<ScoreView musicXml={GSHARP_XML} showFingerings label={GSHARP_LABEL} />);
    const root = screen.getByRole('img', { name: GSHARP_LABEL });
    expect(['ready', 'error']).toContain(await settle(root));
  });

  it('survives the score being swapped repeatedly before a render finishes', async () => {
    // Simulates hammering the Next button: each change must invalidate the
    // in-flight async work rather than racing it onto the screen.
    const { rerender } = render(
      <ScoreView musicXml={EFLAT_XML} showFingerings label={EFLAT_LABEL} />,
    );
    rerender(<ScoreView musicXml={GSHARP_XML} showFingerings label={GSHARP_LABEL} />);
    rerender(<ScoreView musicXml={EFLAT_XML} showFingerings label={EFLAT_LABEL} />);
    rerender(<ScoreView musicXml={GSHARP_XML} showFingerings={false} label={GSHARP_LABEL} />);

    const root = screen.getByRole('img', { name: GSHARP_LABEL });
    expect(['ready', 'error']).toContain(await settle(root));
  });

  it('does not throw when unmounted mid-load', async () => {
    const onError = vi.fn();
    const onRejection = vi.fn();
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    try {
      const { unmount } = render(
        <ScoreView musicXml={EFLAT_XML} showFingerings label={EFLAT_LABEL} />,
      );
      // Unmount while the lazy OSMD import is still in flight.
      expect(() => unmount()).not.toThrow();

      // Give the abandoned async work every chance to blow up.
      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(onError).not.toHaveBeenCalled();
      expect(onRejection).not.toHaveBeenCalled();
      expect(screen.queryByRole('img')).toBeNull();
    } finally {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    }
  });

  it('unmounts cleanly after a render has completed', async () => {
    const { unmount } = render(
      <ScoreView musicXml={GSHARP_XML} showFingerings label={GSHARP_LABEL} />,
    );
    await settle(screen.getByRole('img', { name: GSHARP_LABEL }));
    expect(() => unmount()).not.toThrow();
    expect(screen.queryByRole('img')).toBeNull();
  });

});
