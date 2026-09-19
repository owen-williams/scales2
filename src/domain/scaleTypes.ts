/**
 * The catalogue of scale types.
 *
 * Scale types are *data*: a set of semitone formulae plus display metadata.
 * Adding a scale system means adding an entry here, never editing the
 * generator in `scale.ts`.
 *
 * Three formulae per type, because they answer three different questions:
 * how the scale goes up, how it comes down, and which key signature it lives
 * in. They only diverge for melodic minor (up ≠ down) and for harmonic/melodic
 * minor (both are notated with the *natural* minor signature and get their
 * raised degrees as written accidentals).
 */

import type { ScaleType, ScaleTypeId } from './types';

// Semitone offsets from the tonic, ascending, excluding the octave.
const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const;
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10] as const;
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11] as const;
const MELODIC_MINOR_UP = [0, 2, 3, 5, 7, 9, 11] as const;
const CHROMATIC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

// The modes are rotations of the major collection; each is its own key
// signature, so each scores its own spelling.
const DORIAN = [0, 2, 3, 5, 7, 9, 10] as const;
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10] as const;
const LYDIAN = [0, 2, 4, 6, 7, 9, 11] as const;
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10] as const;
const LOCRIAN = [0, 1, 3, 5, 6, 8, 10] as const;

/**
 * Every scale type the app can generate.
 *
 * `fingeringSet` follows the physical key layout rather than the name: Ionian
 * is fingered as Major and Aeolian as Natural Minor, while the remaining modes
 * have no curated fingering — and none may be invented for them.
 */
export const SCALE_TYPES: Readonly<Record<ScaleTypeId, ScaleType>> = {
  major: {
    id: 'major',
    name: 'Major',
    category: 'family',
    spelling: 'diatonic',
    ascendingFormula: MAJOR,
    descendingFormula: MAJOR,
    signatureFormula: MAJOR,
    fingeringSet: 'major',
  },
  naturalMinor: {
    id: 'naturalMinor',
    name: 'Natural Minor',
    category: 'family',
    spelling: 'diatonic',
    ascendingFormula: NATURAL_MINOR,
    descendingFormula: NATURAL_MINOR,
    signatureFormula: NATURAL_MINOR,
    fingeringSet: 'minor',
  },
  harmonicMinor: {
    id: 'harmonicMinor',
    name: 'Harmonic Minor',
    category: 'family',
    spelling: 'diatonic',
    ascendingFormula: HARMONIC_MINOR,
    descendingFormula: HARMONIC_MINOR,
    // Scored against natural minor: E♭ minor is preferred over D♯ minor for its
    // key signature, not for the accidental on its raised seventh.
    signatureFormula: NATURAL_MINOR,
    fingeringSet: 'minor',
  },
  melodicMinor: {
    id: 'melodicMinor',
    name: 'Melodic Minor',
    category: 'family',
    spelling: 'diatonic',
    // Raised sixth and seventh going up; plain natural minor coming down.
    ascendingFormula: MELODIC_MINOR_UP,
    descendingFormula: NATURAL_MINOR,
    signatureFormula: NATURAL_MINOR,
    fingeringSet: 'minor',
  },
  chromatic: {
    id: 'chromatic',
    name: 'Chromatic',
    category: 'family',
    spelling: 'chromatic',
    ascendingFormula: CHROMATIC,
    descendingFormula: CHROMATIC,
    // A chromatic scale has no key signature of its own (keySignatureFifths
    // returns 0), but it still needs a spelled tonic — "F♯ Chromatic", not
    // "G♭ Chromatic" — so it borrows the major collection to choose one.
    signatureFormula: MAJOR,
    fingeringSet: 'chromatic',
  },
  ionian: {
    id: 'ionian',
    name: 'Ionian',
    category: 'mode',
    spelling: 'diatonic',
    ascendingFormula: MAJOR,
    descendingFormula: MAJOR,
    signatureFormula: MAJOR,
    fingeringSet: 'major',
  },
  dorian: {
    id: 'dorian',
    name: 'Dorian',
    category: 'mode',
    spelling: 'diatonic',
    ascendingFormula: DORIAN,
    descendingFormula: DORIAN,
    signatureFormula: DORIAN,
    fingeringSet: null,
  },
  phrygian: {
    id: 'phrygian',
    name: 'Phrygian',
    category: 'mode',
    spelling: 'diatonic',
    ascendingFormula: PHRYGIAN,
    descendingFormula: PHRYGIAN,
    signatureFormula: PHRYGIAN,
    fingeringSet: null,
  },
  lydian: {
    id: 'lydian',
    name: 'Lydian',
    category: 'mode',
    spelling: 'diatonic',
    ascendingFormula: LYDIAN,
    descendingFormula: LYDIAN,
    signatureFormula: LYDIAN,
    fingeringSet: null,
  },
  mixolydian: {
    id: 'mixolydian',
    name: 'Mixolydian',
    category: 'mode',
    spelling: 'diatonic',
    ascendingFormula: MIXOLYDIAN,
    descendingFormula: MIXOLYDIAN,
    signatureFormula: MIXOLYDIAN,
    fingeringSet: null,
  },
  aeolian: {
    id: 'aeolian',
    name: 'Aeolian',
    category: 'mode',
    spelling: 'diatonic',
    ascendingFormula: NATURAL_MINOR,
    descendingFormula: NATURAL_MINOR,
    signatureFormula: NATURAL_MINOR,
    fingeringSet: 'minor',
  },
  locrian: {
    id: 'locrian',
    name: 'Locrian',
    category: 'mode',
    spelling: 'diatonic',
    ascendingFormula: LOCRIAN,
    descendingFormula: LOCRIAN,
    signatureFormula: LOCRIAN,
    fingeringSet: null,
  },
};

/** Look up a scale type by id. */
export function getScaleType(id: ScaleTypeId): ScaleType {
  return SCALE_TYPES[id];
}

/** The scale families, in the order the settings screen lists them. */
export const SCALE_FAMILIES: readonly ScaleType[] = [
  SCALE_TYPES.major,
  SCALE_TYPES.naturalMinor,
  SCALE_TYPES.harmonicMinor,
  SCALE_TYPES.melodicMinor,
  SCALE_TYPES.chromatic,
];

/** The modes, in their conventional order starting from Ionian. */
export const MODES: readonly ScaleType[] = [
  SCALE_TYPES.ionian,
  SCALE_TYPES.dorian,
  SCALE_TYPES.phrygian,
  SCALE_TYPES.lydian,
  SCALE_TYPES.mixolydian,
  SCALE_TYPES.aeolian,
  SCALE_TYPES.locrian,
];
