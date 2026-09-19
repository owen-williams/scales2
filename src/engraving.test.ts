/**
 * A sweep over every exercise the app can offer, looking for the things that
 * make a score *look* wrong rather than be wrong.
 *
 * The unit tests check that the notes are right. These check that they land
 * somewhere a reader can follow: on the staves rather than floating above them,
 * inside a hand's reach, without the hands crossing. Every fault this file
 * guards against shipped at least once and was caught by eye rather than by the
 * suite — the register bugs in particular, where a scale was correct in C and
 * unreadable in B flat because the placement was pinned to an octave number.
 */

import { describe, expect, it } from 'vitest';
import { eligibleExercises, exerciseKey } from './domain/exercise';
import { realiseExercise } from './domain/realise';
import { midiOf } from './domain/pitch';
import {
  DIRECTION_OPTIONS,
  MODE_IDS,
  MOTION_OPTIONS,
  OCTAVE_OPTIONS,
  ROO_POSITIONS,
  ROO_VERSION_IDS,
  SCALE_FAMILY_IDS,
} from './domain/types';
import type { Exercise, Hand, PitchClass } from './domain/types';
import type { Settings } from './settings/types';

const EVERYTHING: Settings = {
  keys: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as PitchClass[],
  families: [...SCALE_FAMILY_IDS],
  modes: [...MODE_IDS],
  motions: [...MOTION_OPTIONS],
  octaves: [...OCTAVE_OPTIONS],
  directions: [...DIRECTION_OPTIONS],
  rooVersions: [...ROO_VERSION_IDS],
  rooModes: ['major', 'minor'],
  rooPositions: [...ROO_POSITIONS],
  notation: 'always',
  fingering: 'always',
};

const STAFF: Record<Hand, { low: number; high: number }> = {
  right: { low: 64, high: 77 }, // E4..F5
  left: { low: 43, high: 57 }, //  G2..A3
};

function ledgers(midi: number, staff: { low: number; high: number }): number {
  if (midi < staff.low) return Math.ceil((staff.low - midi) / 3.5);
  if (midi > staff.high) return Math.ceil((midi - staff.high) / 3.5);
  return 0;
}

interface Problem {
  kind: string;
  detail: string;
  key: string;
}

function inspect(exercise: Exercise): Problem[] {
  const problems: Problem[] = [];
  const key = exerciseKey(exercise);
  const realised = realiseExercise(exercise);

  const byHand = new Map<Hand, number[][]>();
  for (const part of realised.parts) {
    byHand.set(
      part.hand,
      part.events.map((event) => event.pitches.map(midiOf)),
    );
  }

  for (const part of realised.parts) {
    const staff = STAFF[part.hand];
    const flat = part.events.flatMap((event) => event.pitches.map(midiOf));
    const lo = Math.min(...flat);
    const hi = Math.max(...flat);

    const worst = Math.max(...flat.map((m) => ledgers(m, staff)));
    if (worst > 6) {
      problems.push({ kind: 'ledger-lines', detail: `${part.hand} ${String(worst)}`, key });
    }
    // A whole hand sitting off its staff — the fault that made B flat unreadable.
    if (lo > staff.high || hi < staff.low) {
      problems.push({
        kind: 'hand-off-staff',
        detail: `${part.hand} ${String(lo)}-${String(hi)} vs ${String(staff.low)}-${String(staff.high)}`,
        key,
      });
    }
    if (lo < 21 || hi > 108) {
      problems.push({ kind: 'off-keyboard', detail: `${String(lo)}-${String(hi)}`, key });
    }

    // A chord no hand could take.
    for (const chord of byHand.get(part.hand) ?? []) {
      if (chord.length > 1) {
        const span = Math.max(...chord) - Math.min(...chord);
        if (span > 14) {
          problems.push({ kind: 'chord-span', detail: `${part.hand} ${String(span)}st`, key });
        }
      }
    }

    // A leap no hand could take in a single line.
    const line = (byHand.get(part.hand) ?? []).map((chord) => Math.min(...chord));
    for (let i = 1; i < line.length; i += 1) {
      const leap = Math.abs((line[i] ?? 0) - (line[i - 1] ?? 0));
      if (leap > 12) {
        problems.push({ kind: 'leap', detail: `${part.hand} ${String(leap)}st`, key });
      }
    }
  }

  // Hands crossing: the left above the right at the same moment.
  const right = byHand.get('right');
  const left = byHand.get('left');
  if (right !== undefined && left !== undefined) {
    if (right.length !== left.length) {
      problems.push({
        kind: 'part-length',
        detail: `${String(right.length)} vs ${String(left.length)}`,
        key,
      });
    }
    for (let i = 0; i < Math.min(right.length, left.length); i += 1) {
      const rLow = Math.min(...(right[i] ?? [0]));
      const lHigh = Math.max(...(left[i] ?? [0]));
      if (lHigh > rLow) {
        problems.push({ kind: 'hands-cross', detail: `event ${String(i)}`, key });
      }
    }
  }

  return problems;
}

describe('engraving sweep over the whole pool', () => {
  const pool = eligibleExercises(EVERYTHING);
  const all = pool.flatMap(inspect);

  const of = (kind: string): Problem[] => all.filter((problem) => problem.kind === kind);
  const report = (list: Problem[]): string =>
    list
      .slice(0, 5)
      .map((problem) => `${problem.key} (${problem.detail})`)
      .join('; ');

  it('draws every exercise it can offer', () => {
    expect(pool.length).toBeGreaterThan(2000);
  });

  it('never crosses the hands', () => {
    expect(report(of('hands-cross')), 'hands cross').toBe('');
  });

  it('never leaves the keyboard', () => {
    expect(report(of('off-keyboard')), 'off the keyboard').toBe('');
  });

  it('never writes a chord no hand could take, or a leap none could make', () => {
    expect(report(of('chord-span')), 'unplayable chord').toBe('');
    expect(report(of('leap')), 'unplayable leap').toBe('');
  });

  it('gives both hands the same number of events', () => {
    expect(report(of('part-length')), 'parts of different lengths').toBe('');
  });

  it('never starts a hand wholly off its own staff', () => {
    // The fault that made a two-octave B flat unreadable: every note of the
    // left hand above the bass staff before the scale had begun.
    expect(report(of('hand-off-staff')), 'hand off its staff').toBe('');
  });

  it('keeps ledger lines within reach, except where four octaves make it impossible', () => {
    // A four-octave run spans forty-eight semitones against a staff's fourteen,
    // and the hands are an octave apart while the staves are nearly two — so
    // the left hand cannot avoid climbing well above the bass staff. Everything
    // shorter than four octaves has no excuse.
    const excessive = of('ledger-lines').filter((problem) => !problem.key.includes(':4:'));
    expect(report(excessive), 'excessive ledger lines below four octaves').toBe('');
  });
});
