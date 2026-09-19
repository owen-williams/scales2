/**
 * The Rule of the Octave, tested as music rather than as a data structure.
 *
 * Two kinds of assertion carry the weight. The pinned tests write out C major
 * and C minor note for note, in both versions and all three positions, so that
 * the curated tables can be checked against Fenaroli's *Regole* and Campion's
 * plates by eye and stay checked. The invariant tests then sweep all 24 keys and
 * assert the things that make an exercise playable and engravable — correct
 * spelling, no voice under the bass, no two notes of a chord on the same line,
 * no leap a hand could not make — because those are what a rotation or a
 * transposition could silently break.
 */

import { describe, expect, it } from 'vitest';
import { formatPitch, letterIndex, midiOf, pitchClassOf } from '../pitch';
import { chooseTonicSpelling, keySignatureFifths, scaleDegrees } from '../scale';
import { SCALE_TYPES } from '../scaleTypes';
import { ROO_POSITIONS, ROO_VERSION_IDS } from '../types';
import type {
  Pitch,
  PitchClass,
  RuleOfOctaveExercise,
  RuleOfOctavePosition,
  RuleOfOctaveVersionId,
} from '../types';
import {
  ASCENDING_BASS_DEGREES,
  DESCENDING_BASS_DEGREES,
  EVENTS_PER_RULE,
  isRuleOfOctaveComplete,
  realiseRuleOfOctave,
  ROO_VERSIONS,
  RULE_OF_OCTAVE_VERSIONS,
  ruleOfOctaveTable,
} from './index';
import type { RuleOfOctaveModeTable } from './types';

const MODES = ['major', 'minor'] as const;
const ALL_TONICS: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function exercise(
  tonic: PitchClass,
  mode: 'major' | 'minor',
  version: RuleOfOctaveVersionId,
  position: RuleOfOctavePosition,
): RuleOfOctaveExercise {
  return { kind: 'ruleOfOctave', tonic, mode, version, position };
}

/** The realised exercise as two readable arrays: the bass, and the chords. */
function readable(e: RuleOfOctaveExercise): { bass: string[]; chords: string[] } {
  const { parts } = realiseRuleOfOctave(e);
  const [right, left] = parts;
  if (right === undefined || left === undefined) throw new Error('expected two parts');
  return {
    bass: left.events.map((event) => event.pitches.map(formatPitch).join(' ')),
    chords: right.events.map((event) => event.pitches.map(formatPitch).join(' ')),
  };
}

/** Every (version, mode, position) combination, for the sweeping tests. */
function everyVariant(): { version: RuleOfOctaveVersionId; mode: 'major' | 'minor'; position: RuleOfOctavePosition }[] {
  const out: { version: RuleOfOctaveVersionId; mode: 'major' | 'minor'; position: RuleOfOctavePosition }[] = [];
  for (const version of ROO_VERSION_IDS) {
    for (const mode of MODES) {
      for (const position of ROO_POSITIONS) out.push({ version, mode, position });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

describe('the version catalogue', () => {
  it('offers exactly the versions the exercise model names, in order', () => {
    expect(ROO_VERSIONS.map((v) => v.id)).toEqual([...ROO_VERSION_IDS]);
    expect(ROO_VERSIONS.map((v) => v.label)).toEqual(['Fenaroli', 'Campion']);
  });

  it('cites a source for every version', () => {
    for (const id of ROO_VERSION_IDS) {
      expect(RULE_OF_OCTAVE_VERSIONS[id].source).toMatch(/\d{4}/);
    }
  });

  it('has no uncorroborated degree in any shipped table', () => {
    for (const version of ROO_VERSION_IDS) {
      for (const mode of MODES) {
        expect(isRuleOfOctaveComplete(version, mode)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Table shape
// ---------------------------------------------------------------------------

describe('the curated tables', () => {
  const tables: { name: string; table: RuleOfOctaveModeTable }[] = [];
  for (const version of ROO_VERSION_IDS) {
    for (const mode of MODES) {
      tables.push({ name: `${version} ${mode}`, table: ruleOfOctaveTable(version, mode) });
    }
  }

  it.each(tables)('$name walks the scale up and back down', ({ table }) => {
    expect(table.ascending.map((row) => row?.bass)).toEqual([...ASCENDING_BASS_DEGREES]);
    expect(table.descending.map((row) => row?.bass)).toEqual([...DESCENDING_BASS_DEGREES]);
    expect(table.ascending.length + table.descending.length).toBe(EVENTS_PER_RULE);
  });

  it.each(tables)('$name gives every degree a figure and exactly three upper voices', ({ table }) => {
    for (const row of [...table.ascending, ...table.descending]) {
      expect(row).not.toBeNull();
      if (row === null) continue;
      expect(row.figure.length).toBeGreaterThan(0);
      expect(row.upper).toHaveLength(3);
      for (const voice of row.upper) {
        expect(voice.degree).toBeGreaterThanOrEqual(1);
        expect(voice.degree).toBeLessThanOrEqual(7);
        expect([-1, 0, 1]).toContain(voice.alter);
      }
    }
  });

  it.each(tables)('$name never sounds the same degree twice in one chord', ({ table }) => {
    // Two upper voices on one pitch class would collide the moment the voicing
    // is rotated, so the tables must not contain such a chord in the first
    // place. Campion's printed doubling of the third on two degrees is exactly
    // this shape, which is why campion.ts does not take it.
    for (const row of [...table.ascending, ...table.descending]) {
      if (row === null) continue;
      const seen = row.upper.map((voice) => `${String(voice.degree)}${String(voice.alter)}`);
      expect(new Set(seen).size).toBe(3);
    }
  });

  it('alters the bass only where minor raises the sixth and seventh going up', () => {
    for (const version of ROO_VERSION_IDS) {
      for (const mode of MODES) {
        const table = ruleOfOctaveTable(version, mode);
        const raised = table.ascending
          .filter((row) => row !== null && row.bassAlter !== 0)
          .map((row) => row?.bass);
        expect(raised).toEqual(mode === 'minor' ? [6, 7] : []);
        for (const row of table.descending) expect(row?.bassAlter).toBe(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// C major and C minor, pinned
// ---------------------------------------------------------------------------

const C_MAJOR_BASS = [
  'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4',
  'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3',
];

// Melodic ascending, natural descending: Fenaroli's "la sesta del tono si fa
// maggiore [salendo] e discendendo la settima del tono si fa minore".
const C_MINOR_BASS = [
  'C3', 'D3', 'E♭3', 'F3', 'G3', 'A3', 'B3', 'C4',
  'B♭3', 'A♭3', 'G3', 'F3', 'E♭3', 'D3', 'C3',
];

/**
 * Fenaroli in C major. Read the first position against his own text:
 * "3, 5, ed 8 · 3, 4 e 6 maggiore · 8, 3, e 6 · 6, [8,] 3 e 5 · 5, 8 e 3
 * maggiore · 6, 8 e 3 · 5 falsa, 6, [8] e terza · 3, 5 ed 8 ‖ 3 e 6 [+8] ·
 * 4, 6 maggiore e 3 · 5, 8 e 3 maggiore · 6, 2 e quarta maggiore · 8, 3 e 6 ·
 * 3, 4 e 6 maggiore · 3, 5 ed 8".
 */
const FENAROLI_C_MAJOR: Readonly<Record<RuleOfOctavePosition, readonly string[]>> = {
  1: [
    'E4 G4 C5', 'F4 G4 B4', 'E4 G4 C5', 'D4 A4 C5', 'D4 G4 B4', 'F4 A4 C5', 'F4 G4 D5',
    'E4 G4 C5',
    'D4 G4 B4', 'D4 F♯4 C5', 'D4 G4 B4', 'D4 G4 B4', 'E4 G4 C5', 'F4 G4 B4', 'E4 G4 C5',
  ],
  2: [
    'G4 C5 E5', 'G4 B4 F5', 'G4 C5 E5', 'A4 C5 D5', 'G4 B4 D5', 'A4 C5 F5', 'G4 D5 F5',
    'G4 C5 E5',
    'G4 B4 D5', 'F♯4 C5 D5', 'G4 B4 D5', 'G4 B4 D5', 'G4 C5 E5', 'G4 B4 F5', 'G4 C5 E5',
  ],
  3: [
    'C5 E5 G5', 'B4 F5 G5', 'C5 E5 G5', 'C5 D5 A5', 'B4 D5 G5', 'C5 F5 A5', 'D5 F5 G5',
    'C5 E5 G5',
    'B4 D5 G5', 'C5 D5 F♯5', 'B4 D5 G5', 'B4 D5 G5', 'C5 E5 G5', 'B4 F5 G5', 'C5 E5 G5',
  ],
};

/** Fenaroli in C minor: the augmented sixth (A♭ against F♯) at slot 10. */
const FENAROLI_C_MINOR: Readonly<Record<RuleOfOctavePosition, readonly string[]>> = {
  1: [
    'E♭4 G4 C5', 'F4 G4 B4', 'E♭4 G4 C5', 'D4 A♭4 C5', 'D4 G4 B4', 'F4 A4 C5', 'F4 G4 D5',
    'E♭4 G4 C5',
    'D4 G4 B♭4', 'D4 F♯4 C5', 'D4 G4 B4', 'D4 G4 B4', 'E♭4 G4 C5', 'F4 G4 B4', 'E♭4 G4 C5',
  ],
  2: [
    'G4 C5 E♭5', 'G4 B4 F5', 'G4 C5 E♭5', 'A♭4 C5 D5', 'G4 B4 D5', 'A4 C5 F5', 'G4 D5 F5',
    'G4 C5 E♭5',
    'G4 B♭4 D5', 'F♯4 C5 D5', 'G4 B4 D5', 'G4 B4 D5', 'G4 C5 E♭5', 'G4 B4 F5', 'G4 C5 E♭5',
  ],
  3: [
    'C5 E♭5 G5', 'B4 F5 G5', 'C5 E♭5 G5', 'C5 D5 A♭5', 'B4 D5 G5', 'C5 F5 A5', 'D5 F5 G5',
    'C5 E♭5 G5',
    'B♭4 D5 G5', 'C5 D5 F♯5', 'B4 D5 G5', 'B4 D5 G5', 'C5 E♭5 G5', 'B4 F5 G5', 'C5 E♭5 G5',
  ],
};

/** Campion in C minor: a plain four-three (A♭ against F♮) at slot 10. */
const CAMPION_C_MINOR: Readonly<Record<RuleOfOctavePosition, readonly string[]>> = {
  1: FENAROLI_C_MINOR[1].map((chord, i) => (i === 9 ? 'D4 F4 C5' : chord)),
  2: FENAROLI_C_MINOR[2].map((chord, i) => (i === 9 ? 'F4 C5 D5' : chord)),
  3: FENAROLI_C_MINOR[3].map((chord, i) => (i === 9 ? 'C5 D5 F5' : chord)),
};

describe('C major and C minor, note for note', () => {
  it.each(ROO_POSITIONS)('Fenaroli, C major, position %i', (position) => {
    const { bass, chords } = readable(exercise(0, 'major', 'fenaroli', position));
    expect(bass).toEqual(C_MAJOR_BASS);
    expect(chords).toEqual([...FENAROLI_C_MAJOR[position]]);
  });

  it.each(ROO_POSITIONS)('Fenaroli, C minor, position %i', (position) => {
    const { bass, chords } = readable(exercise(0, 'minor', 'fenaroli', position));
    expect(bass).toEqual(C_MINOR_BASS);
    expect(chords).toEqual([...FENAROLI_C_MINOR[position]]);
  });

  it.each(ROO_POSITIONS)('Campion, C major, position %i', (position) => {
    const { bass, chords } = readable(exercise(0, 'major', 'campion', position));
    expect(bass).toEqual(C_MAJOR_BASS);
    // Campion 1716 and Fenaroli 1775 figure the major octave identically — the
    // point Heinichen made in 1728 when he found three nations agreeing.
    expect(chords).toEqual([...FENAROLI_C_MAJOR[position]]);
  });

  it.each(ROO_POSITIONS)('Campion, C minor, position %i', (position) => {
    const { bass, chords } = readable(exercise(0, 'minor', 'campion', position));
    expect(bass).toEqual(C_MINOR_BASS);
    expect(chords).toEqual([...CAMPION_C_MINOR[position]]);
  });
});

describe('where the two versions part company', () => {
  it('agree everywhere in major, in every key and position', () => {
    for (const tonic of ALL_TONICS) {
      for (const position of ROO_POSITIONS) {
        expect(readable(exercise(tonic, 'major', 'campion', position))).toEqual(
          readable(exercise(tonic, 'major', 'fenaroli', position)),
        );
      }
    }
  });

  it('differ in minor at the descending sixth degree, and only there', () => {
    for (const tonic of ALL_TONICS) {
      for (const position of ROO_POSITIONS) {
        const fen = readable(exercise(tonic, 'minor', 'fenaroli', position));
        const cam = readable(exercise(tonic, 'minor', 'campion', position));
        expect(cam.bass).toEqual(fen.bass);
        const differing = fen.chords
          .map((chord, index) => (chord === cam.chords[index] ? null : index))
          .filter((index) => index !== null);
        expect(differing).toEqual([9]);
      }
    }
  });

  it("Fenaroli's descending sixth is an augmented sixth, Campion's a plain fourth", () => {
    // C minor, first position, slot 10: the bass is A♭ in both readings.
    const fen = readable(exercise(0, 'minor', 'fenaroli', 1));
    const cam = readable(exercise(0, 'minor', 'campion', 1));
    expect(fen.bass[9]).toBe('A♭3');
    expect(cam.bass[9]).toBe('A♭3');
    expect(fen.chords[9]).toBe('D4 F♯4 C5');
    expect(cam.chords[9]).toBe('D4 F4 C5');
  });
});

// ---------------------------------------------------------------------------
// Shape of the realised exercise
// ---------------------------------------------------------------------------

describe('the realised exercise', () => {
  it.each(everyVariant())(
    'is fifteen events in both hands ($version $mode, position $position)',
    ({ version, mode, position }) => {
      for (const tonic of ALL_TONICS) {
        const { parts } = realiseRuleOfOctave(exercise(tonic, mode, version, position));
        expect(parts).toHaveLength(2);
        const [right, left] = parts;
        expect(right?.hand).toBe('right');
        expect(left?.hand).toBe('left');
        expect(right?.events).toHaveLength(EVENTS_PER_RULE);
        expect(left?.events).toHaveLength(EVENTS_PER_RULE);
        expect(EVENTS_PER_RULE).toBe(15);
        for (const event of left?.events ?? []) expect(event.pitches).toHaveLength(1);
        for (const event of right?.events ?? []) expect(event.pitches).toHaveLength(3);
      }
    },
  );

  it('carries no fingering, one null per pitch', () => {
    for (const { version, mode, position } of everyVariant()) {
      const { parts } = realiseRuleOfOctave(exercise(0, mode, version, position));
      for (const part of parts) {
        for (const event of part.events) {
          expect(event.fingers).toHaveLength(event.pitches.length);
          expect(event.fingers.every((finger) => finger === null)).toBe(true);
        }
      }
    }
  });

  it('names the key the way the rest of the app does', () => {
    // The tonic spelling is the one the scales choose, so a key is called the
    // same thing whichever exercise it turns up in.
    expect(realiseRuleOfOctave(exercise(3, 'minor', 'fenaroli', 1)).title).toBe(
      'E♭ Minor — Rule of the Octave',
    );
    expect(realiseRuleOfOctave(exercise(8, 'minor', 'fenaroli', 1)).title).toBe(
      'G♯ Minor — Rule of the Octave',
    );
    expect(realiseRuleOfOctave(exercise(1, 'major', 'campion', 2)).title).toBe(
      'D♭ Major — Rule of the Octave',
    );
    expect(realiseRuleOfOctave(exercise(6, 'major', 'campion', 3)).title).toBe(
      'F♯ Major — Rule of the Octave',
    );
  });

  it('signs the key the way the scales do', () => {
    for (const tonic of ALL_TONICS) {
      for (const mode of MODES) {
        const scaleType = mode === 'major' ? SCALE_TYPES.major : SCALE_TYPES.naturalMinor;
        const expected = keySignatureFifths(chooseTonicSpelling(tonic, scaleType), scaleType);
        expect(realiseRuleOfOctave(exercise(tonic, mode, 'fenaroli', 1)).fifths).toBe(expected);
      }
    }
  });

  it('reports every shipped table as complete', () => {
    for (const { id } of ROO_VERSIONS) {
      for (const mode of MODES) {
        expect(isRuleOfOctaveComplete(id, mode), `${id} ${mode}`).toBe(true);
      }
    }
  });

  it('refuses to realise a table with an uncorroborated degree', () => {
    // `RuleRow` is nullable so a curator can leave an honest hole rather than
    // invent a chord. No shipped table has one, so the guard can only be
    // exercised by punching one in — otherwise this asserts nothing, which is
    // exactly what an earlier version of this test did.
    // (That the *pool* also declines to offer a holed version is asserted in
    // `exercise.test.ts`, where the settings layer belongs.)
    const table = ruleOfOctaveTable('fenaroli', 'major') as unknown as {
      descending: (RuleOfOctaveModeTable['descending'][number] | null)[];
    };
    const original = table.descending[1] ?? null;
    table.descending[1] = null;

    try {
      expect(isRuleOfOctaveComplete('fenaroli', 'major')).toBe(false);
      expect(() => realiseRuleOfOctave(exercise(0, 'major', 'fenaroli', 1))).toThrow(
        /No curated Rule of the Octave chord/,
      );
    } finally {
      table.descending[1] = original;
    }

    expect(isRuleOfOctaveComplete('fenaroli', 'major')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The bass really is the scale
// ---------------------------------------------------------------------------

describe('the bass', () => {
  it.each(everyVariant())(
    'is the scale up then down with the upper tonic written once ($version $mode)',
    ({ version, mode, position }) => {
      for (const tonic of ALL_TONICS) {
        const { parts } = realiseRuleOfOctave(exercise(tonic, mode, version, position));
        const bass = (parts[1]?.events ?? []).map((event) => event.pitches[0]);
        const pitches = bass.filter((pitch): pitch is Pitch => pitch !== undefined);
        expect(pitches).toHaveLength(15);

        const first = pitches[0];
        const peak = pitches[7];
        const last = pitches[14];
        if (first === undefined || peak === undefined || last === undefined) throw new Error('x');

        // Starts and ends on the same tonic; turns at the tonic an octave up.
        expect(formatPitch(last)).toBe(formatPitch(first));
        expect(peak.letter).toBe(first.letter);
        expect(peak.octave).toBe(first.octave + 1);
        // The turning note is written once: no repeat across the join.
        expect(formatPitch(pitches[8] ?? peak)).not.toBe(formatPitch(peak));

        // Every step is one letter, up for the first half and down for the second.
        const step = (a: Pitch, b: Pitch) =>
          letterIndex(b.letter) + 7 * b.octave - (letterIndex(a.letter) + 7 * a.octave);
        for (let i = 0; i < 7; i += 1) expect(step(pitches[i]!, pitches[i + 1]!)).toBe(1);
        for (let i = 7; i < 14; i += 1) expect(step(pitches[i]!, pitches[i + 1]!)).toBe(-1);
      }
    },
  );

  it('raises the sixth and seventh going up in minor and lowers them coming down', () => {
    for (const tonic of ALL_TONICS) {
      const { parts } = realiseRuleOfOctave(exercise(tonic, 'minor', 'fenaroli', 1));
      const bass = (parts[1]?.events ?? []).map((event) => event.pitches[0]!);
      const natural = scaleDegrees(
        chooseTonicSpelling(tonic, SCALE_TYPES.naturalMinor),
        SCALE_TYPES.naturalMinor,
        'ascending',
      );
      // Slots 6 and 7 (indices 5, 6) are the raised sixth and seventh.
      expect(bass[5]!.alter).toBe(natural[5]!.alter + 1);
      expect(bass[6]!.alter).toBe(natural[6]!.alter + 1);
      // Slots 9 and 10 (indices 8, 9) come back down unraised.
      expect(bass[8]!.alter).toBe(natural[6]!.alter);
      expect(bass[9]!.alter).toBe(natural[5]!.alter);
    }
  });
});

// ---------------------------------------------------------------------------
// The three positions
// ---------------------------------------------------------------------------

const pitchesOf = (e: RuleOfOctaveExercise): Pitch[][] => {
  const { parts } = realiseRuleOfOctave(e);
  return (parts[0]?.events ?? []).map((event) => [...event.pitches]);
};

describe('the three positions', () => {
  it('are rotations: same notes, different voice on top', () => {
    for (const version of ROO_VERSION_IDS) {
      for (const mode of MODES) {
        for (const tonic of ALL_TONICS) {
          const byPosition = ROO_POSITIONS.map((position) =>
            pitchesOf(exercise(tonic, mode, version, position)),
          );
          for (let event = 0; event < EVENTS_PER_RULE; event += 1) {
            const chords = byPosition.map((events) => events[event]!);
            // Identical multiset of pitch classes, event by event.
            const classes = chords.map((chord) =>
              chord.map((pitch) => pitchClassOf(pitch)).sort((a, b) => a - b).join(','),
            );
            expect(new Set(classes).size).toBe(1);
            // A different line on top in each position.
            const tops = chords.map((chord) => formatPitch(chord[chord.length - 1]!));
            expect(new Set(tops).size).toBe(3);
          }
        }
      }
    }
  });

  it('put the octave, the third and the fifth on top of the opening chord', () => {
    // Fenaroli: "la prima posizione è quella quando l'ottava sta da sopra; la
    // seconda quando la terza sta da sopra; e la terza quando la quinta sta da
    // sopra". His own example on the tonic is 3-5-8, 5-8-3, 8-3-5.
    for (const version of ROO_VERSION_IDS) {
      for (const mode of MODES) {
        for (const tonic of ALL_TONICS) {
          const scaleType = mode === 'major' ? SCALE_TYPES.major : SCALE_TYPES.naturalMinor;
          const collection = scaleDegrees(
            chooseTonicSpelling(tonic, scaleType),
            scaleType,
            'ascending',
          );
          const expectedTop = [collection[0]!, collection[2]!, collection[4]!];
          ROO_POSITIONS.forEach((position, index) => {
            const opening = pitchesOf(exercise(tonic, mode, version, position))[0]!;
            const top = opening[opening.length - 1]!;
            expect(pitchClassOf(top)).toBe(pitchClassOf(expectedTop[index]!));
          });
        }
      }
    }
  });

  it('rises by one chord tone from position to position', () => {
    for (const tonic of ALL_TONICS) {
      const [first, second, third] = ROO_POSITIONS.map((position) =>
        pitchesOf(exercise(tonic, 'major', 'fenaroli', position)),
      );
      for (let event = 0; event < EVENTS_PER_RULE; event += 1) {
        const lowest = (chords: Pitch[][]) => midiOf(chords[event]![0]!);
        const highest = (chords: Pitch[][]) => {
          const chord = chords[event]!;
          return midiOf(chord[chord.length - 1]!);
        };
        expect(lowest(second!)).toBeGreaterThan(lowest(first!));
        expect(lowest(third!)).toBeGreaterThan(lowest(second!));
        expect(highest(second!)).toBeGreaterThan(highest(first!));
        expect(highest(third!)).toBeGreaterThan(highest(second!));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Playable and engravable
// ---------------------------------------------------------------------------

/** Where a notehead sits on the stave, ignoring accidentals. */
const staffPosition = (pitch: Pitch): number => pitch.octave * 7 + letterIndex(pitch.letter);

describe('every chord in all 24 keys', () => {
  it('puts no two notes on the same line or space', () => {
    // The notation layer refuses to engrave two notes of one chord at the same
    // staff position, and a voicing rotation is exactly the kind of thing that
    // could introduce one silently.
    for (const { version, mode, position } of everyVariant()) {
      for (const tonic of ALL_TONICS) {
        for (const chord of pitchesOf(exercise(tonic, mode, version, position))) {
          const positions = chord.map(staffPosition);
          expect(new Set(positions).size).toBe(chord.length);
          // Written low to high, which is what the MusicXML writer expects.
          expect([...positions].sort((a, b) => a - b)).toEqual(positions);
        }
      }
    }
  });

  it('keeps every upper voice above the bass', () => {
    for (const { version, mode, position } of everyVariant()) {
      for (const tonic of ALL_TONICS) {
        const { parts } = realiseRuleOfOctave(exercise(tonic, mode, version, position));
        const right = parts[0]?.events ?? [];
        const left = parts[1]?.events ?? [];
        const highestBass = Math.max(...left.map((event) => staffPosition(event.pitches[0]!)));
        right.forEach((event, index) => {
          const bass = left[index]!.pitches[0]!;
          for (const pitch of event.pitches) {
            expect(staffPosition(pitch)).toBeGreaterThan(staffPosition(bass));
            // And above the whole bass line, so the hands never interleave.
            expect(staffPosition(pitch)).toBeGreaterThan(highestBass);
          }
        });
      }
    }
  });

  it('stays inside a sensible keyboard range', () => {
    // C2 (36) to C7 (96): the bass never gets growly, the top voice of the
    // third position in the sharpest key never leaves the instrument.
    for (const { version, mode, position } of everyVariant()) {
      for (const tonic of ALL_TONICS) {
        const { parts } = realiseRuleOfOctave(exercise(tonic, mode, version, position));
        for (const part of parts) {
          for (const event of part.events) {
            for (const pitch of event.pitches) {
              expect(midiOf(pitch)).toBeGreaterThanOrEqual(36);
              expect(midiOf(pitch)).toBeLessThanOrEqual(96);
            }
          }
        }
      }
    }
  });

  it('never leaps an upper voice more than an octave', () => {
    for (const { version, mode, position } of everyVariant()) {
      for (const tonic of ALL_TONICS) {
        const chords = pitchesOf(exercise(tonic, mode, version, position));
        for (let event = 1; event < chords.length; event += 1) {
          const before = chords[event - 1]!;
          const after = chords[event]!;
          for (let voice = 0; voice < 3; voice += 1) {
            expect(Math.abs(midiOf(after[voice]!) - midiOf(before[voice]!))).toBeLessThanOrEqual(12);
          }
        }
      }
    }
  });

  it('spans no more than a tenth in one hand', () => {
    for (const { version, mode, position } of everyVariant()) {
      for (const tonic of ALL_TONICS) {
        for (const chord of pitchesOf(exercise(tonic, mode, version, position))) {
          const span = midiOf(chord[chord.length - 1]!) - midiOf(chord[0]!);
          expect(span).toBeLessThanOrEqual(16);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Spelling
// ---------------------------------------------------------------------------

describe('spelling in all 24 keys', () => {
  it('never needs a triple accidental', () => {
    for (const { version, mode, position } of everyVariant()) {
      for (const tonic of ALL_TONICS) {
        const { parts } = realiseRuleOfOctave(exercise(tonic, mode, version, position));
        for (const part of parts) {
          for (const event of part.events) {
            for (const pitch of event.pitches) {
              expect(Math.abs(pitch.alter)).toBeLessThanOrEqual(2);
            }
          }
        }
      }
    }
  });

  it('stays inside the key, and raises only the degrees the tables raise', () => {
    // Every note is a degree of the key's own collection, either untouched or
    // sharpened by exactly a semitone; nothing is ever flattened, and only the
    // fourth, sixth and seventh degrees are ever touched at all — the
    // sharpened fourth of the descending sixth's chord, and the melodic minor's
    // raised sixth and seventh.
    //
    // The exception states the difference between the two versions exactly:
    // Campion's minor never sharpens the fourth degree, because his descending
    // sixth is a plain four-three rather than an augmented sixth.
    const expectedRaised = (version: RuleOfOctaveVersionId, mode: 'major' | 'minor'): number[] => {
      if (mode === 'major') return [4];
      return version === 'campion' ? [6, 7] : [4, 6, 7];
    };
    for (const { version, mode, position } of everyVariant()) {
      for (const tonic of ALL_TONICS) {
        const scaleType = mode === 'major' ? SCALE_TYPES.major : SCALE_TYPES.naturalMinor;
        const collection = scaleDegrees(
          chooseTonicSpelling(tonic, scaleType),
          scaleType,
          'ascending',
        );
        const raisedDegrees = new Set<number>();

        const { parts } = realiseRuleOfOctave(exercise(tonic, mode, version, position));
        for (const part of parts) {
          for (const event of part.events) {
            for (const pitch of event.pitches) {
              const degree = collection.findIndex((note) => note.letter === pitch.letter);
              expect(degree).toBeGreaterThanOrEqual(0);
              const lift = pitch.alter - collection[degree]!.alter;
              expect([0, 1]).toContain(lift);
              if (lift === 1) raisedDegrees.add(degree + 1);
            }
          }
        }
        expect([...raisedDegrees].sort((a, b) => a - b)).toEqual(expectedRaised(version, mode));
      }
    }
  });

  it('spells the awkward keys the way a musician would', () => {
    // E♭ minor's descending sixth is C♭, and the augmented sixth over it wants
    // the raised fourth, A♮ — not the B𝄫/A♯ an enharmonic shortcut would give.
    const eFlatMinor = readable(exercise(3, 'minor', 'fenaroli', 1));
    expect(eFlatMinor.bass[9]).toBe('C♭4');
    expect(eFlatMinor.chords[9]).toBe('F4 A4 E♭5');

    // G♯ minor genuinely contains double sharps: F𝄪 as the leading tone and
    // C𝄪 as the raised fourth of the augmented sixth.
    const gSharpMinor = readable(exercise(8, 'minor', 'fenaroli', 1));
    expect(gSharpMinor.bass[6]).toBe('F𝄪4');
    expect(gSharpMinor.chords[9]).toBe('A♯4 C𝄪5 G♯5');

    // F♯ major's descending sixth needs B♯, the sharpened fourth degree.
    const fSharpMajor = readable(exercise(6, 'major', 'fenaroli', 1));
    expect(fSharpMajor.chords[9]).toBe('G♯4 B♯4 F♯5');
  });
});
