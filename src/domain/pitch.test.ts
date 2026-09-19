import { describe, expect, it } from 'vitest';

import {
  formatNote,
  formatPitch,
  letterAtStep,
  letterIndex,
  midiOf,
  naturalSemitone,
  noteAt,
  pitchClassOf,
} from './pitch';
import { LETTERS } from './types';

const ALL_PITCH_CLASSES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

describe('naturalSemitone', () => {
  it('gives the white-key layout', () => {
    const layout = LETTERS.map((letter) => `${letter}${naturalSemitone(letter)}`).join(' ');
    expect(layout).toBe('C0 D2 E4 F5 G7 A9 B11');
  });
});

describe('letterIndex', () => {
  it('numbers the letters from C', () => {
    expect(LETTERS.map(letterIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('letterAtStep', () => {
  it('steps upward and wraps past B', () => {
    expect(letterAtStep('C', 0)).toBe('C');
    expect(letterAtStep('C', 2)).toBe('E');
    expect(letterAtStep('A', 2)).toBe('C');
    expect(letterAtStep('B', 1)).toBe('C');
  });

  it('steps downward', () => {
    expect(letterAtStep('C', -1)).toBe('B');
    expect(letterAtStep('E', -2)).toBe('C');
    expect(letterAtStep('C', -8)).toBe('B');
  });

  it('is periodic in seven steps', () => {
    for (const letter of LETTERS) {
      for (let steps = -21; steps <= 21; steps += 1) {
        expect(letterAtStep(letter, steps)).toBe(letterAtStep(letter, steps + 7));
      }
    }
  });
});

describe('pitchClassOf', () => {
  it('collapses enharmonics to the same pitch class', () => {
    expect(pitchClassOf({ letter: 'C', alter: 0 })).toBe(0);
    expect(pitchClassOf({ letter: 'B', alter: 1 })).toBe(0);
    expect(pitchClassOf({ letter: 'D', alter: -2 })).toBe(0);
    expect(pitchClassOf({ letter: 'C', alter: -1 })).toBe(11);
    expect(pitchClassOf({ letter: 'F', alter: 2 })).toBe(7);
    expect(pitchClassOf({ letter: 'E', alter: 1 })).toBe(5);
    expect(pitchClassOf({ letter: 'B', alter: -2 })).toBe(9);
  });
});

describe('midiOf', () => {
  it('puts middle C at 60', () => {
    expect(midiOf({ letter: 'C', alter: 0, octave: 4 })).toBe(60);
    expect(midiOf({ letter: 'A', alter: 0, octave: 4 })).toBe(69);
    expect(midiOf({ letter: 'C', alter: 0, octave: 5 })).toBe(72);
    expect(midiOf({ letter: 'C', alter: 0, octave: 0 })).toBe(12);
  });

  it('follows the sounding pitch across the octave boundary, not the octave number', () => {
    // B♯3 and C4 are the same key; C♭4 and B3 likewise.
    expect(midiOf({ letter: 'B', alter: 1, octave: 3 })).toBe(60);
    expect(midiOf({ letter: 'C', alter: -1, octave: 4 })).toBe(59);
    expect(midiOf({ letter: 'B', alter: 0, octave: 3 })).toBe(59);
  });

  it('agrees with pitchClassOf', () => {
    for (const letter of LETTERS) {
      for (let alter = -2; alter <= 2; alter += 1) {
        const midi = midiOf({ letter, alter, octave: 4 });
        expect(((midi % 12) + 12) % 12).toBe(pitchClassOf({ letter, alter }));
      }
    }
  });
});

describe('formatNote', () => {
  it('uses the Unicode accidentals', () => {
    expect(formatNote({ letter: 'C', alter: 0 })).toBe('C');
    expect(formatNote({ letter: 'E', alter: -1 })).toBe('E♭');
    expect(formatNote({ letter: 'F', alter: 1 })).toBe('F♯');
    expect(formatNote({ letter: 'F', alter: 2 })).toBe('F𝄪');
    expect(formatNote({ letter: 'B', alter: -2 })).toBe('B𝄫');
  });

  it('uses the dedicated glyphs, not doubled ASCII', () => {
    expect(formatNote({ letter: 'E', alter: -1 })).toBe('E♭');
    expect(formatNote({ letter: 'F', alter: 1 })).toBe('F♯');
    expect(formatNote({ letter: 'F', alter: 2 })).toBe('F\u{1D12A}');
    expect(formatNote({ letter: 'B', alter: -2 })).toBe('B\u{1D12B}');
  });
});

describe('formatPitch', () => {
  it('appends the scientific octave', () => {
    expect(formatPitch({ letter: 'E', alter: -1, octave: 4 })).toBe('E♭4');
    expect(formatPitch({ letter: 'B', alter: 1, octave: 3 })).toBe('B♯3');
  });
});

describe('noteAt', () => {
  it('picks the alteration nearest zero', () => {
    expect(noteAt('C', 0)).toEqual({ letter: 'C', alter: 0 });
    expect(noteAt('C', 11)).toEqual({ letter: 'C', alter: -1 }); // C♭, not C+11
    expect(noteAt('B', 0)).toEqual({ letter: 'B', alter: 1 }); // B♯, not B−11
    expect(noteAt('E', 3)).toEqual({ letter: 'E', alter: -1 });
    expect(noteAt('F', 7)).toEqual({ letter: 'F', alter: 2 });
    expect(noteAt('G', 5)).toEqual({ letter: 'G', alter: -2 });
  });

  it('always lands on the requested pitch class', () => {
    for (const letter of LETTERS) {
      for (const pc of ALL_PITCH_CLASSES) {
        expect(pitchClassOf(noteAt(letter, pc))).toBe(pc);
      }
    }
  });

  it('never chooses a further representative than necessary', () => {
    for (const letter of LETTERS) {
      for (const pc of ALL_PITCH_CLASSES) {
        // Six semitones is the furthest any letter can be from a pitch class.
        expect(Math.abs(noteAt(letter, pc).alter)).toBeLessThanOrEqual(6);
      }
    }
  });

  it('accepts pitch classes outside 0…11', () => {
    expect(noteAt('D', 14)).toEqual({ letter: 'D', alter: 0 });
    expect(noteAt('D', -10)).toEqual({ letter: 'D', alter: 0 });
  });

  it('leaves a letter unaltered when it already sounds the pitch class', () => {
    for (const letter of LETTERS) {
      expect(noteAt(letter, naturalSemitone(letter))).toEqual({ letter, alter: 0 });
    }
  });
});
