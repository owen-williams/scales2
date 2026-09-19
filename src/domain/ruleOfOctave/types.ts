/**
 * Shapes for the curated Rule of the Octave catalogue.
 *
 * The rule is a table, not an algorithm: for every degree of the bass scale —
 * ascending and descending separately, because they genuinely differ — a
 * historical source names one chord. This module fixes how such a table is
 * written down so that two sources can sit side by side and be compared row by
 * row, and so that a third can be added as a file plus one line in the registry.
 *
 * Three ideas carry the design.
 *
 * **Everything is a scale degree of the key, never an interval above the bass.**
 * The sources print figures (`6`, `6/5`, `4/2`), which are intervals above the
 * bass and therefore say nothing about spelling on their own: the `6` over the
 * descending sixth is F♯ in C major and F♯ in C minor, but the `3` over it is C
 * in both while the bass is A in one and A♭ in the other. Recording the key
 * degree plus its alteration makes every row spell itself correctly in all 24
 * keys from the key's own collection, and makes the table readable — `[2, ♯4, 1]`
 * is D–F♯–C in C major without decoding anything. The figure is kept alongside,
 * as printed, because that is what the sources actually say.
 *
 * **The three upper voices are ordered, low to high.** That order is the whole
 * content of a "position": Fenaroli's *Regole* (1775) prints the right hand of
 * every chord of the scale as an ordered list of intervals, three times over,
 * and the three lists are exact rotations of one another. So one ordered triple
 * per row is enough; positions 2 and 3 are derived, not curated.
 *
 * **A row may be `null`.** That is the type forcing the issue: where no source
 * corroborates a degree, the row is a hole and the app refuses to build the
 * exercise, rather than a plausible chord being invented to fill it. Every row
 * of every table currently shipped is corroborated; the tests assert it.
 */

import type { RuleOfOctaveVersionId } from '../types';

/** Scale degrees of the key, 1–7. The upper tonic is degree 1 an octave up. */
export const DEGREES = [1, 2, 3, 4, 5, 6, 7] as const;
export type Degree = (typeof DEGREES)[number];

/**
 * A chromatic alteration measured against the key's *own* collection — the
 * major scale in major, the natural minor in minor, which is also the key
 * signature. So in minor the raised leading tone is `1` and the descending
 * seventh is `0`; in major the sharpened fourth of the descending sixth degree's
 * chord is `1`. Nothing here ever needs more than one semitone of alteration.
 */
export type Alteration = -1 | 0 | 1;

/** One voice: which degree of the key it sings, and whether it is altered. */
export interface Voice {
  readonly degree: Degree;
  readonly alter: Alteration;
}

/** Terse constructor for the tables: `v(4, 1)` is the sharpened fourth degree. */
export function v(degree: Degree, alter: Alteration = 0): Voice {
  return { degree, alter };
}

/** One rhythmic slot of the rule: a bass degree and the chord over it. */
export interface RuleChord {
  /** The bass note's degree of the key. */
  readonly bass: Degree;
  /** The bass's own alteration — minor raises 6 and 7 ascending, and nothing else. */
  readonly bassAlter: Alteration;
  /**
   * The figure as the source prints it, e.g. `5/3`, `6/3`, `6/5/3`, `♯6/4/3`,
   * `6/4/2`. Documentation and audit only: the notes come from `upper`.
   */
  readonly figure: string;
  /**
   * The three upper voices, ordered LOW to HIGH, for the first position.
   * Positions 2 and 3 are rotations of this and are never curated separately.
   */
  readonly upper: readonly [Voice, Voice, Voice];
}

/**
 * A row of a table. `null` means "no source corroborates this degree" — a gap
 * that must surface, never a licence to invent a chord.
 */
export type RuleRow = RuleChord | null;

/**
 * The rule for one mode: eight slots up (degrees 1–7 then the upper tonic) and
 * seven back down (7–1). Fifteen in all, the upper tonic written once — what
 * Fenaroli calls the *scala compita*, the complete scale.
 */
export interface RuleOfOctaveModeTable {
  readonly ascending: readonly [
    RuleRow,
    RuleRow,
    RuleRow,
    RuleRow,
    RuleRow,
    RuleRow,
    RuleRow,
    RuleRow,
  ];
  readonly descending: readonly [RuleRow, RuleRow, RuleRow, RuleRow, RuleRow, RuleRow, RuleRow];
}

/** The bass degrees of the ascending half, in order; the last is the upper tonic. */
export const ASCENDING_BASS_DEGREES: readonly Degree[] = [1, 2, 3, 4, 5, 6, 7, 1];
/** The bass degrees of the descending half, in order. */
export const DESCENDING_BASS_DEGREES: readonly Degree[] = [7, 6, 5, 4, 3, 2, 1];

/** Fifteen chords to a complete scale: eight up, seven back down. */
export const EVENTS_PER_RULE = ASCENDING_BASS_DEGREES.length + DESCENDING_BASS_DEGREES.length;

/**
 * One historical version of the rule, in both modes.
 *
 * Adding a third version — Heinichen's *Schemata Modorum* (1728), say, or
 * Gasparini (1708) — means a new file exporting one of these plus one line in
 * `RULE_OF_OCTAVE_VERSIONS`. No engine code changes.
 */
export interface RuleOfOctaveVersion {
  readonly id: RuleOfOctaveVersionId;
  /** Human-readable name, shown in the settings screen and the descriptor. */
  readonly label: string;
  /** One-line attribution, for comments, tests and any future catalogue UI. */
  readonly source: string;
  readonly major: RuleOfOctaveModeTable;
  readonly minor: RuleOfOctaveModeTable;
}
