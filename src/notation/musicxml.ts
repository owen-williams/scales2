/**
 * MusicXML generation for a realised exercise.
 *
 * The output is a MusicXML 4.0 `score-partwise` document: one `<part>` per hand,
 * one note type throughout, every measure a complete 4/4 bar. A scale runs in
 * beamed eighths; the Rule of the Octave in semibreve chords, one to a bar.
 *
 * The only genuinely subtle part is accidental placement. MusicXML separates
 * *what a note sounds* (`<alter>`, always present when the note is altered) from
 * *what the engraver prints* (`<accidental>`, present only when the reader needs
 * to be told). Getting that wrong produces either a score littered with
 * redundant sharps or one that silently mis-spells the scale, so the state
 * machine below is deliberately explicit:
 *
 *   - Each part keeps a map from (letter, octave) to the alteration currently
 *     sounding for that exact staff position.
 *   - The map is cleared at every barline; a position with no entry falls back
 *     to whatever the key signature says for its letter.
 *   - `<accidental>` is emitted if and only if the note's alteration differs
 *     from that currently-sounding value; then the map is updated.
 *
 * The notes of a chord sound at once rather than one after another, so each of
 * them must be judged against the state as it stood when the chord began. See
 * `chordNotes`, where that is made true rather than assumed.
 */

import { letterIndex } from '../domain/pitch';
import { LETTERS } from '../domain/types';
import type {
  ExerciseEvent,
  Hand,
  HandPart,
  Letter,
  NoteType,
  Pitch,
  RealisedExercise,
} from '../domain/types';

// ---------------------------------------------------------------------------
// Engraving constants
// ---------------------------------------------------------------------------

/** Divisions per quarter note. Two lets an eighth note be an integer duration. */
const DIVISIONS = 2;
/** A full 4/4 bar, in divisions. Every measure is padded out to exactly this. */
const DIVISIONS_PER_MEASURE = DIVISIONS * 4;
/** How long one event lasts, in divisions. */
const NOTE_DURATIONS: Readonly<Record<NoteType, number>> = {
  eighth: 1,
  quarter: DIVISIONS,
  whole: DIVISIONS_PER_MEASURE,
};
/** Eighth notes are beamed four to a group, as printed scales conventionally are. */
const BEAM_GROUP = 4;

const PART_NAMES: Readonly<Record<Hand, string>> = {
  right: 'Right Hand',
  left: 'Left Hand',
};

/** Treble for the right hand, bass for the left. */
const CLEFS: Readonly<Record<Hand, { readonly sign: string; readonly line: number }>> = {
  right: { sign: 'G', line: 2 },
  left: { sign: 'F', line: 4 },
};

/** Fingerings sit above the treble staff and below the bass staff. */
const FINGERING_PLACEMENT: Readonly<Record<Hand, string>> = {
  right: 'above',
  left: 'below',
};

/** Order in which sharps are added to a key signature. */
const SHARP_ORDER: readonly Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
/** Order in which flats are added to a key signature. */
const FLAT_ORDER: readonly Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

// ---------------------------------------------------------------------------
// A very small XML builder
//
// Building markup by string concatenation is how malformed documents happen.
// This models elements as data and serialises once, escaping as it goes.
// ---------------------------------------------------------------------------

interface XmlElement {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string | number>>;
  readonly children: readonly XmlChild[];
}

type XmlChild = XmlElement | string;

function el(
  tag: string,
  attrs: Readonly<Record<string, string | number>> = {},
  children: readonly XmlChild[] = [],
): XmlElement {
  return { tag, attrs, children };
}

/** An element whose only content is a text value. */
function text(tag: string, value: string | number): XmlElement {
  return el(tag, {}, [String(value)]);
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function serialiseAttrs(attrs: Readonly<Record<string, string | number>>): string {
  return Object.entries(attrs)
    .map(([name, value]) => ` ${name}="${escapeAttr(String(value))}"`)
    .join('');
}

function serialise(node: XmlElement, depth: number): string {
  const pad = '  '.repeat(depth);
  const open = `${node.tag}${serialiseAttrs(node.attrs)}`;

  if (node.children.length === 0) {
    return `${pad}<${open} />`;
  }

  const only = node.children[0];
  if (node.children.length === 1 && typeof only === 'string') {
    return `${pad}<${open}>${escapeText(only)}</${node.tag}>`;
  }

  const inner = node.children
    .map((child) =>
      typeof child === 'string'
        ? `${'  '.repeat(depth + 1)}${escapeText(child)}`
        : serialise(child, depth + 1),
    )
    .join('\n');

  return `${pad}<${open}>\n${inner}\n${pad}</${node.tag}>`;
}

// ---------------------------------------------------------------------------
// Accidentals
// ---------------------------------------------------------------------------

/**
 * The alteration a key signature imposes on a letter, in semitones.
 *
 * Sharps are added in the order F C G D A E B and flats in the order
 * B E A D G C F, so `fifths` alone determines every letter's default.
 */
function keySignatureAlter(fifths: number, letter: Letter): number {
  if (fifths > 0) {
    const index = SHARP_ORDER.indexOf(letter);
    return index >= 0 && index < Math.min(fifths, SHARP_ORDER.length) ? 1 : 0;
  }
  if (fifths < 0) {
    const index = FLAT_ORDER.indexOf(letter);
    return index >= 0 && index < Math.min(-fifths, FLAT_ORDER.length) ? -1 : 0;
  }
  return 0;
}

/** The MusicXML `accidental-value` for an alteration, or null if unprintable. */
function accidentalName(alter: number): string | null {
  switch (alter) {
    case -3:
      return 'triple-flat';
    case -2:
      return 'double-flat';
    case -1:
      return 'flat';
    case 0:
      return 'natural';
    case 1:
      return 'sharp';
    case 2:
      return 'double-sharp';
    case 3:
      return 'triple-sharp';
    default:
      return null;
  }
}

/**
 * Tracks, for one part, which alteration is currently sounding at each staff
 * position. Cleared at every barline.
 */
interface AccidentalState {
  readonly fifths: number;
  readonly sounding: Map<string, number>;
}

function newAccidentalState(fifths: number): AccidentalState {
  return { fifths, sounding: new Map() };
}

function positionKey(letter: Letter, octave: number): string {
  return `${letter}${octave}`;
}

/**
 * Decides whether a note needs a printed accidental, and records its effect on
 * the rest of the measure. Must be called once per note, in written order — for
 * a chord, that is low to high, which `chordNotes` makes equivalent to judging
 * the whole chord at once.
 */
function takeAccidental(
  state: AccidentalState,
  letter: Letter,
  octave: number,
  alter: number,
): string | null {
  const key = positionKey(letter, octave);
  const current = state.sounding.get(key) ?? keySignatureAlter(state.fifths, letter);
  state.sounding.set(key, alter);
  return alter === current ? null : accidentalName(alter);
}

// ---------------------------------------------------------------------------
// Notes, chords and measures
// ---------------------------------------------------------------------------

/**
 * Which beam marking an eighth note carries.
 *
 * Groups run four to a bar; a group left holding a single note (the tail of a
 * part-filled final measure) is unbeamed, because a beam needs two notes.
 */
function beamKind(indexInMeasure: number, notesInMeasure: number): string | null {
  const groupStart = Math.floor(indexInMeasure / BEAM_GROUP) * BEAM_GROUP;
  const groupEnd = Math.min(groupStart + BEAM_GROUP, notesInMeasure) - 1;
  if (groupEnd <= groupStart) return null;
  if (indexInMeasure === groupStart) return 'begin';
  if (indexInMeasure === groupEnd) return 'end';
  return 'continue';
}

/** One notehead: a pitch and the finger written against it, if any. */
interface ChordNote {
  readonly pitch: Pitch;
  readonly finger: number | null;
}

/**
 * Where a pitch sits on the staff, counting lines and spaces from C0 upwards.
 *
 * Deliberately not the sounding pitch: C♭5 is written *above* B4 though it
 * sounds the same, and a chord is stacked by what the reader sees.
 */
function staffPosition(pitch: Pitch): number {
  return pitch.octave * LETTERS.length + letterIndex(pitch.letter);
}

/**
 * The notes of one event, ordered low to high as an engraver stacks them.
 *
 * Two notes of one chord on the *same* staff position would be two noteheads in
 * one place — unwritable in a single voice, and a sign that the harmonisation
 * handed us a doubling it should have spelled differently. It is rejected here
 * rather than papered over, and that rejection is also what keeps the
 * accidental state machine honest: because no staff position repeats within a
 * chord, no note of a chord can read an entry a sibling has just written, so
 * every note of the chord is judged against the state as it stood when the
 * chord began — which is what "sounding together" means for accidentals.
 */
function chordNotes(event: ExerciseEvent): ChordNote[] {
  // Silence is written as a rest by the padding below, never as an empty event,
  // and an event that sounded nothing would leave its measure short of a bar.
  if (event.pitches.length === 0) throw new Error('an event must sound at least one pitch');

  const notes = event.pitches.map((pitch, index) => ({
    pitch,
    finger: event.fingers[index] ?? null,
  }));
  notes.sort((a, b) => staffPosition(a.pitch) - staffPosition(b.pitch));

  notes.forEach((note, index) => {
    const previous = notes[index - 1];
    if (previous !== undefined && staffPosition(previous.pitch) === staffPosition(note.pitch)) {
      throw new Error(
        'two notes of one chord on the same staff position: ' +
          `${previous.pitch.letter}${String(previous.pitch.octave)}`,
      );
    }
  });

  return notes;
}

function noteElement(params: {
  note: ChordNote;
  /** True for every note of a chord after the lowest. */
  inChord: boolean;
  hand: Hand;
  state: AccidentalState;
  noteType: NoteType;
  beam: string | null;
}): XmlElement {
  const { note, inChord, hand, state, noteType, beam } = params;
  const { letter, alter, octave } = note.pitch;

  const pitch: XmlChild[] = [text('step', letter)];
  // `<alter>` describes the sound and is always written for an altered note,
  // whether or not the engraver prints a symbol for it.
  if (alter !== 0) pitch.push(text('alter', alter));
  pitch.push(text('octave', octave));

  const children: XmlChild[] = [];
  // `<chord/>` says "this sounds with the note before it" and must come first.
  if (inChord) children.push(el('chord'));
  children.push(
    el('pitch', {}, pitch),
    text('duration', NOTE_DURATIONS[noteType]),
    text('voice', 1),
    text('type', noteType),
  );

  const accidental = takeAccidental(state, letter, octave, alter);
  if (accidental !== null) children.push(text('accidental', accidental));

  if (beam !== null) children.push(el('beam', { number: 1 }, [beam]));

  if (note.finger !== null) {
    children.push(
      el('notations', {}, [
        el('technical', {}, [
          el('fingering', { placement: FINGERING_PLACEMENT[hand] }, [String(note.finger)]),
        ]),
      ]),
    );
  }

  return el('note', {}, children);
}

/**
 * The `<note>` elements for one event: one for a plain note, one per pitch for
 * a chord, with `<chord/>` on all but the lowest.
 *
 * A chord carries its beam on the lowest note alone — the beam belongs to the
 * stem, and the notes of a chord share one.
 */
function eventElements(params: {
  event: ExerciseEvent;
  hand: Hand;
  state: AccidentalState;
  noteType: NoteType;
  beam: string | null;
}): XmlElement[] {
  const { event, hand, state, noteType, beam } = params;
  return chordNotes(event).map((note, index) =>
    noteElement({
      note,
      inChord: index > 0,
      hand,
      state,
      noteType,
      beam: index === 0 ? beam : null,
    }),
  );
}

/** A rest of one event's length, used only to complete a partly-filled measure. */
function restElement(noteType: NoteType): XmlElement {
  return el('note', {}, [
    el('rest'),
    text('duration', NOTE_DURATIONS[noteType]),
    text('voice', 1),
    text('type', noteType),
  ]);
}

function attributesElement(fifths: number, hand: Hand): XmlElement {
  const clef = CLEFS[hand];
  return el('attributes', {}, [
    text('divisions', DIVISIONS),
    el('key', {}, [text('fifths', fifths)]),
    el('time', {}, [text('beats', 4), text('beat-type', 4)]),
    el('clef', {}, [text('sign', clef.sign), text('line', clef.line)]),
  ]);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function partElement(part: HandPart, fifths: number, noteType: NoteType, id: string): XmlElement {
  // Eight eighths, four quarters or a single semibreve: a bar holds however
  // many events fit it.
  const eventsPerMeasure = DIVISIONS_PER_MEASURE / NOTE_DURATIONS[noteType];
  const measures = chunk(part.events, eventsPerMeasure);
  // An empty part still needs one (silent) measure so the document stays valid.
  if (measures.length === 0) measures.push([]);

  const state = newAccidentalState(fifths);

  const measureElements = measures.map((events, measureIndex) => {
    // Every barline cancels the accidentals accumulated inside it.
    state.sounding.clear();

    const children: XmlChild[] = [];
    if (measureIndex === 0) children.push(attributesElement(fifths, part.hand));

    events.forEach((event, i) => {
      children.push(
        ...eventElements({
          event,
          hand: part.hand,
          state,
          noteType,
          // Only eighths are beamed; nothing longer carries a beam at all.
          beam: noteType === 'eighth' ? beamKind(i, events.length) : null,
        }),
      );
    });
    // Pad so every measure, including the last, is a complete 4/4 bar.
    for (let i = events.length; i < eventsPerMeasure; i++) {
      children.push(restElement(noteType));
    }

    return el('measure', { number: measureIndex + 1 }, children);
  });

  return el('part', { id }, measureElements);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
const DOCTYPE =
  '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" ' +
  '"http://www.musicxml.org/dtds/partwise.dtd">';

/**
 * Renders a realised exercise as a MusicXML 4.0 partwise document.
 *
 * One `<part>` per hand part, in score order (right hand first). The result is
 * a complete standalone document, suitable for handing straight to
 * OpenSheetMusicDisplay or saving to a `.musicxml` file.
 */
export function toMusicXml(realised: RealisedExercise): string {
  const partIds = realised.parts.map((_, index) => `P${index + 1}`);

  const scoreParts = realised.parts.map((part, index) =>
    el('score-part', { id: partIds[index] ?? `P${index + 1}` }, [
      text('part-name', PART_NAMES[part.hand]),
    ]),
  );

  const parts = realised.parts.map((part, index) =>
    partElement(part, realised.fifths, realised.noteType, partIds[index] ?? `P${index + 1}`),
  );

  const score = el('score-partwise', { version: '4.0' }, [
    el('work', {}, [text('work-title', realised.title)]),
    el('part-list', {}, scoreParts),
    ...parts,
  ]);

  return `${XML_DECLARATION}\n${DOCTYPE}\n${serialise(score, 0)}\n`;
}
