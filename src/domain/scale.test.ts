import { describe, expect, it } from 'vitest';

import { formatNote, formatPitch, midiOf, pitchClassOf } from './pitch';
import { buildRun, chooseTonicSpelling, keySignatureFifths, scaleDegrees, scaleName } from './scale';
import { MODES, SCALE_FAMILIES, SCALE_TYPES, getScaleType } from './scaleTypes';
import { MODE_IDS, SCALE_FAMILY_IDS } from './types';
import type { Pitch, PitchClass, ScaleType, ScaleTypeId, SpelledNote } from './types';

const ALL_PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const ALL_SCALE_TYPES: readonly ScaleType[] = Object.values(SCALE_TYPES);

/** "E♭ F G♭ …" — the shape every spelling assertion below is written in. */
const spell = (notes: readonly SpelledNote[]): string => notes.map(formatNote).join(' ');
const spellRun = (pitches: readonly Pitch[]): string => pitches.map(formatPitch).join(' ');

/** The conventional tonic spellings of a scale type, pitch class 0 upward. */
const keyList = (id: ScaleTypeId): string =>
  ALL_PITCH_CLASSES.map((pc) => formatNote(chooseTonicSpelling(pc, getScaleType(id)))).join(' ');

const degreesOf = (
  tonicPc: PitchClass,
  id: ScaleTypeId,
  form: 'ascending' | 'descending' = 'ascending',
): string => {
  const scaleType = getScaleType(id);
  return spell(scaleDegrees(chooseTonicSpelling(tonicPc, scaleType), scaleType, form));
};

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

describe('SCALE_TYPES', () => {
  it('covers every family and mode id, keyed by its own id', () => {
    const ids: readonly ScaleTypeId[] = [...SCALE_FAMILY_IDS, ...MODE_IDS];
    expect(Object.keys(SCALE_TYPES).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(getScaleType(id).id).toBe(id);
  });

  it('has seven-note diatonic formulae and a twelve-note chromatic one', () => {
    for (const scaleType of ALL_SCALE_TYPES) {
      const expected = scaleType.spelling === 'chromatic' ? 12 : 7;
      expect(scaleType.ascendingFormula).toHaveLength(expected);
      expect(scaleType.descendingFormula).toHaveLength(expected);
      expect(scaleType.signatureFormula).toHaveLength(7);
    }
  });

  it('starts every formula on the tonic and keeps it strictly ascending', () => {
    for (const scaleType of ALL_SCALE_TYPES) {
      for (const formula of [
        scaleType.ascendingFormula,
        scaleType.descendingFormula,
        scaleType.signatureFormula,
      ]) {
        expect(formula[0]).toBe(0);
        expect(formula.every((semitone, i) => i === 0 || semitone > (formula[i - 1] ?? -1))).toBe(
          true,
        );
        expect(formula.every((semitone) => semitone < 12)).toBe(true);
      }
    }
  });

  it('only melodic minor descends differently from how it ascends', () => {
    for (const scaleType of ALL_SCALE_TYPES) {
      const differs = spell(scaleDegrees({ letter: 'C', alter: 0 }, scaleType, 'ascending')) !==
        spell(scaleDegrees({ letter: 'C', alter: 0 }, scaleType, 'descending'));
      expect(differs).toBe(scaleType.id === 'melodicMinor' || scaleType.id === 'chromatic');
      if (scaleType.id !== 'melodicMinor') {
        expect(scaleType.descendingFormula).toEqual(scaleType.ascendingFormula);
      }
    }
  });

  it('notates harmonic and melodic minor with the natural minor signature', () => {
    for (const id of ['harmonicMinor', 'melodicMinor', 'aeolian'] as const) {
      expect(getScaleType(id).signatureFormula).toEqual(SCALE_TYPES.naturalMinor.signatureFormula);
    }
  });

  it('maps scales onto curated fingering sets by keyboard layout', () => {
    const sets = Object.fromEntries(
      ALL_SCALE_TYPES.map((scaleType) => [scaleType.id, scaleType.fingeringSet]),
    );
    expect(sets).toEqual({
      major: 'major',
      naturalMinor: 'minor',
      harmonicMinor: 'minor',
      melodicMinor: 'minor',
      chromatic: 'chromatic',
      ionian: 'major',
      dorian: null,
      phrygian: null,
      lydian: null,
      mixolydian: null,
      aeolian: 'minor',
      locrian: null,
    });
  });

  it('lists families and modes in display order', () => {
    expect(SCALE_FAMILIES.map((s) => s.id)).toEqual([...SCALE_FAMILY_IDS]);
    expect(MODES.map((s) => s.id)).toEqual([...MODE_IDS]);
    expect(SCALE_FAMILIES.every((s) => s.category === 'family')).toBe(true);
    expect(MODES.every((s) => s.category === 'mode')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tonic spelling
// ---------------------------------------------------------------------------

describe('chooseTonicSpelling', () => {
  it('produces the conventional major key list', () => {
    expect(keyList('major')).toBe('C D♭ D E♭ E F F♯ G A♭ A B♭ B');
  });

  it('produces the conventional minor key list for all three minors', () => {
    const expected = 'C C♯ D E♭ E F F♯ G G♯ A B♭ B';
    expect(keyList('naturalMinor')).toBe(expected);
    expect(keyList('harmonicMinor')).toBe(expected);
    expect(keyList('melodicMinor')).toBe(expected);
    // Aeolian is natural minor under another name.
    expect(keyList('aeolian')).toBe(expected);
  });

  it('spells chromatic tonics like major ones, so F♯ chromatic is not G♭', () => {
    expect(keyList('chromatic')).toBe('C D♭ D E♭ E F F♯ G A♭ A B♭ B');
  });

  it('scores harmonic and melodic minor on the natural minor signature', () => {
    // D♯ harmonic minor and E♭ harmonic minor both need six accidentals in
    // their key signature; the tie must not be decided by the raised seventh.
    expect(formatNote(chooseTonicSpelling(3, SCALE_TYPES.harmonicMinor))).toBe('E♭');
    expect(formatNote(chooseTonicSpelling(8, SCALE_TYPES.melodicMinor))).toBe('G♯');
  });

  it('chooses a spelling for every mode without exceeding double accidentals', () => {
    for (const mode of MODES) {
      for (const pc of ALL_PITCH_CLASSES) {
        const tonic = chooseTonicSpelling(pc, mode);
        expect(pitchClassOf(tonic)).toBe(pc);
        expect(Math.abs(tonic.alter)).toBeLessThanOrEqual(2);
      }
    }
  });

  /**
   * The full key list for every mode, not a handful of plain cases.
   *
   * Each mode has one pitch class where the two candidate spellings tie on six
   * accidentals — A♭ against G♯ in Dorian, B♭ against A♯ in Phrygian, and so on
   * — and a tie is settled by the order of `TONIC_CANDIDATES` rather than by the
   * scoring rule. Spot-checking the plain keys leaves every one of those
   * unpinned: the candidate order could be reversed and nothing would notice a
   * mode's tonic quietly becoming C♭ Lydian or E♯ Locrian.
   */
  it.each([
    ['ionian', 'C D♭ D E♭ E F F♯ G A♭ A B♭ B'],
    ['dorian', 'C C♯ D E♭ E F F♯ G A♭ A B♭ B'],
    ['phrygian', 'C C♯ D D♯ E F F♯ G G♯ A B♭ B'],
    ['lydian', 'C D♭ D E♭ E F G♭ G A♭ A B♭ B'],
    ['mixolydian', 'C D♭ D E♭ E F F♯ G A♭ A B♭ B'],
    ['aeolian', 'C C♯ D E♭ E F F♯ G G♯ A B♭ B'],
    ['locrian', 'C C♯ D D♯ E F F♯ G G♯ A A♯ B'],
  ] as const)('produces the conventional %s key list', (mode, expected) => {
    expect(keyList(mode)).toBe(expected);
  });

  it('returns a spelling of the requested pitch class for every scale type', () => {
    for (const scaleType of ALL_SCALE_TYPES) {
      for (const pc of ALL_PITCH_CLASSES) {
        expect(pitchClassOf(chooseTonicSpelling(pc, scaleType))).toBe(pc);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Textbook spellings
// ---------------------------------------------------------------------------

describe('scaleDegrees — textbook scales', () => {
  it('spells C major', () => {
    expect(degreesOf(0, 'major')).toBe('C D E F G A B');
  });

  it('spells F♯ major with an E♯', () => {
    expect(degreesOf(6, 'major')).toBe('F♯ G♯ A♯ B C♯ D♯ E♯');
  });

  it('spells G♭ major with a C♭', () => {
    const gFlat: SpelledNote = { letter: 'G', alter: -1 };
    expect(spell(scaleDegrees(gFlat, SCALE_TYPES.major, 'ascending'))).toBe(
      'G♭ A♭ B♭ C♭ D♭ E♭ F',
    );
  });

  it('spells E♭ harmonic minor', () => {
    expect(degreesOf(3, 'harmonicMinor')).toBe('E♭ F G♭ A♭ B♭ C♭ D');
  });

  it('spells G♯ harmonic minor with a genuine F double sharp', () => {
    expect(degreesOf(8, 'harmonicMinor')).toBe('G♯ A♯ B C♯ D♯ E F𝄪');
    const degrees = scaleDegrees(
      chooseTonicSpelling(8, SCALE_TYPES.harmonicMinor),
      SCALE_TYPES.harmonicMinor,
      'ascending',
    );
    expect(degrees.at(-1)).toEqual({ letter: 'F', alter: 2 });
  });

  it('spells C♯ melodic minor differently going up and coming down', () => {
    expect(degreesOf(1, 'melodicMinor', 'ascending')).toBe('C♯ D♯ E F♯ G♯ A♯ B♯');
    expect(degreesOf(1, 'melodicMinor', 'descending')).toBe('C♯ D♯ E F♯ G♯ A B');
  });

  it('spells the natural and harmonic minors on the same tonic', () => {
    expect(degreesOf(1, 'naturalMinor')).toBe('C♯ D♯ E F♯ G♯ A B');
    expect(degreesOf(1, 'harmonicMinor')).toBe('C♯ D♯ E F♯ G♯ A B♯');
  });

  it('spells D Dorian and B Locrian on white keys', () => {
    expect(degreesOf(2, 'dorian')).toBe('D E F G A B C');
    expect(degreesOf(11, 'locrian')).toBe('B C D E F G A');
  });

  it('spells C chromatic with sharps ascending and flats descending', () => {
    expect(degreesOf(0, 'chromatic', 'ascending')).toBe('C C♯ D D♯ E F F♯ G G♯ A A♯ B');
    expect(degreesOf(0, 'chromatic', 'descending')).toBe('C D♭ D E♭ E F G♭ G A♭ A B♭ B');
  });

  it('keeps the tonic spelling at degree 0 of a chromatic scale', () => {
    // The scale is "F♯ chromatic" in both directions, never "G♭ chromatic".
    expect(degreesOf(6, 'chromatic', 'ascending')).toBe('F♯ G G♯ A A♯ B C C♯ D D♯ E F');
    expect(degreesOf(6, 'chromatic', 'descending')).toBe('F♯ G G♯ A A♯ B C C♯ D D♯ E F');
    const gFlat: SpelledNote = { letter: 'G', alter: -1 };
    expect(scaleDegrees(gFlat, SCALE_TYPES.chromatic, 'ascending')[0]).toEqual(gFlat);
    expect(scaleDegrees(gFlat, SCALE_TYPES.chromatic, 'descending')[0]).toEqual(gFlat);
  });

  it('follows the tonic rather than the direction when the tonic is accidented', () => {
    // Sharps-ascending is a rule of thumb for natural tonics. Applied to D♭ it
    // would write D♭ D D♯ — three notes running on one letter — so an
    // accidented tonic keeps its own accidental in both directions.
    expect(degreesOf(1, 'chromatic', 'ascending')).toBe('D♭ D E♭ E F G♭ G A♭ A B♭ B C');
    expect(degreesOf(8, 'chromatic', 'ascending')).toBe('A♭ A B♭ B C D♭ D E♭ E F G♭ G');
    expect(degreesOf(3, 'chromatic', 'ascending')).toBe('E♭ E F G♭ G A♭ A B♭ B C D♭ D');
  });

  it('never repeats a letter three times running in any chromatic scale', () => {
    for (const pc of ALL_PITCH_CLASSES) {
      const tonic = chooseTonicSpelling(pc, SCALE_TYPES.chromatic);
      for (const form of ['ascending', 'descending'] as const) {
        const letters = scaleDegrees(tonic, SCALE_TYPES.chromatic, form).map((n) => n.letter);
        // Wrap around, since the scale continues into the next octave.
        for (let i = 0; i < letters.length; i += 1) {
          const run = [
            letters[i],
            letters[(i + 1) % letters.length],
            letters[(i + 2) % letters.length],
          ];
          expect(
            new Set(run).size,
            `${scaleName(tonic, SCALE_TYPES.chromatic)} ${form} repeats ${run[0]}`,
          ).toBeGreaterThan(1);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Spelling invariants across every scale type and key
// ---------------------------------------------------------------------------

describe('scaleDegrees — invariants over every scale type in all twelve keys', () => {
  for (const scaleType of ALL_SCALE_TYPES) {
    for (const pc of ALL_PITCH_CLASSES) {
      const tonic = chooseTonicSpelling(pc, scaleType);
      const name = `${scaleName(tonic, scaleType)}`;

      for (const form of ['ascending', 'descending'] as const) {
        const degrees = scaleDegrees(tonic, scaleType, form);
        const formula =
          form === 'ascending' ? scaleType.ascendingFormula : scaleType.descendingFormula;

        it(`${name} (${form}) sounds exactly the semitones in its formula`, () => {
          expect(degrees).toHaveLength(formula.length);
          degrees.forEach((degree, i) => {
            expect(pitchClassOf(degree)).toBe((pc + (formula[i] ?? -1)) % 12);
          });
        });

        it(`${name} (${form}) writes nothing beyond a double accidental`, () => {
          for (const degree of degrees) expect(Math.abs(degree.alter)).toBeLessThanOrEqual(2);
        });

        if (scaleType.spelling === 'diatonic') {
          it(`${name} (${form}) uses each of the seven letters exactly once`, () => {
            const letters = new Set(degrees.map((degree) => degree.letter));
            expect(letters.size).toBe(7);
            expect(degrees[0]?.letter).toBe(tonic.letter);
          });
        } else {
          it(`${name} (${form}) covers all twelve pitch classes`, () => {
            const classes = new Set(degrees.map(pitchClassOf));
            expect(classes.size).toBe(12);
          });
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Key signatures
// ---------------------------------------------------------------------------

describe('keySignatureFifths', () => {
  const fifthsFor = (pc: PitchClass, id: ScaleTypeId): number => {
    const scaleType = getScaleType(id);
    return keySignatureFifths(chooseTonicSpelling(pc, scaleType), scaleType);
  };

  it('walks the circle of fifths for the majors', () => {
    const fifths = ALL_PITCH_CLASSES.map((pc) => fifthsFor(pc, 'major'));
    //            C   D♭  D   E♭  E   F   F♯  G   A♭  A   B♭  B
    expect(fifths).toEqual([0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5]);
  });

  it('walks the circle of fifths for the minors', () => {
    const fifths = ALL_PITCH_CLASSES.map((pc) => fifthsFor(pc, 'naturalMinor'));
    //            C   C♯  D   E♭  E   F   F♯  G   G♯  A   B♭  B
    expect(fifths).toEqual([-3, 4, -1, -6, 1, -4, 3, -2, 5, 0, -5, 2]);
  });

  it('gives harmonic and melodic minor the natural minor signature', () => {
    for (const id of ['naturalMinor', 'harmonicMinor', 'melodicMinor'] as const) {
      expect(fifthsFor(3, id)).toBe(-6); // E♭ minor
      expect(fifthsFor(8, id)).toBe(5); // G♯ minor
      expect(fifthsFor(1, id)).toBe(4); // C♯ minor
    }
  });

  it('handles unconventional but legal spellings', () => {
    expect(keySignatureFifths({ letter: 'C', alter: -1 }, SCALE_TYPES.major)).toBe(-7);
    expect(keySignatureFifths({ letter: 'C', alter: 1 }, SCALE_TYPES.major)).toBe(7);
    expect(keySignatureFifths({ letter: 'A', alter: -1 }, SCALE_TYPES.naturalMinor)).toBe(-7);
  });

  it('gives a chromatic scale no key signature', () => {
    for (const pc of ALL_PITCH_CLASSES) expect(fifthsFor(pc, 'chromatic')).toBe(0);
  });

  it('signs the modes by their parent major collection', () => {
    expect(fifthsFor(2, 'dorian')).toBe(0); // D dorian = C major
    expect(fifthsFor(4, 'dorian')).toBe(2); // E dorian = D major
    expect(fifthsFor(11, 'locrian')).toBe(0); // B locrian = C major
    expect(fifthsFor(5, 'lydian')).toBe(0); // F lydian = C major
    expect(fifthsFor(0, 'lydian')).toBe(1); // C lydian = G major
    expect(fifthsFor(7, 'mixolydian')).toBe(0); // G mixolydian = C major
    expect(fifthsFor(4, 'phrygian')).toBe(0); // E phrygian = C major
    expect(fifthsFor(0, 'ionian')).toBe(0);
  });

  it('stays inside the seven-accidental key signatures for every chosen tonic', () => {
    for (const scaleType of ALL_SCALE_TYPES) {
      for (const pc of ALL_PITCH_CLASSES) {
        const fifths = keySignatureFifths(chooseTonicSpelling(pc, scaleType), scaleType);
        expect(fifths).toBeGreaterThanOrEqual(-7);
        expect(fifths).toBeLessThanOrEqual(7);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

describe('scaleName', () => {
  it('joins the spelled tonic to the scale type name', () => {
    expect(scaleName({ letter: 'E', alter: -1 }, SCALE_TYPES.harmonicMinor)).toBe(
      'E♭ Harmonic Minor',
    );
    expect(scaleName({ letter: 'C', alter: 0 }, SCALE_TYPES.dorian)).toBe('C Dorian');
    expect(scaleName({ letter: 'F', alter: 1 }, SCALE_TYPES.chromatic)).toBe('F♯ Chromatic');
    expect(scaleName({ letter: 'G', alter: 1 }, SCALE_TYPES.melodicMinor)).toBe('G♯ Melodic Minor');
  });
});

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

describe('buildRun', () => {
  const run = (
    pc: PitchClass,
    id: ScaleTypeId,
    octaves: number,
    startOctave: number,
    direction: 'up' | 'down',
  ): Pitch[] => {
    const scaleType = getScaleType(id);
    return buildRun({
      tonic: chooseTonicSpelling(pc, scaleType),
      scaleType,
      octaves,
      startOctave,
      direction,
    });
  };

  it('builds one octave of C major', () => {
    expect(spellRun(run(0, 'major', 1, 4, 'up'))).toBe('C4 D4 E4 F4 G4 A4 B4 C5');
  });

  it('increments the octave number when the letter wraps past B to C', () => {
    // A4 → B4 → C♯5: the number changes at C, not at the tonic.
    expect(spellRun(run(9, 'major', 1, 4, 'up'))).toBe('A4 B4 C♯5 D5 E5 F♯5 G♯5 A5');
    expect(spellRun(run(11, 'major', 1, 3, 'up'))).toBe('B3 C♯4 D♯4 E4 F♯4 G♯4 A♯4 B4');
  });

  it('numbers octaves by letter, not by sounding pitch', () => {
    // B♯3 sounds like C4 but is written in octave 3; C𝄪4 follows it.
    const bSharp = spellRun(
      buildRun({
        tonic: { letter: 'B', alter: 1 },
        scaleType: SCALE_TYPES.major,
        octaves: 1,
        startOctave: 3,
        direction: 'up',
      }),
    );
    expect(bSharp).toBe('B♯3 C𝄪4 D𝄪4 E♯4 F𝄪4 G𝄪4 A𝄪4 B♯4');

    // C♭4 sounds like B3 but stays in octave 4.
    const cFlat = spellRun(
      buildRun({
        tonic: { letter: 'C', alter: -1 },
        scaleType: SCALE_TYPES.major,
        octaves: 1,
        startOctave: 4,
        direction: 'up',
      }),
    );
    expect(cFlat).toBe('C♭4 D♭4 E♭4 F♭4 G♭4 A♭4 B♭4 C♭5');
  });

  it('repeats the pattern for multiple octaves', () => {
    const twoOctaves = run(0, 'major', 2, 4, 'up');
    expect(twoOctaves).toHaveLength(15);
    expect(spellRun(twoOctaves)).toBe('C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6');
  });

  it('descends from the top of the same range', () => {
    expect(spellRun(run(0, 'major', 1, 4, 'down'))).toBe('C5 B4 A4 G4 F4 E4 D4 C4');
    // startOctave always names the LOWEST tonic, whichever way the run goes.
    const down = run(0, 'major', 2, 3, 'down');
    expect(down[0]).toEqual({ letter: 'C', alter: 0, octave: 5 });
    expect(down.at(-1)).toEqual({ letter: 'C', alter: 0, octave: 3 });
  });

  it('descends melodic minor in its descending form', () => {
    expect(spellRun(run(1, 'melodicMinor', 1, 4, 'up'))).toBe(
      'C♯4 D♯4 E4 F♯4 G♯4 A♯4 B♯4 C♯5',
    );
    expect(spellRun(run(1, 'melodicMinor', 1, 4, 'down'))).toBe(
      'C♯5 B4 A4 G♯4 F♯4 E4 D♯4 C♯4',
    );
  });

  it('builds chromatic runs with sharps up and flats down', () => {
    expect(spellRun(run(0, 'chromatic', 1, 4, 'up'))).toBe(
      'C4 C♯4 D4 D♯4 E4 F4 F♯4 G4 G♯4 A4 A♯4 B4 C5',
    );
    expect(spellRun(run(0, 'chromatic', 1, 4, 'down'))).toBe(
      'C5 B4 B♭4 A4 A♭4 G4 G♭4 F4 E4 E♭4 D4 D♭4 C4',
    );
  });

  it('places a chromatic run whose tonic letter recurs inside the octave', () => {
    // Descending from B♯: the B natural sits below B♯4, not below B♯3. The
    // sharp tonic keeps sharps on the way down, so the letter B recurs only
    // once inside the octave.
    const descending = buildRun({
      tonic: { letter: 'B', alter: 1 },
      scaleType: SCALE_TYPES.chromatic,
      octaves: 1,
      startOctave: 3,
      direction: 'down',
    });
    expect(spellRun(descending)).toBe(
      'B♯4 B4 A♯4 A4 G♯4 G4 F♯4 F4 E4 D♯4 D4 C♯4 B♯3',
    );
    const midis = descending.map(midiOf);
    expect(midis).toEqual([72, 71, 70, 69, 68, 67, 66, 65, 64, 63, 62, 61, 60]);
  });

  it('has length octaves × degreeCount + 1', () => {
    expect(run(0, 'major', 1, 4, 'up')).toHaveLength(8);
    expect(run(0, 'major', 4, 2, 'up')).toHaveLength(29);
    expect(run(0, 'chromatic', 1, 4, 'up')).toHaveLength(13);
    expect(run(0, 'chromatic', 2, 4, 'up')).toHaveLength(25);
  });
});

describe('buildRun — invariants over every scale type in all twelve keys', () => {
  for (const scaleType of ALL_SCALE_TYPES) {
    const degreeCount = scaleType.ascendingFormula.length;

    it(`${scaleType.name} runs are the right length and strictly monotonic`, () => {
      for (const pc of ALL_PITCH_CLASSES) {
        const tonic = chooseTonicSpelling(pc, scaleType);
        for (const octaves of [1, 2, 3, 4]) {
          for (const direction of ['up', 'down'] as const) {
            const pitches = buildRun({ tonic, scaleType, octaves, startOctave: 3, direction });
            expect(pitches).toHaveLength(octaves * degreeCount + 1);

            const midis = pitches.map(midiOf);
            const step = direction === 'up' ? 1 : -1;
            midis.forEach((midi, i) => {
              if (i > 0) expect(Math.sign(midi - (midis[i - 1] ?? midi))).toBe(step);
            });
          }
        }
      }
    });

    it(`${scaleType.name} runs begin and end on the tonic, exactly an octave apart`, () => {
      for (const pc of ALL_PITCH_CLASSES) {
        const tonic = chooseTonicSpelling(pc, scaleType);
        for (const direction of ['up', 'down'] as const) {
          const pitches = buildRun({
            tonic,
            scaleType,
            octaves: 2,
            startOctave: 3,
            direction,
          });
          const lowest = direction === 'up' ? pitches[0] : pitches.at(-1);
          const highest = direction === 'up' ? pitches.at(-1) : pitches[0];
          expect(lowest).toEqual({ letter: tonic.letter, alter: tonic.alter, octave: 3 });
          expect(highest).toEqual({ letter: tonic.letter, alter: tonic.alter, octave: 5 });
          expect(midiOf(highest!) - midiOf(lowest!)).toBe(24);
        }
      }
    });

    it(`${scaleType.name} runs sound the formula in every octave`, () => {
      for (const pc of ALL_PITCH_CLASSES) {
        const tonic = chooseTonicSpelling(pc, scaleType);
        const pitches = buildRun({
          tonic,
          scaleType,
          octaves: 3,
          startOctave: 2,
          direction: 'up',
        });
        const root = midiOf(pitches[0]!);
        pitches.slice(0, -1).forEach((pitch, i) => {
          const octave = Math.floor(i / degreeCount);
          const semitone = scaleType.ascendingFormula[i % degreeCount] ?? -1;
          expect(midiOf(pitch) - root).toBe(octave * 12 + semitone);
        });
      }
    });
  }
});
