/**
 * Spelled-pitch primitives.
 *
 * Everything here treats a pitch as a *letter plus an alteration*, never as a
 * bare semitone count. That is what lets the scale generator produce textbook
 * spellings — including the double accidentals that genuinely belong — instead
 * of enharmonic guesses.
 *
 * Two facts drive nearly all of this module:
 *
 * 1. Letters repeat every seven steps; semitones repeat every twelve. The two
 *    cycles are independent, so a note needs both coordinates.
 * 2. Scientific octave numbers change at C, i.e. at a *letter* boundary, not at
 *    a semitone boundary. B♯3 sounds like C4 but is written in octave 3.
 */

import { LETTERS } from './types';
import type { Letter, Pitch, PitchClass, SpelledNote } from './types';

/** Semitones above C for each natural letter — the white keys of one octave. */
const NATURAL_SEMITONES: Readonly<Record<Letter, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const SEMITONES_PER_OCTAVE = 12;
const LETTERS_PER_OCTAVE = 7;

/** Unicode accidentals: ♭ ♯ 𝄫 𝄪. Plain ASCII "b"/"#" never reach the UI. */
const FLAT = '♭';
const SHARP = '♯';
const DOUBLE_FLAT = '\u{1D12B}';
const DOUBLE_SHARP = '\u{1D12A}';

/** Remainder that is always non-negative, so downward steps wrap correctly. */
function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

/** Semitones from C for the *natural* form of a letter: C=0 D=2 E=4 F=5 G=7 A=9 B=11. */
export function naturalSemitone(letter: Letter): number {
  return NATURAL_SEMITONES[letter];
}

/** Diatonic position of a letter within an octave: C=0 … B=6. */
export function letterIndex(letter: Letter): number {
  return LETTERS.indexOf(letter);
}

/** The letter `steps` diatonic steps away, wrapping in either direction. */
export function letterAtStep(from: Letter, steps: number): Letter {
  const letter = LETTERS[mod(letterIndex(from) + steps, LETTERS_PER_OCTAVE)];
  // Unreachable: mod() already constrains the index to 0…6. The guard exists
  // only because noUncheckedIndexedAccess cannot know that.
  if (letter === undefined) throw new Error(`Unreachable: no letter ${steps} steps from ${from}`);
  return letter;
}

/** The sounding pitch class of a spelled note: C♯ and D♭ both give 1. */
export function pitchClassOf(note: SpelledNote): PitchClass {
  // mod() constrains the result to 0…11, which is exactly PitchClass.
  return mod(naturalSemitone(note.letter) + note.alter, SEMITONES_PER_OCTAVE) as PitchClass;
}

/** MIDI note number, with middle C (C4) = 60. */
export function midiOf(pitch: Pitch): number {
  return (pitch.octave + 1) * SEMITONES_PER_OCTAVE + naturalSemitone(pitch.letter) + pitch.alter;
}

/**
 * The accidental glyphs for an alteration. Single and double accidentals have
 * dedicated glyphs; larger alterations (which no scale in this app produces)
 * degrade to a run of symbols rather than throwing, so display code is total.
 */
function accidentalSymbols(alter: number): string {
  if (alter === 0) return '';
  const magnitude = Math.abs(alter);
  const double = alter > 0 ? DOUBLE_SHARP : DOUBLE_FLAT;
  const single = alter > 0 ? SHARP : FLAT;
  return double.repeat(Math.floor(magnitude / 2)) + single.repeat(magnitude % 2);
}

/** Display form of a note: "E♭", "F♯", "F𝄪", "B𝄫". */
export function formatNote(note: SpelledNote): string {
  return note.letter + accidentalSymbols(note.alter);
}

/** Display form of a pitch, with its scientific octave: "E♭4". */
export function formatPitch(pitch: Pitch): string {
  return formatNote(pitch) + String(pitch.octave);
}

/**
 * The note written with `letter` that sounds at `pitchClass`.
 *
 * The alteration is the representative of the required semitone difference
 * *nearest zero*, so C against pitch class 11 spells C♭ (−1) rather than C
 * raised by eleven. For every letter/pitch-class pair a scale actually asks for
 * this lands within [−2, 2]; remote pairs (a tritone apart, say) can exceed it,
 * and callers reject those spellings rather than emitting triple accidentals.
 */
export function noteAt(letter: Letter, pitchClass: number): SpelledNote {
  const distance = mod(pitchClass - naturalSemitone(letter), SEMITONES_PER_OCTAVE);
  const alter = distance > SEMITONES_PER_OCTAVE / 2 ? distance - SEMITONES_PER_OCTAVE : distance;
  return { letter, alter };
}
