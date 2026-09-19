import { describe, expect, it } from 'vitest';

import { distinctVersionsFor, realiseRuleOfOctave, ruleOfOctaveTable } from './index';
import { ROO_POSITIONS, ROO_VERSION_IDS } from '../types';
import type { PitchClass, RuleOfOctaveExercise, RuleOfOctaveVersionId } from '../types';
import type { RuleRow } from './types';

/**
 * Two versions of the rule that agree are one exercise wearing two names.
 *
 * These tests are about that collapse: that it happens where the sources really
 * do agree, that it does not happen where they part company, and — the point of
 * doing it structurally — that the answer is read off the tables rather than
 * hard-coded as "major is version-independent". A third version that differs in
 * major must simply work.
 */

const MODES = ['major', 'minor'] as const;
const ALL_KEYS: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const exercise = (
  tonic: PitchClass,
  mode: 'major' | 'minor',
  version: RuleOfOctaveVersionId,
  position: (typeof ROO_POSITIONS)[number],
): RuleOfOctaveExercise => ({ kind: 'ruleOfOctave', mode, tonic, version, position });

/** The fifteen slots of a table, ascending then descending. */
function rows(version: RuleOfOctaveVersionId, mode: 'major' | 'minor'): readonly RuleRow[] {
  const table = ruleOfOctaveTable(version, mode);
  return [...table.ascending, ...table.descending];
}

/** Just the notes: bass degree, its alteration and the three upper voices. */
function music(row: RuleRow): string {
  if (row === null) return 'null';
  const upper = row.upper.map((v) => `${String(v.degree)}${v.alter >= 0 ? '+' : ''}${String(v.alter)}`);
  return `${String(row.bass)}${row.bassAlter >= 0 ? '+' : ''}${String(row.bassAlter)} [${upper.join(' ')}]`;
}

describe('the curated fact distinctVersionsFor reads', () => {
  it('has Campion and Fenaroli agreeing on all fifteen slots in major', () => {
    expect(rows('campion', 'major').map(music)).toEqual(rows('fenaroli', 'major').map(music));
  });

  it('has them disagreeing in minor at exactly one slot, the descending sixth degree', () => {
    const campion = rows('campion', 'minor').map(music);
    const fenaroli = rows('fenaroli', 'minor').map(music);
    expect(campion).toHaveLength(fenaroli.length);

    const differing = campion
      .map((row, index) => (row === fenaroli[index] ? null : index))
      .filter((index): index is number => index !== null);

    // Slot 8 is the first of the descending half (index 8: eight slots up,
    // then the descending seventh), so slot 9 is the descending sixth.
    expect(differing).toEqual([9]);
    // Fenaroli's augmented sixth against Campion's plain four-three: the raised
    // fourth degree is the whole of the difference.
    expect(fenaroli[9]).toBe('6+0 [2+0 4+1 1+0]');
    expect(campion[9]).toBe('6+0 [2+0 4+0 1+0]');
  });
});

describe('distinctVersionsFor', () => {
  it('collapses both versions onto one in major', () => {
    expect(distinctVersionsFor('major', ROO_VERSION_IDS)).toEqual(['fenaroli']);
  });

  it('keeps both in minor', () => {
    expect(distinctVersionsFor('minor', ROO_VERSION_IDS)).toEqual(['fenaroli', 'campion']);
  });

  it('returns nothing for an empty selection — the rule switched off', () => {
    for (const mode of MODES) expect(distinctVersionsFor(mode, [])).toEqual([]);
  });

  it('returns a single enabled version unchanged, in either mode', () => {
    for (const mode of MODES) {
      for (const id of ROO_VERSION_IDS) {
        expect(distinctVersionsFor(mode, [id])).toEqual([id]);
      }
    }
  });

  it('keeps canonical order however the selection was ordered', () => {
    expect(distinctVersionsFor('minor', ['campion', 'fenaroli'])).toEqual(['fenaroli', 'campion']);
    expect(distinctVersionsFor('minor', ['fenaroli', 'campion'])).toEqual(['fenaroli', 'campion']);
  });

  it('returns the first member of each equal group', () => {
    // Fenaroli leads the canonical order, so it is the survivor in major —
    // and Campion on its own is still Campion, never silently swapped.
    expect(distinctVersionsFor('major', ['campion', 'fenaroli'])).toEqual(['fenaroli']);
    expect(distinctVersionsFor('major', ['campion'])).toEqual(['campion']);
  });

  it('drops duplicates and anything it does not recognise', () => {
    const hostile = ['campion', 'fenaroli', 'fenaroli', 'heinichen', ''] as unknown as
      readonly RuleOfOctaveVersionId[];
    expect(distinctVersionsFor('minor', hostile)).toEqual(['fenaroli', 'campion']);
    expect(distinctVersionsFor('major', hostile)).toEqual(['fenaroli']);
  });

  it('never returns anything that was not enabled, and never returns nothing for a real selection', () => {
    const selections: readonly (readonly RuleOfOctaveVersionId[])[] = [
      ['fenaroli'],
      ['campion'],
      ['fenaroli', 'campion'],
    ];
    for (const mode of MODES) {
      for (const enabled of selections) {
        const kept = distinctVersionsFor(mode, enabled);
        expect(kept.length).toBeGreaterThan(0);
        expect(kept.every((id) => enabled.includes(id))).toBe(true);
        expect(new Set(kept).size).toBe(kept.length);
      }
    }
  });

  it('drops only versions that produce identical music, note for note, in every key', () => {
    // The real proof that the collapse loses nothing: in major the dropped
    // version realises to exactly the same score as the one kept.
    for (const tonic of ALL_KEYS) {
      for (const position of ROO_POSITIONS) {
        expect(realiseRuleOfOctave(exercise(tonic, 'major', 'campion', position))).toEqual(
          realiseRuleOfOctave(exercise(tonic, 'major', 'fenaroli', position)),
        );
      }
    }
  });

  it('keeps versions whose music really differs, in every key', () => {
    for (const tonic of ALL_KEYS) {
      for (const position of ROO_POSITIONS) {
        expect(realiseRuleOfOctave(exercise(tonic, 'minor', 'campion', position))).not.toEqual(
          realiseRuleOfOctave(exercise(tonic, 'minor', 'fenaroli', position)),
        );
      }
    }
  });

  it('agrees with the realised music for every selection and mode', () => {
    // The invariant that makes the pool honest, stated directly: two enabled
    // versions survive together if and only if they sound different. Nothing
    // here mentions "major" — the answer follows from the tables, so adding a
    // version that differs in major needs no change to the rule that keeps it.
    for (const mode of MODES) {
      const kept = distinctVersionsFor(mode, ROO_VERSION_IDS);
      for (const id of ROO_VERSION_IDS) {
        const sameAsSomeSurvivor = kept.some(
          (survivor) =>
            JSON.stringify(realiseRuleOfOctave(exercise(0, mode, survivor, 1))) ===
            JSON.stringify(realiseRuleOfOctave(exercise(0, mode, id, 1))),
        );
        expect(sameAsSomeSurvivor).toBe(true);
      }
      for (const [i, a] of kept.entries()) {
        for (const b of kept.slice(i + 1)) {
          expect(realiseRuleOfOctave(exercise(0, mode, a, 1))).not.toEqual(
            realiseRuleOfOctave(exercise(0, mode, b, 1)),
          );
        }
      }
    }
  });
});
