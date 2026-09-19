import { describe, expect, it } from 'vitest';

import { formatPitch, midiOf } from './pitch';
import { describeExercise, realiseExercise } from './realise';
import { distinctVersionsFor, realiseRuleOfOctave } from './ruleOfOctave';
import {
  DIRECTION_OPTIONS,
  MODE_IDS,
  MOTION_OPTIONS,
  OCTAVE_OPTIONS,
  ROO_POSITIONS,
  ROO_VERSION_IDS,
  SCALE_FAMILY_IDS,
} from './types';
import type {
  DirectionOption,
  Hand,
  HandPart,
  OctaveCount,
  Pitch,
  PitchClass,
  RealisedExercise,
  RuleOfOctaveExercise,
  ScaleExercise,
  ScaleType,
} from './types';

const exercise = (overrides: Partial<ScaleExercise>): ScaleExercise => ({
  kind: 'scale',
  tonic: 0,
  scaleTypeId: 'major',
  motion: 'similar',
  octaves: 1,
  direction: 'ascending',
  ...overrides,
});

const ruleOfOctave = (overrides: Partial<RuleOfOctaveExercise> = {}): RuleOfOctaveExercise => ({
  kind: 'ruleOfOctave',
  mode: 'major',
  tonic: 0,
  version: 'fenaroli',
  position: 1,
  ...overrides,
});

const HANDS: readonly Hand[] = ['right', 'left'];

function partFor(realised: RealisedExercise, hand: Hand): HandPart {
  const part = realised.parts.find((candidate) => candidate.hand === hand);
  if (part === undefined) throw new Error(`expected a ${hand}-hand part`);
  return part;
}

/** The right-hand part — the one most assertions about pitch and fingering read. */
const rightPart = (realised: RealisedExercise): HandPart => partFor(realised, 'right');

/**
 * A part's notes, unwrapped from the events that carry them.
 *
 * Every event of a scale holds exactly one pitch and one finger — a scale is a
 * single line, and the plural pitches of an event exist for chordal exercises —
 * so that is asserted here, on every read, rather than in one test that could
 * be deleted.
 */
function notesOf(part: HandPart): { pitch: Pitch; finger: number | null }[] {
  return part.events.map((event) => {
    expect(event.pitches).toHaveLength(1);
    expect(event.fingers).toHaveLength(1);
    const pitch = event.pitches[0];
    if (pitch === undefined) throw new Error('unreachable');
    return { pitch, finger: event.fingers[0] ?? null };
  });
}

/** The scale a realised exercise is of. Absent only when it is not a scale. */
function scaleTypeOf(realised: RealisedExercise): ScaleType {
  const { scaleType } = realised;
  if (scaleType === undefined) throw new Error('expected a realised scale to carry its scale type');
  return scaleType;
}

const pitchNames = (part: HandPart): string[] =>
  notesOf(part).map((note) => formatPitch(note.pitch));
const fingers = (part: HandPart): (number | null)[] => notesOf(part).map((note) => note.finger);

/** Semitone steps between consecutive notes — the shape of the line. */
const deltas = (part: HandPart): number[] => {
  const notes = notesOf(part);
  return notes.slice(1).map((note, index) => {
    const previous = notes[index];
    if (previous === undefined) throw new Error('unreachable');
    return midiOf(note.pitch) - midiOf(previous.pitch);
  });
};

// ---------------------------------------------------------------------------
// Note counts
// ---------------------------------------------------------------------------

describe('realiseExercise — note counts', () => {
  // A one-way run is `octaves * degreesPerOctave + 1`: every degree of every
  // octave plus the closing tonic. Turning round doubles it and shares the
  // turning note, so `both` is `2n - 1`.
  const oneWay = (octaves: number, degrees: number) => octaves * degrees + 1;
  const roundTrip = (octaves: number, degrees: number) => 2 * oneWay(octaves, degrees) - 1;

  /** Asserts both hands play the same number of notes, and how many. */
  function expectEveryPart(realised: RealisedExercise, length: number): void {
    expect(realised.parts).toHaveLength(2);
    for (const part of realised.parts) expect(part.events).toHaveLength(length);
  }

  it.each(OCTAVE_OPTIONS)('diatonic, %i octave(s), every direction', (octaves) => {
    for (const direction of DIRECTION_OPTIONS) {
      const realised = realiseExercise(exercise({ octaves, direction }));
      const expected = direction === 'both' ? roundTrip(octaves, 7) : oneWay(octaves, 7);
      expectEveryPart(realised, expected);
    }
  });

  it.each(OCTAVE_OPTIONS)('chromatic, %i octave(s), every direction', (octaves) => {
    for (const direction of DIRECTION_OPTIONS) {
      const realised = realiseExercise(exercise({ scaleTypeId: 'chromatic', octaves, direction }));
      const expected = direction === 'both' ? roundTrip(octaves, 12) : oneWay(octaves, 12);
      expectEveryPart(realised, expected);
    }
  });

  it('matches the worked figures from the spec', () => {
    expectEveryPart(realiseExercise(exercise({ octaves: 2, direction: 'both' })), 29);

    expectEveryPart(
      realiseExercise(exercise({ scaleTypeId: 'chromatic', octaves: 2, direction: 'both' })),
      49,
    );

    // One octave up-and-down: 8 + 8 - 1.
    expectEveryPart(realiseExercise(exercise({ direction: 'both' })), 15);
  });

  it('writes the turning note exactly once', () => {
    const part = rightPart(realiseExercise(exercise({ octaves: 1, direction: 'both' })));
    expect(pitchNames(part)).toEqual([
      'C4',
      'D4',
      'E4',
      'F4',
      'G4',
      'A4',
      'B4',
      'C5',
      'B4',
      'A4',
      'G4',
      'F4',
      'E4',
      'D4',
      'C4',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Event shape
// ---------------------------------------------------------------------------

describe('realiseExercise — events', () => {
  it('gives every scale event exactly one pitch, with a finger to match', () => {
    for (const scaleTypeId of [...SCALE_FAMILY_IDS, ...MODE_IDS]) {
      for (const direction of DIRECTION_OPTIONS) {
        const realised = realiseExercise(exercise({ scaleTypeId, octaves: 2, direction }));
        for (const part of realised.parts) {
          for (const event of part.events) {
            expect(event.pitches).toHaveLength(1);
            expect(event.fingers).toHaveLength(event.pitches.length);
          }
        }
      }
    }
  });

  it('writes a scale in eighths, named and spelled by its scale type', () => {
    const realised = realiseExercise(exercise({ tonic: 3, scaleTypeId: 'harmonicMinor' }));
    expect(realised.noteType).toBe('eighth');
    expect(realised.title).toBe('E♭ Harmonic Minor');
    expect(scaleTypeOf(realised).id).toBe('harmonicMinor');
    expect(realised.tonicNote).toEqual({ letter: 'E', alter: -1 });
  });
});

// ---------------------------------------------------------------------------
// Rule of the Octave
//
// The music itself is curated data owned by `./ruleOfOctave` and tested there.
// What belongs to this module is the dispatch, and the two judgements it makes
// around the harmonisation it is handed.
// ---------------------------------------------------------------------------

describe('realiseExercise — Rule of the Octave', () => {
  it('reads a chord to the quarter note, with no fingering and no scale type', () => {
    const realised = realiseExercise(ruleOfOctave({ mode: 'minor' }));

    expect(realised.noteType).toBe('quarter');
    // Fingerings for chords are not standard curated data, so none are invented.
    expect(realised.hasFingering).toBe(false);
    expect(realised.scaleType).toBeUndefined();
    expect(realised.tonicNote).toBeUndefined();
    expect(realised.exercise).toEqual(ruleOfOctave({ mode: 'minor' }));
  });

  it('titles itself with the key alone, leaving the rule to the descriptors', () => {
    // A scale's title is its name; this one's is its key. "Rule of the Octave"
    // is the first descriptor line, and saying it in both places would print it
    // twice on one screen.
    expect(realiseExercise(ruleOfOctave({ tonic: 0, mode: 'minor' })).title).toBe('C Minor');
    expect(realiseExercise(ruleOfOctave({ tonic: 0, mode: 'major' })).title).toBe('C Major');
    expect(realiseExercise(ruleOfOctave({ tonic: 6, mode: 'major' })).title).toBe('F♯ Major');
    // The same conventional spelling the scales use: E♭ minor, not D♯ minor.
    expect(realiseExercise(ruleOfOctave({ tonic: 3, mode: 'minor' })).title).toBe('E♭ Minor');
    expect(realiseExercise(ruleOfOctave({ tonic: 8, mode: 'minor' })).title).toBe('G♯ Minor');
    expect(realiseExercise(ruleOfOctave({ tonic: 8, mode: 'major' })).title).toBe('A♭ Major');
  });

  it('never disagrees with the curated harmonisation about which key it is in', () => {
    // The title is minted here while the notes are spelled in `./ruleOfOctave`,
    // so the two must be pinned together: the key on the stave and the key in
    // the headline are one decision made twice.
    const keys: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    for (const tonic of keys) {
      for (const mode of ['major', 'minor'] as const) {
        const e = ruleOfOctave({ tonic, mode });
        const curated = realiseRuleOfOctave(e);
        expect(curated.title.startsWith(`${realiseExercise(e).title} `)).toBe(true);
        expect(curated.title).toContain('Rule of the Octave');
      }
    }
  });

  it('takes its key signature and parts from the harmonisation', () => {
    const realised = realiseExercise(ruleOfOctave({ mode: 'minor' }));

    expect(realised.fifths).toBeGreaterThanOrEqual(-7);
    expect(realised.fifths).toBeLessThanOrEqual(7);
    expect(realised.parts.map((part) => part.hand)).toEqual(['right', 'left']);
    // Chords: the right hand carries three upper voices over the bass.
    for (const part of realised.parts) {
      expect(part.events.length).toBeGreaterThan(0);
      for (const event of part.events) {
        expect(event.fingers).toHaveLength(event.pitches.length);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Parts and hands
// ---------------------------------------------------------------------------

describe('realiseExercise — parts', () => {
  it('always gives exactly two parts, right hand first', () => {
    for (const motion of MOTION_OPTIONS) {
      for (const octaves of OCTAVE_OPTIONS) {
        if (motion === 'contrary' && octaves > 2) continue;
        for (const direction of DIRECTION_OPTIONS) {
          const realised = realiseExercise(exercise({ motion, octaves, direction }));
          expect(realised.parts.map((p) => p.hand)).toEqual(['right', 'left']);
        }
      }
    }
  });

  it('gives each hand the complete run, not one run shared between them', () => {
    const realised = realiseExercise(exercise({ octaves: 2, direction: 'both' }));
    expect(realised.parts).toHaveLength(2);
    for (const part of realised.parts) {
      expect(part.events).toHaveLength(29);
    }
  });

  it('labels every part with a hand the notation layer can pick a clef from', () => {
    // Clef choice downstream is purely `hand === 'right' ? treble : bass`, so
    // the only requirement here is that every part names one of the two hands.
    for (const motion of MOTION_OPTIONS) {
      for (const part of realiseExercise(exercise({ motion })).parts) {
        expect(HANDS).toContain(part.hand);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Octave placement
// ---------------------------------------------------------------------------

describe('realiseExercise — octave placement', () => {
  it('starts the right hand at middle C for 1 and 2 octaves', () => {
    for (const octaves of [1, 2] as const) {
      const realised = realiseExercise(exercise({ octaves }));
      expect(notesOf(partFor(realised, 'right'))[0]?.pitch.octave).toBe(4);
      expect(notesOf(partFor(realised, 'left'))[0]?.pitch.octave).toBe(3);
    }
  });

  it('drops both hands an octave for 3 and 4 octaves, so the top still fits', () => {
    for (const octaves of [3, 4] as const) {
      const realised = realiseExercise(exercise({ octaves }));
      expect(notesOf(partFor(realised, 'right'))[0]?.pitch.octave).toBe(3);
      expect(notesOf(partFor(realised, 'left'))[0]?.pitch.octave).toBe(2);
    }
  });

  it('places a descending run at the top of the same range it would ascend', () => {
    const up = realiseExercise(exercise({ octaves: 2, direction: 'ascending' }));
    const down = realiseExercise(exercise({ octaves: 2, direction: 'descending' }));

    for (const hand of HANDS) {
      expect(pitchNames(partFor(down, hand))).toEqual([...pitchNames(partFor(up, hand))].reverse());
    }
  });

  it('places each hand by octave count alone, whichever way the run travels', () => {
    for (const octaves of OCTAVE_OPTIONS) {
      const lowest: Readonly<Record<Hand, number>> =
        octaves <= 2 ? { right: 4, left: 3 } : { right: 3, left: 2 };
      for (const direction of DIRECTION_OPTIONS) {
        const realised = realiseExercise(exercise({ octaves, direction }));
        for (const hand of HANDS) {
          const octaveNumbers = notesOf(partFor(realised, hand)).map((note) => note.pitch.octave);
          expect(Math.min(...octaveNumbers)).toBe(lowest[hand]);
        }
      }
    }
  });

  it('puts the left hand exactly one octave below the right in similar motion', () => {
    for (const octaves of OCTAVE_OPTIONS) {
      for (const direction of DIRECTION_OPTIONS) {
        const realised = realiseExercise(exercise({ octaves, direction }));
        const right = notesOf(partFor(realised, 'right'));
        const left = notesOf(partFor(realised, 'left'));

        expect(left).toHaveLength(right.length);
        right.forEach((note, index) => {
          const below = left[index];
          if (below === undefined) throw new Error('unreachable');
          expect(midiOf(note.pitch) - midiOf(below.pitch)).toBe(12);
          // Same spelling, one octave down — not an enharmonic substitute.
          expect(below.pitch.letter).toBe(note.pitch.letter);
          expect(below.pitch.alter).toBe(note.pitch.alter);
          expect(below.pitch.octave).toBe(note.pitch.octave - 1);
        });
      }
    }
  });

  it('numbers octaves across the C boundary', () => {
    // A major starts in octave 4 and crosses into octave 5 at the C sharp.
    const realised = realiseExercise(exercise({ tonic: 9, octaves: 1 }));
    expect(pitchNames(rightPart(realised))).toEqual([
      'A4',
      'B4',
      'C♯5',
      'D5',
      'E5',
      'F♯5',
      'G♯5',
      'A5',
    ]);

    // Two octaves of C major span C4 to C6 with the change of number on each C.
    const twoOctaves = realiseExercise(exercise({ octaves: 2 }));
    const names = pitchNames(rightPart(twoOctaves));
    expect(names[0]).toBe('C4');
    expect(names[7]).toBe('C5');
    expect(names[14]).toBe('C6');

    // A four-octave B major, starting an octave lower, ends on B6.
    const fourOctaves = realiseExercise(exercise({ tonic: 11, octaves: 4 }));
    const bMajor = pitchNames(rightPart(fourOctaves));
    expect(bMajor[0]).toBe('B3');
    expect(bMajor[bMajor.length - 1]).toBe('B7');
    // The very next note after each B is a C in the octave above.
    expect(bMajor[1]).toBe('C♯4');
  });

  it('never strays outside a real keyboard', () => {
    // A0 (21) to C8 (108).
    for (const octaves of OCTAVE_OPTIONS) {
      for (const tonic of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const) {
        for (const motion of MOTION_OPTIONS) {
          if (motion === 'contrary' && octaves > 2) continue;
          const realised = realiseExercise(exercise({ octaves, tonic, motion }));
          for (const part of realised.parts) {
            for (const note of notesOf(part)) {
              expect(midiOf(note.pitch)).toBeGreaterThanOrEqual(21);
              expect(midiOf(note.pitch)).toBeLessThanOrEqual(108);
            }
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Contrary motion
// ---------------------------------------------------------------------------

describe('realiseExercise — contrary motion', () => {
  const contraryOctaves: readonly OctaveCount[] = [1, 2];

  it('gives both parts exactly the same length', () => {
    for (const octaves of contraryOctaves) {
      for (const direction of DIRECTION_OPTIONS) {
        const realised = realiseExercise(exercise({ motion: 'contrary', octaves, direction }));
        const right = partFor(realised, 'right');
        const left = partFor(realised, 'left');
        expect(left.events).toHaveLength(right.events.length);
        // …and the same length a similar-motion exercise would have.
        const similar = realiseExercise(exercise({ octaves, direction }));
        expect(right.events).toHaveLength(partFor(similar, 'right').events.length);
      }
    }
  });

  it('moves the hands in opposite directions at every step', () => {
    for (const octaves of contraryOctaves) {
      for (const direction of DIRECTION_OPTIONS) {
        const realised = realiseExercise(exercise({ motion: 'contrary', octaves, direction }));
        const rightDeltas = deltas(partFor(realised, 'right'));
        const leftDeltas = deltas(partFor(realised, 'left'));

        expect(leftDeltas).toHaveLength(rightDeltas.length);
        rightDeltas.forEach((delta, index) => {
          const other = leftDeltas[index];
          if (other === undefined) throw new Error('unreachable');
          expect(delta).not.toBe(0);
          expect(Math.sign(delta)).toBe(-Math.sign(other));
        });
      }
    }
  });

  it('starts both hands on the same pitch and diverges when ascending', () => {
    const realised = realiseExercise(
      exercise({ motion: 'contrary', octaves: 2, direction: 'ascending' }),
    );
    const right = partFor(realised, 'right');
    const left = partFor(realised, 'left');

    expect(pitchNames(right)[0]).toBe('C4');
    expect(pitchNames(left)[0]).toBe('C4');
    expect(pitchNames(right)[right.events.length - 1]).toBe('C6');
    // The left hand's lowest tonic is `4 - octaves`.
    expect(pitchNames(left)[left.events.length - 1]).toBe('C2');
  });

  it('converges on the shared pitch when descending', () => {
    const realised = realiseExercise(
      exercise({ motion: 'contrary', octaves: 2, direction: 'descending' }),
    );
    const right = partFor(realised, 'right');
    const left = partFor(realised, 'left');

    expect(pitchNames(right)[0]).toBe('C6');
    expect(pitchNames(left)[0]).toBe('C2');
    expect(pitchNames(right)[right.events.length - 1]).toBe('C4');
    expect(pitchNames(left)[left.events.length - 1]).toBe('C4');
  });

  it('diverges then converges for direction: both', () => {
    const realised = realiseExercise(
      exercise({ motion: 'contrary', octaves: 1, direction: 'both' }),
    );
    const right = partFor(realised, 'right');
    const left = partFor(realised, 'left');

    expect(pitchNames(right)).toEqual([
      'C4',
      'D4',
      'E4',
      'F4',
      'G4',
      'A4',
      'B4',
      'C5',
      'B4',
      'A4',
      'G4',
      'F4',
      'E4',
      'D4',
      'C4',
    ]);
    expect(pitchNames(left)).toEqual([
      'C4',
      'B3',
      'A3',
      'G3',
      'F3',
      'E3',
      'D3',
      'C3',
      'D3',
      'E3',
      'F3',
      'G3',
      'A3',
      'B3',
      'C4',
    ]);
  });

  it('is always honoured: it changes the left hand and leaves the right where it was', () => {
    // Both hands always play, so there is no case in which contrary motion is
    // asked for and quietly realised as similar motion instead.
    for (const octaves of contraryOctaves) {
      for (const direction of DIRECTION_OPTIONS) {
        const contrary = realiseExercise(exercise({ motion: 'contrary', octaves, direction }));
        const similar = realiseExercise(exercise({ motion: 'similar', octaves, direction }));

        // The right hand occupies the same range and travels the same way…
        expect(partFor(contrary, 'right').events).toEqual(partFor(similar, 'right').events);
        // …and it is the left hand that mirrors it instead of following it.
        expect(partFor(contrary, 'left').events).not.toEqual(partFor(similar, 'left').events);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Spelling, key signature and name
// ---------------------------------------------------------------------------

describe('realiseExercise — spelling', () => {
  it('spells E♭ harmonic minor correctly, with a natural seventh', () => {
    const realised = realiseExercise(
      exercise({ tonic: 3, scaleTypeId: 'harmonicMinor', octaves: 1 }),
    );

    expect(realised.title).toBe('E♭ Harmonic Minor');
    expect(realised.tonicNote).toEqual({ letter: 'E', alter: -1 });
    // Notated with the natural-minor signature: six flats.
    expect(realised.fifths).toBe(-6);

    expect(pitchNames(rightPart(realised))).toEqual([
      'E♭4',
      'F4',
      'G♭4',
      'A♭4',
      'B♭4',
      'C♭5',
      'D5',
      'E♭5',
    ]);

    // The raised seventh is a plain D, not a D flat and not a C double sharp.
    const seventh = notesOf(rightPart(realised))[6];
    expect(seventh?.pitch.letter).toBe('D');
    expect(seventh?.pitch.alter).toBe(0);
  });

  it('keeps the correct spelling in every octave of a multi-octave run', () => {
    const realised = realiseExercise(
      exercise({ tonic: 3, scaleTypeId: 'harmonicMinor', octaves: 2, direction: 'both' }),
    );
    const notes = notesOf(rightPart(realised));
    expect(notes).toHaveLength(29);
    // Both D naturals on the way up, and both on the way down.
    const naturalDs = notes.filter((n) => n.pitch.letter === 'D' && n.pitch.alter === 0);
    expect(naturalDs).toHaveLength(4);
    expect(notes.every((n) => Math.abs(n.pitch.alter) <= 2)).toBe(true);
  });

  it('writes the double sharp G♯ harmonic minor genuinely contains', () => {
    const realised = realiseExercise(
      exercise({ tonic: 8, scaleTypeId: 'harmonicMinor', octaves: 1 }),
    );
    expect(realised.title).toBe('G♯ Harmonic Minor');
    expect(
      notesOf(rightPart(realised)).some((n) => n.pitch.letter === 'F' && n.pitch.alter === 2),
    ).toBe(true);
  });

  it('descends melodic minor as the natural minor', () => {
    const realised = realiseExercise(
      exercise({ tonic: 0, scaleTypeId: 'melodicMinor', octaves: 1, direction: 'both' }),
    );
    expect(pitchNames(rightPart(realised))).toEqual([
      'C4',
      'D4',
      'E♭4',
      'F4',
      'G4',
      'A4',
      'B4',
      'C5',
      'B♭4',
      'A♭4',
      'G4',
      'F4',
      'E♭4',
      'D4',
      'C4',
    ]);
  });

  it('spells chromatic scales with sharps up and flats down', () => {
    const realised = realiseExercise(
      exercise({ scaleTypeId: 'chromatic', octaves: 1, direction: 'both' }),
    );
    const names = pitchNames(rightPart(realised));
    expect(names.slice(0, 13)).toEqual([
      'C4',
      'C♯4',
      'D4',
      'D♯4',
      'E4',
      'F4',
      'F♯4',
      'G4',
      'G♯4',
      'A4',
      'A♯4',
      'B4',
      'C5',
    ]);
    expect(names.slice(13)).toEqual([
      'B4',
      'B♭4',
      'A4',
      'A♭4',
      'G4',
      'G♭4',
      'F4',
      'E4',
      'E♭4',
      'D4',
      'D♭4',
      'C4',
    ]);
    // A chromatic scale carries no key signature.
    expect(realised.fifths).toBe(0);
  });

  it('reports the scale type and name for every family and mode', () => {
    for (const scaleTypeId of [...SCALE_FAMILY_IDS, ...MODE_IDS]) {
      const realised = realiseExercise(exercise({ scaleTypeId }));
      expect(scaleTypeOf(realised).id).toBe(scaleTypeId);
      expect(realised.title).toContain(scaleTypeOf(realised).name);
      expect(realised.exercise).toMatchObject({ kind: 'scale', scaleTypeId });
    }
  });
});

// ---------------------------------------------------------------------------
// Fingering
// ---------------------------------------------------------------------------

describe('realiseExercise — fingering', () => {
  it('fingers a two-octave C major right hand', () => {
    const realised = realiseExercise(exercise({ octaves: 2, direction: 'ascending' }));
    expect(realised.hasFingering).toBe(true);
    expect(fingers(rightPart(realised))).toEqual([
      1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5,
    ]);
  });

  it('fingers a descending-only run as the ascending fingering reversed', () => {
    const up = realiseExercise(exercise({ octaves: 2, direction: 'ascending' }));
    const down = realiseExercise(exercise({ octaves: 2, direction: 'descending' }));
    expect(fingers(rightPart(down))).toEqual([...fingers(rightPart(up))].reverse());
    expect(fingers(rightPart(down))).toEqual([5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]);
  });

  it('fingers a one-octave C major left hand', () => {
    const realised = realiseExercise(exercise({ octaves: 1 }));
    expect(fingers(partFor(realised, 'left'))).toEqual([5, 4, 3, 2, 1, 3, 2, 1]);
  });

  it('reuses the ascending fingering backwards for the return leg, sharing the turning finger', () => {
    const both = realiseExercise(exercise({ octaves: 2, direction: 'both' }));
    const up = fingers(rightPart(realiseExercise(exercise({ octaves: 2, direction: 'ascending' }))));

    expect(fingers(rightPart(both))).toEqual([...up, ...[...up].reverse().slice(1)]);
    expect(fingers(rightPart(both))).toHaveLength(29);
    // The 5 on the top note is written once, at the turn.
    expect(fingers(rightPart(both)).filter((f) => f === 5)).toHaveLength(1);
  });

  it('gives every note a finger from 1 to 5, never repeating on adjacent notes', () => {
    for (const scaleTypeId of ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor', 'chromatic'] as const) {
      for (const tonic of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const) {
        for (const direction of DIRECTION_OPTIONS) {
          const realised = realiseExercise(
            exercise({ tonic, scaleTypeId, octaves: 2, direction }),
          );
          expect(realised.hasFingering).toBe(true);
          for (const part of realised.parts) {
            const list = fingers(part);
            expect(list.every((f) => f !== null && f >= 1 && f <= 5)).toBe(true);
            list.slice(1).forEach((f, index) => {
              expect(f).not.toBe(list[index]);
            });
          }
        }
      }
    }
  });

  it('reports no fingering, and no fingers, for a mode with no curated set', () => {
    for (const scaleTypeId of ['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'] as const) {
      const realised = realiseExercise(exercise({ scaleTypeId, octaves: 2 }));
      expect(scaleTypeOf(realised).fingeringSet).toBeNull();
      expect(realised.hasFingering).toBe(false);
      for (const part of realised.parts) {
        expect(fingers(part).every((f) => f === null)).toBe(true);
      }
    }
  });

  it('fingers Ionian as major and Aeolian as natural minor', () => {
    const majorRealised = realiseExercise(exercise({ octaves: 2 }));
    const ionian = realiseExercise(exercise({ scaleTypeId: 'ionian', octaves: 2 }));
    expect(fingers(rightPart(ionian))).toEqual(fingers(rightPart(majorRealised)));
    expect(ionian.hasFingering).toBe(true);

    const naturalMinor = realiseExercise(exercise({ scaleTypeId: 'naturalMinor', octaves: 2 }));
    const aeolian = realiseExercise(exercise({ scaleTypeId: 'aeolian', octaves: 2 }));
    expect(fingers(rightPart(aeolian))).toEqual(fingers(rightPart(naturalMinor)));
    expect(aeolian.hasFingering).toBe(true);
  });

  it('fingers both hands of a contrary-motion exercise', () => {
    const realised = realiseExercise(
      exercise({ motion: 'contrary', octaves: 2, direction: 'both' }),
    );
    expect(realised.hasFingering).toBe(true);
    // The left hand descends first, so its fingering starts from the top of its
    // own range: the reverse of the fingering it would use ascending.
    const left = partFor(realised, 'left');
    expect(fingers(left)[0]).toBe(1);
    expect(fingers(left).filter((f) => f === 5)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Description
// ---------------------------------------------------------------------------

describe('describeExercise', () => {
  it('describes a contrary exercise in full', () => {
    expect(
      describeExercise(exercise({ motion: 'contrary', octaves: 2, direction: 'both' })),
    ).toEqual(['Both Hands', 'Contrary Motion', '2 Octaves', 'Ascending & Descending']);
  });

  it('always gives four lines, naming both hands and the motion every time', () => {
    expect(describeExercise(exercise({}))).toEqual([
      'Both Hands',
      'Similar Motion',
      '1 Octave',
      'Ascending',
    ]);
    expect(describeExercise(exercise({ direction: 'descending' }))).toEqual([
      'Both Hands',
      'Similar Motion',
      '1 Octave',
      'Descending',
    ]);
    expect(describeExercise(exercise({ octaves: 4 }))).toEqual([
      'Both Hands',
      'Similar Motion',
      '4 Octaves',
      'Ascending',
    ]);
  });

  it('singularises one octave and pluralises the rest', () => {
    const octaveLine = (octaves: OctaveCount): string | undefined =>
      describeExercise(exercise({ octaves }))[2];
    expect(octaveLine(1)).toBe('1 Octave');
    expect(octaveLine(2)).toBe('2 Octaves');
    expect(octaveLine(3)).toBe('3 Octaves');
    expect(octaveLine(4)).toBe('4 Octaves');
  });

  it('uses the agreed wording for every option', () => {
    const directionLine = (direction: DirectionOption): string | undefined =>
      describeExercise(exercise({ direction }))[3];
    expect(directionLine('ascending')).toBe('Ascending');
    expect(directionLine('descending')).toBe('Descending');
    expect(directionLine('both')).toBe('Ascending & Descending');

    expect(describeExercise(exercise({ motion: 'similar' }))[1]).toBe('Similar Motion');
    expect(describeExercise(exercise({ motion: 'contrary' }))[1]).toBe('Contrary Motion');

    for (const motion of MOTION_OPTIONS) {
      expect(describeExercise(exercise({ motion }))[0]).toBe('Both Hands');
    }
  });

  it('never mentions the key or scale type — those are shown separately', () => {
    const lines = describeExercise(exercise({ tonic: 3, scaleTypeId: 'harmonicMinor' }));
    expect(lines.join(' ')).not.toMatch(/minor|E♭/i);
  });

  it('names the version in minor, where the two versions really differ', () => {
    expect(describeExercise(ruleOfOctave({ mode: 'minor' }))).toEqual([
      'Rule of the Octave',
      'Fenaroli',
      'First Position',
    ]);
    expect(
      describeExercise(ruleOfOctave({ mode: 'minor', version: 'campion', position: 2 })),
    ).toEqual(['Rule of the Octave', 'Campion', 'Second Position']);
    expect(describeExercise(ruleOfOctave({ mode: 'minor', position: 3 }))).toEqual([
      'Rule of the Octave',
      'Fenaroli',
      'Third Position',
    ]);
  });

  it('leaves the version out in major, where naming it would claim a difference that is not there', () => {
    // Campion's major rule is Fenaroli's, figure for figure. Printing either
    // name over the same notes would be a small lie.
    expect(describeExercise(ruleOfOctave({ mode: 'major' }))).toEqual([
      'Rule of the Octave',
      'First Position',
    ]);
    expect(
      describeExercise(ruleOfOctave({ mode: 'major', version: 'campion', position: 3 })),
    ).toEqual(['Rule of the Octave', 'Third Position']);

    // …and the two versions are therefore described identically in major, which
    // is exactly what "the same exercise" means.
    for (const position of ROO_POSITIONS) {
      expect(describeExercise(ruleOfOctave({ mode: 'major', version: 'campion', position }))).toEqual(
        describeExercise(ruleOfOctave({ mode: 'major', version: 'fenaroli', position })),
      );
    }
  });

  it('mentions a version only where distinctVersionsFor says the versions differ', () => {
    // Stated as the rule rather than as "major has no version line", so that a
    // third version differing in major starts naming itself with no edit here.
    for (const mode of ['major', 'minor'] as const) {
      const differ = distinctVersionsFor(mode, ROO_VERSION_IDS).length > 1;
      for (const version of ROO_VERSION_IDS) {
        for (const position of ROO_POSITIONS) {
          const lines = describeExercise(ruleOfOctave({ version, position, mode }));
          expect(lines).toHaveLength(differ ? 3 : 2);
          expect(lines.includes('Fenaroli') || lines.includes('Campion')).toBe(differ);
        }
      }
    }
  });

  it('gives every version and position of the rule its position and no scale wording', () => {
    for (const version of ROO_VERSION_IDS) {
      for (const position of ROO_POSITIONS) {
        for (const mode of ['major', 'minor'] as const) {
          const lines = describeExercise(ruleOfOctave({ version, position, mode }));
          expect(lines[0]).toBe('Rule of the Octave');
          expect(lines[lines.length - 1]).toBe(
            { 1: 'First Position', 2: 'Second Position', 3: 'Third Position' }[position],
          );
          // Hands, octaves and direction are fixed by the rule, so saying them
          // would be noise; the mode is part of the title, not a descriptor.
          expect(lines.join(' ')).not.toMatch(/hands|motion|ascending|descending|major|minor/i);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Whole-pool sanity
// ---------------------------------------------------------------------------

describe('realiseExercise — totality', () => {
  it('realises every scale type in every key without throwing', () => {
    const keys: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    for (const scaleTypeId of [...SCALE_FAMILY_IDS, ...MODE_IDS]) {
      for (const tonic of keys) {
        for (const direction of DIRECTION_OPTIONS) {
          const realised = realiseExercise(
            exercise({ tonic, scaleTypeId, octaves: 2, direction }),
          );
          expect(realised.parts).toHaveLength(2);
          expect(realised.fifths).toBeGreaterThanOrEqual(-7);
          expect(realised.fifths).toBeLessThanOrEqual(7);
          for (const part of realised.parts) {
            expect(part.events.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});
