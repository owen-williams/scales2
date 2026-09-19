import { createElement } from 'react';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { exerciseKey } from '../domain/exercise';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { SettingsProvider, useSettings } from '../settings/SettingsProvider';
import type { SettingsContextValue } from '../settings/SettingsProvider';
import { STORAGE_KEY } from '../settings/storage';
import type { Settings } from '../settings/types';
import { usePractice } from './usePractice';
import type { Practice } from './usePractice';

/**
 * Settings are seeded through localStorage rather than through the provider's
 * API, because the provider hydrates once in a `useState` initialiser — this is
 * the only way to have a hook mount with settings already in place.
 */
function seed(overrides: Partial<Settings>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...overrides }));
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(SettingsProvider, null, children);
}

interface Harness {
  practice: Practice;
  settings: SettingsContextValue;
}

function useHarness(): Harness {
  return { practice: usePractice(), settings: useSettings() };
}

function keyOf(practice: Practice): string {
  const realised = practice.realised;
  if (realised === null) throw new Error('expected an exercise to be drawn');
  return exerciseKey(realised.exercise);
}

function render() {
  return renderHook(useHarness, { wrapper });
}

beforeEach(() => {
  localStorage.clear();
});

describe('usePractice', () => {
  it('draws a different exercise from a two-exercise pool as Next is pressed', () => {
    // Exactly two eligible exercises: C major and F major, one octave, right hand.
    seed({
      keys: [0, 5],
      families: ['major'],
      modes: [],
      motions: ['similar'],
      octaves: [1],
      directions: ['ascending'],
    });

    const { result } = render();
    expect(result.current.practice.poolSize).toBe(2);

    const seen = new Set<string>([keyOf(result.current.practice)]);
    for (let i = 0; i < 40; i += 1) {
      act(() => {
        result.current.practice.next();
      });
      seen.add(keyOf(result.current.practice));
    }

    // A uniform draw over two exercises misses one of them 40 times running
    // with probability 2^-39.
    expect(seen.size).toBe(2);
  });

  it('resets both visibility overrides on next', () => {
    seed({ notation: 'reveal', fingering: 'reveal' });
    const { result } = render();

    expect(result.current.practice.notationVisible).toBe(false);
    expect(result.current.practice.fingeringVisible).toBe(false);

    act(() => {
      result.current.practice.toggleNotation();
      result.current.practice.toggleFingering();
    });
    expect(result.current.practice.notationVisible).toBe(true);
    expect(result.current.practice.fingeringVisible).toBe(true);

    act(() => {
      result.current.practice.next();
    });
    expect(result.current.practice.notationVisible).toBe(false);
    expect(result.current.practice.fingeringVisible).toBe(false);
  });

  it('honours an "always" preference until it is overridden', () => {
    seed({ notation: 'always', fingering: 'hidden' });
    const { result } = render();

    expect(result.current.practice.notationVisible).toBe(true);
    expect(result.current.practice.fingeringVisible).toBe(false);

    // A shortcut may temporarily override a "hidden" preference, and hide an
    // "always" one.
    act(() => {
      result.current.practice.toggleNotation();
      result.current.practice.toggleFingering();
    });
    expect(result.current.practice.notationVisible).toBe(false);
    expect(result.current.practice.fingeringVisible).toBe(true);

    act(() => {
      result.current.practice.next();
    });
    expect(result.current.practice.notationVisible).toBe(true);
    expect(result.current.practice.fingeringVisible).toBe(false);
  });

  it('yields a null exercise when the settings admit nothing', () => {
    // Contrary motion stops at two octaves, so this pool is empty without any
    // list being empty (which storage would have repaired).
    seed({ motions: ['contrary'], octaves: [3, 4] });

    const { result } = render();

    expect(result.current.practice.poolSize).toBe(0);
    expect(result.current.practice.realised).toBeNull();
  });

  it('keeps the current exercise when a settings change leaves it eligible', () => {
    seed({
      keys: [0],
      families: ['major'],
      modes: [],
      motions: ['similar'],
      octaves: [1, 2, 3, 4],
      directions: ['ascending', 'descending', 'both'],
    });

    const { result } = render();
    const before = keyOf(result.current.practice);
    const poolBefore = result.current.practice.poolSize;

    act(() => {
      // Enabling another key widens the pool but cannot invalidate a C exercise.
      result.current.settings.toggle('keys', 5);
    });

    expect(result.current.practice.poolSize).toBe(poolBefore * 2);
    expect(keyOf(result.current.practice)).toBe(before);
  });

  it('redraws when a settings change makes the current exercise ineligible', () => {
    seed({
      keys: [0],
      families: ['major'],
      modes: [],
      motions: ['similar'],
      octaves: [1],
      directions: ['ascending'],
      notation: 'reveal',
    });

    const { result } = render();
    expect(result.current.practice.poolSize).toBe(1);
    expect(result.current.practice.realised?.exercise.tonic).toBe(0);

    act(() => {
      result.current.practice.toggleNotation();
    });
    expect(result.current.practice.notationVisible).toBe(true);

    act(() => {
      result.current.settings.setList('keys', [5]);
    });

    expect(result.current.practice.poolSize).toBe(1);
    expect(result.current.practice.realised?.exercise.tonic).toBe(5);
    // A forced redraw is a new exercise, so the overrides go with it.
    expect(result.current.practice.notationVisible).toBe(false);
  });
});
