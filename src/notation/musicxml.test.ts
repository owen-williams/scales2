import { describe, expect, it } from 'vitest';

import type {
  ExerciseEvent,
  Hand,
  HandPart,
  Letter,
  Pitch,
  PitchClass,
  RealisedExercise,
  RuleOfOctaveExercise,
  ScaleExercise,
  ScaleType,
  ScaleTypeId,
} from '../domain/types';
import { toMusicXml } from './musicxml';

// ---------------------------------------------------------------------------
// Fixture helpers
//
// These tests deliberately depend on nothing but `types.ts` and the module
// under test: every exercise below is written out by hand so that a bug in the
// scale generator can never make a notation test pass or fail spuriously.
// ---------------------------------------------------------------------------

/**
 * Parses a note name into a spelled pitch.
 *
 * `b` is a flat, `#` a sharp, `x` a double sharp: "Eb4", "F#5", "Fx5", "Bbb3".
 */
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

/** Zips a space-separated run of note names with its fingering, one note per event. */
function run(specs: string, fingers: readonly (number | null)[]): ExerciseEvent[] {
  const names = specs.trim().split(/\s+/);
  if (names.length !== fingers.length) {
    throw new Error(`fixture mismatch: ${names.length} notes, ${fingers.length} fingers`);
  }
  return names.map((name, i) => ({ pitches: [p(name)], fingers: [fingers[i] ?? null] }));
}

/** A run with no curated fingering. */
function unfingered(specs: string): ExerciseEvent[] {
  const names = specs.trim().split(/\s+/);
  return names.map((name) => ({ pitches: [p(name)], fingers: [null] }));
}

/**
 * One event whose pitches sound together, written in whatever order the test
 * wants — putting them in engraving order is the writer's job, not the domain's.
 */
function chord(specs: string, fingers: readonly (number | null)[] = []): ExerciseEvent {
  const names = specs.trim().split(/\s+/);
  return { pitches: names.map(p), fingers: names.map((_, i) => fingers[i] ?? null) };
}

function part(hand: Hand, events: readonly ExerciseEvent[]): HandPart {
  return { hand, events };
}

const MAJOR: ScaleType = {
  id: 'major',
  name: 'Major',
  category: 'family',
  spelling: 'diatonic',
  ascendingFormula: [0, 2, 4, 5, 7, 9, 11],
  descendingFormula: [0, 2, 4, 5, 7, 9, 11],
  signatureFormula: [0, 2, 4, 5, 7, 9, 11],
  fingeringSet: 'major',
};

const HARMONIC_MINOR: ScaleType = {
  id: 'harmonicMinor',
  name: 'Harmonic Minor',
  category: 'family',
  spelling: 'diatonic',
  ascendingFormula: [0, 2, 3, 5, 7, 8, 11],
  descendingFormula: [0, 2, 3, 5, 7, 8, 11],
  // Harmonic minor is spelled against the natural-minor key signature.
  signatureFormula: [0, 2, 3, 5, 7, 8, 10],
  fingeringSet: 'minor',
};

const CHROMATIC: ScaleType = {
  id: 'chromatic',
  name: 'Chromatic',
  category: 'family',
  spelling: 'chromatic',
  ascendingFormula: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  descendingFormula: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  signatureFormula: [0, 2, 4, 5, 7, 9, 11],
  fingeringSet: 'chromatic',
};

const DORIAN: ScaleType = {
  id: 'dorian',
  name: 'Dorian',
  category: 'mode',
  spelling: 'diatonic',
  ascendingFormula: [0, 2, 3, 5, 7, 9, 10],
  descendingFormula: [0, 2, 3, 5, 7, 9, 10],
  signatureFormula: [0, 2, 3, 5, 7, 9, 10],
  fingeringSet: null,
};

function exercise(
  over: Partial<ScaleExercise> & { tonic: PitchClass; scaleTypeId: ScaleTypeId },
): ScaleExercise {
  return {
    kind: 'scale',
    motion: 'similar',
    octaves: 1,
    direction: 'ascending',
    ...over,
  };
}

/*
 * Some fixtures below carry a single part. The app always asks for two — every
 * exercise is hands together — but the writer takes whatever parts it is given
 * and must not quietly assume there are two of them, so the one-part path is
 * still covered here, by scores written out by hand.
 */

// ---------------------------------------------------------------------------
// Fixture 1 — E flat harmonic minor, both hands, 2 octaves, up and down.
//
// Key signature is six flats (B E A D G C), so every note of the scale except
// the raised seventh is covered by it. The D is the interesting one: the key
// signature flattens D, so each written D needs a natural — but only the first
// one in any given measure at that octave.
//
//   measure 1  Eb4 F4 Gb4 Ab4 Bb4 Cb5 D5  Eb5     <- D5 takes a natural
//   measure 2  F5 Gb5 Ab5 Bb5 Cb6 D6 Eb6 D6       <- D6 natural, then no repeat
//   measure 3  Cb6 Bb5 Ab5 Gb5 F5 Eb5 D5 Cb5      <- new measure, D5 natural again
//   measure 4  Bb4 Ab4 Gb4 F4 Eb4 + three rests
// ---------------------------------------------------------------------------

const EFLAT_MINOR_RH_NOTES =
  'Eb4 F4 Gb4 Ab4 Bb4 Cb5 D5 Eb5 F5 Gb5 Ab5 Bb5 Cb6 D6 Eb6 ' +
  'D6 Cb6 Bb5 Ab5 Gb5 F5 Eb5 D5 Cb5 Bb4 Ab4 Gb4 F4 Eb4';

// E flat minor RH: thumb on F and Cb; the tonic is a black key so 3 starts and
// ends the run. Descending fingering is the ascending fingering reversed.
const EFLAT_MINOR_RH_FINGERS = [
  3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3,
];

const EFLAT_MINOR_LH_NOTES =
  'Eb3 F3 Gb3 Ab3 Bb3 Cb4 D4 Eb4 F4 Gb4 Ab4 Bb4 Cb5 D5 Eb5 ' +
  'D5 Cb5 Bb4 Ab4 Gb4 F4 Eb4 D4 Cb4 Bb3 Ab3 Gb3 F3 Eb3';

// E flat minor LH: thumb on the same white keys, F and Cb.
const EFLAT_MINOR_LH_FINGERS = [
  2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2,
];

const eFlatMinorBothHands: RealisedExercise = {
  exercise: exercise({
    tonic: 3,
    scaleTypeId: 'harmonicMinor',
    octaves: 2,
    direction: 'both',
  }),
  scaleType: HARMONIC_MINOR,
  tonicNote: { letter: 'E', alter: -1 },
  title: 'E♭ Harmonic Minor',
  parts: [
    part('right', run(EFLAT_MINOR_RH_NOTES, EFLAT_MINOR_RH_FINGERS)),
    part('left', run(EFLAT_MINOR_LH_NOTES, EFLAT_MINOR_LH_FINGERS)),
  ],
  fifths: -6,
  hasFingering: true,
  noteType: 'eighth',
};

// ---------------------------------------------------------------------------
// Fixture 2 — G sharp harmonic minor, right hand, one octave ascending.
//
// Five sharps (F C G D A). The raised seventh is therefore F double sharp,
// which is a semitone above the key signature's F sharp and so must print.
// ---------------------------------------------------------------------------

const gSharpMinorRightHand: RealisedExercise = {
  exercise: exercise({ tonic: 8, scaleTypeId: 'harmonicMinor' }),
  scaleType: HARMONIC_MINOR,
  tonicNote: { letter: 'G', alter: 1 },
  title: 'G♯ Harmonic Minor',
  // G sharp minor RH: thumb on B and E, the only white keys in the scale.
  parts: [part('right', run('G#4 A#4 B4 C#5 D#5 E5 Fx5 G#5', [3, 4, 1, 2, 3, 1, 2, 3]))],
  fifths: 5,
  hasFingering: true,
  noteType: 'eighth',
};

// ---------------------------------------------------------------------------
// Fixture 3 — C chromatic, right hand, one octave ascending (sharps going up).
// ---------------------------------------------------------------------------

const cChromaticRightHand: RealisedExercise = {
  exercise: exercise({ tonic: 0, scaleTypeId: 'chromatic' }),
  scaleType: CHROMATIC,
  tonicNote: { letter: 'C', alter: 0 },
  title: 'C Chromatic',
  // Standard chromatic RH: 3 on every black key, 2 on C and F, 1 elsewhere,
  // except the bottom of the run which takes the thumb.
  parts: [
    part(
      'right',
      run('C4 C#4 D4 D#4 E4 F4 F#4 G4 G#4 A4 A#4 B4 C5', [1, 3, 1, 3, 1, 2, 3, 1, 3, 1, 3, 1, 2]),
    ),
  ],
  fifths: 0,
  hasFingering: true,
  noteType: 'eighth',
};

// ---------------------------------------------------------------------------
// Fixture 4 — C major, a lone left-hand part. Exercises the bass clef path.
// ---------------------------------------------------------------------------

const cMajorLeftHand: RealisedExercise = {
  exercise: exercise({ tonic: 0, scaleTypeId: 'major' }),
  scaleType: MAJOR,
  tonicNote: { letter: 'C', alter: 0 },
  title: 'C Major',
  parts: [part('left', run('C3 D3 E3 F3 G3 A3 B3 C4', [5, 4, 3, 2, 1, 3, 2, 1]))],
  fifths: 0,
  hasFingering: true,
  noteType: 'eighth',
};

// ---------------------------------------------------------------------------
// Fixture 5 — G major, both hands: two parts an octave apart, no accidentals
// beyond the key signature.
// ---------------------------------------------------------------------------

const gMajorBothHands: RealisedExercise = {
  exercise: exercise({ tonic: 7, scaleTypeId: 'major' }),
  scaleType: MAJOR,
  tonicNote: { letter: 'G', alter: 0 },
  title: 'G Major',
  parts: [
    part('right', run('G4 A4 B4 C5 D5 E5 F#5 G5', [1, 2, 3, 1, 2, 3, 4, 5])),
    part('left', run('G3 A3 B3 C4 D4 E4 F#4 G4', [5, 4, 3, 2, 1, 3, 2, 1])),
  ],
  fifths: 1,
  hasFingering: true,
  noteType: 'eighth',
};

// ---------------------------------------------------------------------------
// Fixture 6 — D dorian: a scale with no curated fingering at all.
// ---------------------------------------------------------------------------

const dDorianRightHand: RealisedExercise = {
  exercise: exercise({ tonic: 2, scaleTypeId: 'dorian' }),
  scaleType: DORIAN,
  tonicNote: { letter: 'D', alter: 0 },
  title: 'D Dorian',
  parts: [part('right', unfingered('D4 E4 F4 G4 A4 B4 C5 D5'))],
  fifths: 0,
  hasFingering: false,
  noteType: 'eighth',
};

// ---------------------------------------------------------------------------
// Fixture 7 — four three-note chords over a bass, in quarter notes.
//
// The chords are plain triads written for this test. They are *not* the Rule of
// the Octave's harmonisation, which is curated data of its own: the writer
// neither knows nor cares which chords it is handed, and what is under test
// here is `<chord/>` placement, low-to-high ordering and quarter-note bars.
// ---------------------------------------------------------------------------

const RULE_OF_OCTAVE: RuleOfOctaveExercise = {
  kind: 'ruleOfOctave',
  mode: 'major',
  tonic: 0,
  version: 'fenaroli',
  position: 1,
};

const quarterNoteChords: RealisedExercise = {
  exercise: RULE_OF_OCTAVE,
  title: 'C Major — Rule of the Octave',
  parts: [
    part('right', [chord('E4 G4 C5'), chord('F4 A4 D5'), chord('G4 C5 E5'), chord('F4 A4 D5')]),
    part('left', unfingered('C3 D3 E3 F3')),
  ],
  fifths: 0,
  // Chords carry no curated fingering; none is invented.
  hasFingering: false,
  noteType: 'quarter',
};

/** The scales: one note to an event, eighths throughout. */
const SCALE_FIXTURES: ReadonlyArray<readonly [string, RealisedExercise]> = [
  ['E♭ harmonic minor, both hands', eFlatMinorBothHands],
  ['G♯ harmonic minor, right hand', gSharpMinorRightHand],
  ['C chromatic, right hand', cChromaticRightHand],
  ['C major, left hand', cMajorLeftHand],
  ['G major, both hands', gMajorBothHands],
  ['D dorian, no fingering', dDorianRightHand],
];

const ALL_FIXTURES: ReadonlyArray<readonly [string, RealisedExercise]> = [
  ...SCALE_FIXTURES,
  ['C major chords, quarter notes', quarterNoteChords],
];

// ---------------------------------------------------------------------------
// DOM helpers — assertions run against the parsed document, not the string.
// ---------------------------------------------------------------------------

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function all(node: ParentNode, selector: string): Element[] {
  return Array.from(node.querySelectorAll(selector));
}

function child(node: Element, tag: string): Element | null {
  return Array.from(node.children).find((e) => e.tagName === tag) ?? null;
}

function childText(node: Element, tag: string): string | null {
  return child(node, tag)?.textContent ?? null;
}

/** The rendered pitch of a `<note>`, e.g. "Eb4"; "rest" for a rest. */
function describeNote(note: Element): string {
  const pitch = child(note, 'pitch');
  if (pitch === null) return 'rest';
  const step = childText(pitch, 'step') ?? '?';
  const alter = Number(childText(pitch, 'alter') ?? '0');
  const octave = childText(pitch, 'octave') ?? '?';
  const symbol =
    alter === -2 ? 'bb' : alter === -1 ? 'b' : alter === 1 ? '#' : alter === 2 ? 'x' : '';
  return `${step}${symbol}${octave}`;
}

function accidentalOf(note: Element): string | null {
  return childText(note, 'accidental');
}

function measuresOf(doc: Document, partIndex: number): Element[] {
  const partElement = all(doc, 'part')[partIndex];
  if (partElement === undefined) throw new Error(`no part at index ${partIndex}`);
  return all(partElement, 'measure');
}

function notesOf(measure: Element): Element[] {
  return Array.from(measure.children).filter((e) => e.tagName === 'note');
}

/** True for a `<note>` that sounds with the note before it rather than after it. */
function isChordMember(note: Element): boolean {
  return child(note, 'chord') !== null;
}

/**
 * How much of the bar a measure fills. The notes of a chord all carry the
 * duration, but they share one slot in time, so only the head of each chord
 * counts towards the bar.
 */
function measureDuration(measure: Element): number {
  return notesOf(measure)
    .filter((note) => !isChordMember(note))
    .reduce((sum, note) => sum + Number(childText(note, 'duration')), 0);
}

/**
 * A one-part score of hand-written events, for pinning one behaviour at a time.
 * Quarter notes, so four events to the bar.
 */
function chordScore(events: readonly ExerciseEvent[], fifths = 0): Document {
  return parse(
    toMusicXml({ ...quarterNoteChords, parts: [part('right', events)], fifths }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fixture helper', () => {
  it('parses note specs into spelled pitches', () => {
    expect(p('Eb4')).toEqual({ letter: 'E', alter: -1, octave: 4 });
    expect(p('F#5')).toEqual({ letter: 'F', alter: 1, octave: 5 });
    expect(p('Fx5')).toEqual({ letter: 'F', alter: 2, octave: 5 });
    expect(p('F##5')).toEqual({ letter: 'F', alter: 2, octave: 5 });
    expect(p('Bbb3')).toEqual({ letter: 'B', alter: -2, octave: 3 });
    expect(p('C4')).toEqual({ letter: 'C', alter: 0, octave: 4 });
    expect(() => p('H4')).toThrow();
  });

  it('builds the E flat minor run at the expected length', () => {
    // 2 octaves of a 7-note scale, up and down, turning note written once.
    expect(eFlatMinorBothHands.parts[0]?.events).toHaveLength(29);
    expect(eFlatMinorBothHands.parts[1]?.events).toHaveLength(29);
  });

  it('builds chords as single events holding several pitches', () => {
    expect(chord('E4 G4 C5')).toEqual({
      pitches: [p('E4'), p('G4'), p('C5')],
      fingers: [null, null, null],
    });
    expect(chord('C4 E4', [1, 3]).fingers).toEqual([1, 3]);
  });
});

describe('toMusicXml — document structure', () => {
  it.each(ALL_FIXTURES)('%s parses with no parser error', (_name, fixture) => {
    const doc = parse(toMusicXml(fixture));
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.tagName).toBe('score-partwise');
  });

  it('declares MusicXML 4.0 with the partwise DOCTYPE', () => {
    const xml = toMusicXml(eFlatMinorBothHands);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(xml).toContain(
      '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" ' +
        '"http://www.musicxml.org/dtds/partwise.dtd">',
    );
    expect(parse(xml).documentElement.getAttribute('version')).toBe('4.0');
  });

  it('lists one score-part per part, matching the part ids', () => {
    const doc = parse(toMusicXml(eFlatMinorBothHands));
    const scoreParts = all(doc, 'part-list > score-part');
    expect(scoreParts.map((e) => e.getAttribute('id'))).toEqual(['P1', 'P2']);
    expect(scoreParts.map((e) => childText(e, 'part-name'))).toEqual(['Right Hand', 'Left Hand']);
    expect(all(doc, 'part').map((e) => e.getAttribute('id'))).toEqual(['P1', 'P2']);
  });

  it('emits exactly one part per hand part it is handed', () => {
    expect(all(parse(toMusicXml(gSharpMinorRightHand)), 'part')).toHaveLength(1);
    expect(all(parse(toMusicXml(cMajorLeftHand)), 'part')).toHaveLength(1);
    expect(all(parse(toMusicXml(eFlatMinorBothHands)), 'part')).toHaveLength(2);
    expect(all(parse(toMusicXml(gMajorBothHands)), 'part')).toHaveLength(2);
  });

  it('uses treble clef for the right hand and bass clef for the left', () => {
    const doc = parse(toMusicXml(eFlatMinorBothHands));
    const clefs = all(doc, 'clef');
    expect(clefs).toHaveLength(2);
    expect([childText(clefs[0]!, 'sign'), childText(clefs[0]!, 'line')]).toEqual(['G', '2']);
    expect([childText(clefs[1]!, 'sign'), childText(clefs[1]!, 'line')]).toEqual(['F', '4']);

    const leftOnly = all(parse(toMusicXml(cMajorLeftHand)), 'clef');
    expect(leftOnly).toHaveLength(1);
    expect(childText(leftOnly[0]!, 'sign')).toBe('F');
  });

  it('states divisions, key and time once per part, in the first measure', () => {
    const doc = parse(toMusicXml(gMajorBothHands));
    for (let partIndex = 0; partIndex < 2; partIndex++) {
      const measures = measuresOf(doc, partIndex);
      const attributes = all(measures[0]!, 'attributes');
      expect(attributes).toHaveLength(1);
      expect(childText(attributes[0]!, 'divisions')).toBe('2');
      expect(all(measures[0]!, 'key > fifths')[0]?.textContent).toBe('1');
      expect(all(measures[0]!, 'time > beats')[0]?.textContent).toBe('4');
      expect(all(measures[0]!, 'time > beat-type')[0]?.textContent).toBe('4');
      for (const later of measures.slice(1)) {
        expect(all(later, 'attributes')).toHaveLength(0);
      }
    }
  });

  it.each([
    ['E♭ harmonic minor', eFlatMinorBothHands, -6],
    ['G♯ harmonic minor', gSharpMinorRightHand, 5],
    ['C chromatic', cChromaticRightHand, 0],
    ['G major', gMajorBothHands, 1],
  ])('writes the key signature for %s', (_name, fixture, fifths) => {
    const doc = parse(toMusicXml(fixture));
    for (const key of all(doc, 'key')) {
      expect(childText(key, 'fifths')).toBe(String(fifths));
    }
  });

  it('escapes markup characters in the title', () => {
    const awkward: RealisedExercise = {
      ...cMajorLeftHand,
      title: 'Fish & <Chips> "Major" ♭',
    };
    const xml = toMusicXml(awkward);
    expect(xml).not.toContain('<Chips>');
    const doc = parse(xml);
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(all(doc, 'work > work-title')[0]?.textContent).toBe('Fish & <Chips> "Major" ♭');
  });
});

describe('toMusicXml — measures', () => {
  it.each(ALL_FIXTURES)('%s fills every measure to a complete 4/4 bar', (_name, fixture) => {
    const doc = parse(toMusicXml(fixture));
    const parts = all(doc, 'part');
    expect(parts.length).toBeGreaterThan(0);
    for (const partElement of parts) {
      const measures = all(partElement, 'measure');
      expect(measures.length).toBeGreaterThan(0);
      for (const measure of measures) {
        // divisions = 2, so a 4/4 bar is 8 divisions long whatever it is made of.
        expect(measureDuration(measure)).toBe(8);
      }
    }
  });

  it.each(SCALE_FIXTURES)('%s writes eight eighths to the bar', (_name, fixture) => {
    const doc = parse(toMusicXml(fixture));
    for (const measure of all(doc, 'measure')) {
      expect(notesOf(measure)).toHaveLength(8);
      expect(notesOf(measure).filter(isChordMember)).toHaveLength(0);
    }
  });

  it('numbers measures from one', () => {
    const doc = parse(toMusicXml(eFlatMinorBothHands));
    expect(measuresOf(doc, 0).map((m) => m.getAttribute('number'))).toEqual(['1', '2', '3', '4']);
  });

  it('pads only the final measure, with eighth rests', () => {
    // 29 notes = three full measures plus five notes and three rests.
    const doc = parse(toMusicXml(eFlatMinorBothHands));
    const measures = measuresOf(doc, 0);
    expect(measures).toHaveLength(4);

    for (const measure of measures.slice(0, 3)) {
      expect(notesOf(measure).filter((n) => child(n, 'rest') !== null)).toHaveLength(0);
    }

    const last = notesOf(measures[3]!);
    expect(last.map(describeNote)).toEqual([
      'Bb4',
      'Ab4',
      'Gb4',
      'F4',
      'Eb4',
      'rest',
      'rest',
      'rest',
    ]);
    for (const rest of last.slice(5)) {
      expect(childText(rest, 'duration')).toBe('1');
      expect(childText(rest, 'type')).toBe('eighth');
      expect(all(rest, 'beam')).toHaveLength(0);
      expect(all(rest, 'notations')).toHaveLength(0);
    }
  });

  it('writes every note as an eighth in voice one', () => {
    const doc = parse(toMusicXml(cChromaticRightHand));
    for (const note of all(doc, 'note')) {
      expect(childText(note, 'type')).toBe('eighth');
      expect(childText(note, 'voice')).toBe('1');
      expect(childText(note, 'duration')).toBe('1');
    }
  });

  it('beams eighth notes in fours, leaving a lone note unbeamed', () => {
    const doc = parse(toMusicXml(cChromaticRightHand));
    const measures = measuresOf(doc, 0);
    expect(measures).toHaveLength(2);

    const beams = (measure: Element): (string | null)[] =>
      notesOf(measure).map((note) => childText(note, 'beam'));

    expect(beams(measures[0]!)).toEqual([
      'begin',
      'continue',
      'continue',
      'end',
      'begin',
      'continue',
      'continue',
      'end',
    ]);
    // Second measure holds five notes: a full group of four, then a single note
    // which cannot be beamed to anything.
    expect(beams(measures[1]!)).toEqual([
      'begin',
      'continue',
      'continue',
      'end',
      null,
      null,
      null,
      null,
    ]);

    for (const beam of all(doc, 'beam')) {
      expect(beam.getAttribute('number')).toBe('1');
    }
  });
});

describe('toMusicXml — accidentals', () => {
  it('writes E♭ harmonic minor with naturals only where the key signature needs cancelling', () => {
    const doc = parse(toMusicXml(eFlatMinorBothHands));
    const measures = measuresOf(doc, 0);

    const m1 = notesOf(measures[0]!);
    expect(m1.map(describeNote)).toEqual([
      'Eb4',
      'F4',
      'Gb4',
      'Ab4',
      'Bb4',
      'Cb5',
      'D5',
      'Eb5',
    ]);
    // Everything but the D is already flattened by the six-flat key signature.
    expect(m1.map(accidentalOf)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      'natural',
      null,
    ]);
  });

  it('does not repeat an accidental on the same note later in the same measure', () => {
    const doc = parse(toMusicXml(eFlatMinorBothHands));
    const m2 = notesOf(measuresOf(doc, 0)[1]!);
    expect(m2.map(describeNote)).toEqual([
      'F5',
      'Gb5',
      'Ab5',
      'Bb5',
      'Cb6',
      'D6',
      'Eb6',
      'D6',
    ]);
    // The turn puts two D naturals in one bar; only the first is marked.
    expect(m2.map(accidentalOf)).toEqual([
      null,
      null,
      null,
      null,
      null,
      'natural',
      null,
      null,
    ]);
  });

  it('re-states the natural after a barline', () => {
    const doc = parse(toMusicXml(eFlatMinorBothHands));
    const m3 = notesOf(measuresOf(doc, 0)[2]!);
    expect(m3.map(describeNote)[6]).toBe('D5');
    expect(accidentalOf(m3[6]!)).toBe('natural');
  });

  it('treats the same letter in different octaves as separate positions', () => {
    // D5 in measure 1 and D6 in measure 2 both take a natural: the accidental
    // state is keyed on letter *and* octave, as printed notation requires.
    const doc = parse(toMusicXml(eFlatMinorBothHands));
    expect(accidentalOf(notesOf(measuresOf(doc, 0)[0]!)[6]!)).toBe('natural');
    expect(accidentalOf(notesOf(measuresOf(doc, 0)[1]!)[5]!)).toBe('natural');
  });

  it('tracks accidental state independently for each part', () => {
    const doc = parse(toMusicXml(eFlatMinorBothHands));
    const leftM1 = notesOf(measuresOf(doc, 1)[0]!);
    expect(leftM1.map(describeNote)).toEqual([
      'Eb3',
      'F3',
      'Gb3',
      'Ab3',
      'Bb3',
      'Cb4',
      'D4',
      'Eb4',
    ]);
    expect(leftM1.map(accidentalOf)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      'natural',
      null,
    ]);
  });

  it('always writes <alter> for altered notes, printed accidental or not', () => {
    const doc = parse(toMusicXml(eFlatMinorBothHands));
    const m1 = notesOf(measuresOf(doc, 0)[0]!);
    // Eb4: flattened by the key signature, so no printed accidental...
    expect(accidentalOf(m1[0]!)).toBeNull();
    // ...but the sounding pitch still has to say so.
    expect(all(m1[0]!, 'pitch > alter')[0]?.textContent).toBe('-1');
    // A natural note carries no <alter> element at all.
    expect(all(m1[6]!, 'pitch > alter')).toHaveLength(0);
  });

  it('writes a double sharp for the raised seventh of G♯ harmonic minor', () => {
    const doc = parse(toMusicXml(gSharpMinorRightHand));
    const notes = notesOf(measuresOf(doc, 0)[0]!);
    expect(notes.map(describeNote)).toEqual([
      'G#4',
      'A#4',
      'B4',
      'C#5',
      'D#5',
      'E5',
      'Fx5',
      'G#5',
    ]);
    // Five sharps cover G, A, C, D and F; only the F double sharp is a surprise.
    expect(notes.map(accidentalOf)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      'double-sharp',
      null,
    ]);
    expect(all(notes[6]!, 'pitch > alter')[0]?.textContent).toBe('2');
    // B and E are natural in this key signature, so they need no cancelling.
    expect(all(notes[2]!, 'pitch > alter')).toHaveLength(0);
    expect(all(notes[5]!, 'pitch > alter')).toHaveLength(0);
  });

  it('writes chromatic sharps without redundant naturals', () => {
    const doc = parse(toMusicXml(cChromaticRightHand));
    const measures = measuresOf(doc, 0);

    expect(notesOf(measures[0]!).map(accidentalOf)).toEqual([
      null, // C4
      'sharp', // C#4
      null, // D4 — no D has sounded yet in this bar
      'sharp', // D#4
      null, // E4
      null, // F4
      'sharp', // F#4
      null, // G4
    ]);
    expect(notesOf(measures[1]!).map(accidentalOf)).toEqual([
      'sharp', // G#4 — the bar reset the G from measure one
      null, // A4
      'sharp', // A#4
      null, // B4
      null, // C5
      null,
      null,
      null,
    ]);
  });

  it('emits no accidentals at all for a scale that matches its key signature', () => {
    const doc = parse(toMusicXml(gMajorBothHands));
    expect(all(doc, 'accidental')).toHaveLength(0);
    // The F sharps are still spelled as such.
    const fSharps = all(doc, 'note').filter((n) => describeNote(n).startsWith('F#'));
    expect(fSharps).toHaveLength(2);
    for (const note of fSharps) {
      expect(all(note, 'pitch > alter')[0]?.textContent).toBe('1');
    }
  });
});

describe('toMusicXml — chords', () => {
  it('writes each chord as one head note plus one <chord/> note per extra pitch', () => {
    const notes = notesOf(measuresOf(parse(toMusicXml(quarterNoteChords)), 0)[0]!);
    // Four three-note chords fill the bar, so no rests are needed.
    expect(notes).toHaveLength(12);
    expect(notes.map(isChordMember)).toEqual([
      false,
      true,
      true,
      false,
      true,
      true,
      false,
      true,
      true,
      false,
      true,
      true,
    ]);
  });

  it('puts <chord/> first, before the pitch it belongs to', () => {
    const notes = notesOf(measuresOf(parse(toMusicXml(quarterNoteChords)), 0)[0]!);
    const second = notes[1];
    if (second === undefined) throw new Error('unreachable');
    expect(Array.from(second.children).map((e) => e.tagName).slice(0, 2)).toEqual([
      'chord',
      'pitch',
    ]);
    // The head note has no <chord/> at all, and leads with its pitch.
    expect(notesOf(measuresOf(parse(toMusicXml(quarterNoteChords)), 0)[0]!)[0]?.children[0]?.tagName)
      .toBe('pitch');
  });

  it('writes a chord low to high, whatever order the pitches arrive in', () => {
    const doc = chordScore([chord('C5 E4 G4')]);
    const notes = notesOf(measuresOf(doc, 0)[0]!).slice(0, 3);
    expect(notes.map(describeNote)).toEqual(['E4', 'G4', 'C5']);
    expect(notes.map(isChordMember)).toEqual([false, true, true]);
  });

  it('stacks by staff position rather than by sounding pitch', () => {
    // C♭5 sounds the same as B4 but is written a step above it, and a chord is
    // stacked by what the reader sees.
    const doc = chordScore([chord('Cb5 B4')]);
    expect(notesOf(measuresOf(doc, 0)[0]!).slice(0, 2).map(describeNote)).toEqual(['B4', 'Cb5']);
  });

  it('keeps every pitch with its own fingering when it reorders a chord', () => {
    const doc = chordScore([chord('C5 E4 G4', [5, 1, 3])]);
    const notes = notesOf(measuresOf(doc, 0)[0]!).slice(0, 3);
    expect(notes.map(describeNote)).toEqual(['E4', 'G4', 'C5']);
    expect(notes.map((n) => all(n, 'fingering')[0]?.textContent ?? null)).toEqual(['1', '3', '5']);
  });

  it('gives every note of a chord the full duration, and counts the chord once', () => {
    const doc = parse(toMusicXml(quarterNoteChords));
    for (const note of all(doc, 'note')) {
      expect(childText(note, 'type')).toBe('quarter');
      expect(childText(note, 'duration')).toBe('2');
      expect(childText(note, 'voice')).toBe('1');
    }
    // Four quarters to the bar, however many noteheads that is.
    for (const measure of all(doc, 'measure')) {
      expect(measureDuration(measure)).toBe(8);
      expect(notesOf(measure).filter((note) => !isChordMember(note))).toHaveLength(4);
    }
  });

  it('pads a part-filled bar of quarters with quarter rests', () => {
    const doc = chordScore([chord('C4 E4 G4'), chord('D4 F4 A4')]);
    const notes = notesOf(measuresOf(doc, 0)[0]!);
    const rests = notes.filter((note) => child(note, 'rest') !== null);
    expect(rests).toHaveLength(2);
    for (const rest of rests) {
      expect(childText(rest, 'duration')).toBe('2');
      expect(childText(rest, 'type')).toBe('quarter');
    }
    expect(measureDuration(measuresOf(doc, 0)[0]!)).toBe(8);
  });

  it('never beams a quarter note', () => {
    expect(all(parse(toMusicXml(quarterNoteChords)), 'beam')).toHaveLength(0);
  });

  it('starts a new measure every four quarters', () => {
    const doc = chordScore([
      chord('C4 E4'),
      chord('D4 F4'),
      chord('E4 G4'),
      chord('F4 A4'),
      chord('G4 B4'),
    ]);
    const measures = measuresOf(doc, 0);
    expect(measures).toHaveLength(2);
    expect(notesOf(measures[0]!).filter((n) => !isChordMember(n))).toHaveLength(4);
    expect(notesOf(measures[1]!).map(describeNote)).toEqual(['G4', 'B4', 'rest', 'rest', 'rest']);
  });
});

describe('toMusicXml — accidentals inside chords', () => {
  it('prints the accidental a chord needs, on the note that needs it', () => {
    const doc = chordScore([chord('F#4 A4 C5')]);
    const notes = notesOf(measuresOf(doc, 0)[0]!).slice(0, 3);
    expect(notes.map(describeNote)).toEqual(['F#4', 'A4', 'C5']);
    expect(notes.map(accidentalOf)).toEqual(['sharp', null, null]);
  });

  it('keeps a chord accidental in force for the rest of the measure', () => {
    // The F sharp is in the first chord; the F natural three beats later has to
    // cancel it, and the F sharp after the barline has to be restated.
    const doc = chordScore([
      chord('F#4 A4 C5'),
      chord('A4 C5 E5'),
      chord('F4 A4 C5'),
      chord('F#4 A4 C5'),
      chord('F#4 A4 C5'),
    ]);
    const first = notesOf(measuresOf(doc, 0)[0]!);
    expect(first.map(describeNote)).toEqual([
      'F#4',
      'A4',
      'C5',
      'A4',
      'C5',
      'E5',
      'F4',
      'A4',
      'C5',
      'F#4',
      'A4',
      'C5',
    ]);
    expect(first.map(accidentalOf)).toEqual([
      'sharp',
      null,
      null,
      null,
      null,
      null,
      'natural',
      null,
      null,
      'sharp',
      null,
      null,
    ]);
    // Every barline cancels the accidentals accumulated inside it, chord or not.
    expect(accidentalOf(notesOf(measuresOf(doc, 0)[1]!)[0]!)).toBe('sharp');
  });

  it('judges every note of a chord against the state as the chord began', () => {
    // A chord sounds at once, so no note of it may be read as altering another.
    // Nothing here can: two notes of one chord never share a staff position
    // (the writer refuses that outright), so a chord's notes cannot see each
    // other's entries — only the notes that follow the chord can.
    const doc = chordScore([chord('F#4 A4 F#5'), chord('F4 A4 F5')]);
    const notes = notesOf(measuresOf(doc, 0)[0]!);
    expect(notes.slice(0, 6).map(describeNote)).toEqual(['F#4', 'A4', 'F#5', 'F4', 'A4', 'F5']);
    // Both octaves are separate positions, so both sharps print…
    expect(notes.slice(0, 3).map(accidentalOf)).toEqual(['sharp', null, 'sharp']);
    // …and both need cancelling in the chord that follows.
    expect(notes.slice(3, 6).map(accidentalOf)).toEqual(['natural', null, 'natural']);
  });

  it('reads a chord against the key signature like any other note', () => {
    // Three sharps: F, C and G. The chord needs no accidental of its own.
    const doc = chordScore([chord('A4 C#5 E5'), chord('G#4 B4 D5')], 3);
    const notes = notesOf(measuresOf(doc, 0)[0]!).slice(0, 6);
    expect(notes.map(describeNote)).toEqual(['A4', 'C#5', 'E5', 'G#4', 'B4', 'D5']);
    expect(notes.map(accidentalOf)).toEqual([null, null, null, null, null, null]);
  });

  it('refuses two notes of one chord on the same staff position', () => {
    // Unwritable in a single voice, and a sign the harmonisation doubled a note
    // it should have spelled differently — an error, not something to paper over.
    expect(() => chordScore([chord('C4 C#4 E4')])).toThrow(/same staff position/);
    expect(() => chordScore([chord('C4 E4 C4')])).toThrow(/same staff position/);
    // The same letter an octave apart is a different position and is fine.
    expect(() => chordScore([chord('C4 C5')])).not.toThrow();
  });

  it('refuses an event that sounds nothing, which would leave the bar short', () => {
    expect(() => chordScore([{ pitches: [], fingers: [] }])).toThrow(/at least one pitch/);
  });
});

describe('toMusicXml — fingerings', () => {
  it('places right-hand fingerings above and left-hand fingerings below', () => {
    const doc = parse(toMusicXml(gMajorBothHands));
    const parts = all(doc, 'part');

    const rightFingerings = all(parts[0]!, 'notations > technical > fingering');
    expect(rightFingerings.map((f) => f.textContent)).toEqual(['1', '2', '3', '1', '2', '3', '4', '5']);
    for (const fingering of rightFingerings) {
      expect(fingering.getAttribute('placement')).toBe('above');
    }

    const leftFingerings = all(parts[1]!, 'notations > technical > fingering');
    expect(leftFingerings.map((f) => f.textContent)).toEqual(['5', '4', '3', '2', '1', '3', '2', '1']);
    for (const fingering of leftFingerings) {
      expect(fingering.getAttribute('placement')).toBe('below');
    }
  });

  it('emits exactly one fingering per fingered note and none for rests', () => {
    for (const [, fixture] of ALL_FIXTURES) {
      const doc = parse(toMusicXml(fixture));
      const expected = fixture.parts.reduce(
        (count, hand) =>
          count +
          hand.events.reduce(
            (inPart, event) => inPart + event.fingers.filter((finger) => finger !== null).length,
            0,
          ),
        0,
      );
      expect(all(doc, 'fingering')).toHaveLength(expected);
      for (const note of all(doc, 'note')) {
        if (child(note, 'rest') !== null) {
          expect(all(note, 'notations')).toHaveLength(0);
        }
      }
    }
  });

  it('omits notations entirely for a scale with no curated fingering', () => {
    const doc = parse(toMusicXml(dDorianRightHand));
    expect(all(doc, 'notations')).toHaveLength(0);
    expect(all(doc, 'fingering')).toHaveLength(0);
    // The notes themselves are still there.
    expect(notesOf(measuresOf(doc, 0)[0]!).map(describeNote)).toEqual([
      'D4',
      'E4',
      'F4',
      'G4',
      'A4',
      'B4',
      'C5',
      'D5',
    ]);
  });

  it('drops the fingering only on the notes that lack one', () => {
    const partial: RealisedExercise = {
      ...cMajorLeftHand,
      parts: [
        part('left', run('C3 D3 E3 F3 G3 A3 B3 C4', [5, null, 3, null, 1, 3, 2, null])),
      ],
    };
    const doc = parse(toMusicXml(partial));
    const notes = notesOf(measuresOf(doc, 0)[0]!);
    expect(notes.map((n) => all(n, 'fingering')[0]?.textContent ?? null)).toEqual([
      '5',
      null,
      '3',
      null,
      '1',
      '3',
      '2',
      null,
    ]);
  });
});
