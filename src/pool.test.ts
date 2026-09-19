/**
 * A sweep over the entire exercise pool.
 *
 * Every other test covers one layer. This one asserts the thing that only shows
 * up when they are joined: that every exercise the app can actually draw
 * realises into real notes, engraves into MusicXML, stays on the keyboard, and
 * has an identity distinct from every other. It is the guard against a
 * combination that no single module's tests happen to reach.
 */

import { describe, expect, it } from 'vitest';
import { eligibleExercises, exerciseKey } from './domain/exercise';
import { realiseExercise } from './domain/realise';
import { toMusicXml } from './notation/musicxml';
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
import type { PitchClass } from './domain/types';
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

describe('whole-pool sweep', () => {
  const pool = eligibleExercises(EVERYTHING);

  it('realises and engraves every exercise the app can produce', () => {
    console.log('pool size:', pool.length);
    const keys = new Set<string>();
    let lowest = Infinity;
    let highest = -Infinity;
    let chordEvents = 0;

    for (const exercise of pool) {
      keys.add(exerciseKey(exercise));

      const realised = realiseExercise(exercise);
      expect(realised.parts.length, exerciseKey(exercise)).toBeGreaterThan(0);

      for (const part of realised.parts) {
        expect(part.events.length, exerciseKey(exercise)).toBeGreaterThan(0);
        for (const event of part.events) {
          expect(event.pitches.length).toBeGreaterThan(0);
          expect(event.fingers).toHaveLength(event.pitches.length);
          if (event.pitches.length > 1) chordEvents += 1;
          for (const pitch of event.pitches) {
            expect(Math.abs(pitch.alter), `${exerciseKey(exercise)} ${pitch.letter}`).toBeLessThanOrEqual(2);
            const midi = midiOf(pitch);
            lowest = Math.min(lowest, midi);
            highest = Math.max(highest, midi);
          }
        }
      }

      const xml = toMusicXml(realised);
      expect(xml.startsWith('<?xml'), exerciseKey(exercise)).toBe(true);
    }

    console.log('distinct keys:', keys.size, 'chord events:', chordEvents);
    console.log('midi range:', lowest, '-', highest);
    // A0 to C8 is the piano.
    expect(lowest).toBeGreaterThanOrEqual(21);
    expect(highest).toBeLessThanOrEqual(108);
    expect(keys.size).toBe(pool.length);
  }, 300_000);

  it('parses every generated score as well-formed XML', () => {
    const parser = new DOMParser();
    // Sampling deterministically: parsing 2,700 documents is slow and every
    // 17th covers each scale type, key and direction many times over.
    for (let i = 0; i < pool.length; i += 17) {
      const exercise = pool[i];
      if (exercise === undefined) continue;
      const doc = parser.parseFromString(toMusicXml(realiseExercise(exercise)), 'application/xml');
      expect(doc.querySelector('parsererror'), exerciseKey(exercise)).toBeNull();
    }
  }, 300_000);
});
