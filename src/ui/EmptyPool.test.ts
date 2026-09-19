import { describe, expect, it } from 'vitest';

import { eligibleExercises } from '../domain/exercise';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { parseSettings } from '../settings/storage';
import type { Settings } from '../settings/types';
import { describePoolConflicts } from './EmptyPool';

const settings = (overrides: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...overrides });

/** Every sentence the function can produce. Nothing else may appear. */
const EVERY_MESSAGE = [
  'No keys are selected.',
  'No scale families or modes are selected.',
  'No motion is selected.',
  'No octave count is selected.',
  'No direction is selected.',
  'Contrary motion only goes up to 2 octaves. Add 1 or 2 octaves, or add similar motion.',
  'No mode is selected for the Rule of the Octave.',
  'No position is selected for the Rule of the Octave.',
] as const;

/**
 * A small grid over every axis: empty, and one or two non-empty values each.
 * 2 x 2 x 2 x 3 x 3 x 2 x 2 x 2 x 2 = 2,304 settings objects, which is enough
 * to reach every combination of empty and non-empty axes that matters.
 */
function* everySettings(): Generator<Settings> {
  for (const keys of [[], [0]] as const) {
    for (const families of [[], ['major']] as const) {
      for (const modes of [[], ['dorian']] as const) {
        for (const motions of [[], ['similar'], ['contrary']] as const) {
          for (const octaves of [[], [1], [3]] as const) {
            for (const directions of [[], ['both']] as const) {
              for (const rooVersions of [[], ['fenaroli']] as const) {
                for (const rooModes of [[], ['minor']] as const) {
                  for (const rooPositions of [[], [1]] as const) {
                    yield settings({
                      keys: [...keys],
                      families: [...families],
                      modes: [...modes],
                      motions: [...motions],
                      octaves: [...octaves],
                      directions: [...directions],
                      rooVersions: [...rooVersions],
                      rooModes: [...rooModes],
                      rooPositions: [...rooPositions],
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

describe('describePoolConflicts', () => {
  it('says nothing while there is anything at all to draw', () => {
    for (const s of everySettings()) {
      if (eligibleExercises(s).length > 0) {
        expect(describePoolConflicts(s), JSON.stringify(s)).toEqual([]);
      }
    }
  });

  it('gives every empty pool at least one reason', () => {
    for (const s of everySettings()) {
      if (eligibleExercises(s).length === 0) {
        expect(describePoolConflicts(s).length, JSON.stringify(s)).toBeGreaterThan(0);
      }
    }
  });

  it('produces every message it can produce, and no message it cannot', () => {
    const seen = new Set<string>();
    for (const s of everySettings()) for (const reason of describePoolConflicts(s)) seen.add(reason);

    // Reachability in both directions: nothing unexpected escapes, and no
    // message describes a situation the settings cannot reach.
    expect([...seen].sort()).toEqual([...EVERY_MESSAGE].sort());
  });

  it('never lists a reason that is not true of the settings it was given', () => {
    for (const s of everySettings()) {
      const reasons = describePoolConflicts(s);
      if (reasons.includes('No keys are selected.')) expect(s.keys).toEqual([]);
      if (reasons.includes('No motion is selected.')) expect(s.motions).toEqual([]);
      if (reasons.includes('No octave count is selected.')) expect(s.octaves).toEqual([]);
      if (reasons.includes('No direction is selected.')) expect(s.directions).toEqual([]);
      if (reasons.includes('No mode is selected for the Rule of the Octave.')) {
        expect(s.rooModes).toEqual([]);
        expect(s.rooVersions.length).toBeGreaterThan(0);
      }
      if (reasons.includes('No position is selected for the Rule of the Octave.')) {
        expect(s.rooPositions).toEqual([]);
        expect(s.rooVersions.length).toBeGreaterThan(0);
      }
    }
  });

  it('explains an empty pool that only the scales could have filled', () => {
    expect(describePoolConflicts(settings({ families: [], modes: [] }))).toEqual([
      'No scale families or modes are selected.',
    ]);
    expect(describePoolConflicts(settings({ keys: [] }))).toEqual(['No keys are selected.']);
    expect(describePoolConflicts(settings({ motions: ['contrary'], octaves: [3, 4] }))).toEqual([
      'Contrary motion only goes up to 2 octaves. Add 1 or 2 octaves, or add similar motion.',
    ]);
  });

  it('keeps quiet about a rule that is simply switched off', () => {
    // The default. An empty pool here is the scales' doing, and telling the
    // user that a feature they never turned on is off would be noise.
    const reasons = describePoolConflicts(settings({ families: [], modes: [] }));
    expect(reasons.join(' ')).not.toMatch(/Rule of the Octave/);
  });

  it('explains both halves when the rule is on and neither half can fill the pool', () => {
    expect(
      describePoolConflicts(
        settings({ families: [], modes: [], rooVersions: ['fenaroli'], rooPositions: [] }),
      ),
    ).toEqual([
      'No scale families or modes are selected.',
      'No position is selected for the Rule of the Octave.',
    ]);

    expect(
      describePoolConflicts(
        settings({ families: [], modes: [], rooVersions: ['campion'], rooModes: [] }),
      ),
    ).toEqual([
      'No scale families or modes are selected.',
      'No mode is selected for the Rule of the Octave.',
    ]);
  });

  it('says nothing when the rule alone is filling the pool, however the scales are set', () => {
    // Every scale axis empty, and still plenty to practise.
    const ruleOnly = settings({
      families: [],
      modes: [],
      motions: [],
      octaves: [],
      directions: [],
      rooVersions: ['fenaroli'],
    });
    expect(eligibleExercises(ruleOnly).length).toBeGreaterThan(0);
    expect(describePoolConflicts(ruleOnly)).toEqual([]);
  });

  it('cannot be reached with the rule on, once the settings have been through storage', () => {
    // Only `rooVersions` may persist empty, and every other list is restored
    // when it is, so a saved payload with the rule on always has something to
    // draw. The rule's own conflict lines are therefore in-session only —
    // reachable from the settings dialog, never from a reload.
    for (const s of everySettings()) {
      const persisted = parseSettings(JSON.parse(JSON.stringify(s)));
      if (persisted.rooVersions.length > 0) {
        expect(eligibleExercises(persisted).length).toBeGreaterThan(0);
        expect(describePoolConflicts(persisted)).toEqual([]);
      }
    }
  });
});
