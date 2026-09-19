import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { DIRECTION_OPTIONS } from '../domain/types';
import { DEFAULT_SETTINGS } from './defaults';
import { STORAGE_KEY } from './storage';
import { SettingsProvider, useSettings } from './SettingsProvider';
import type { Settings } from './types';

function readStoredSettings(): Settings | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : (JSON.parse(raw) as Settings);
}

/** Exercises every action so tests can assert on both rendered state and storage. */
function Probe() {
  const { settings, toggle, setList, setVisibility, reset } = useSettings();
  return (
    <div>
      <div data-testid="keys">{settings.keys.join(',')}</div>
      <div data-testid="families">{settings.families.join(',')}</div>
      <div data-testid="modes">{settings.modes.join(',')}</div>
      <div data-testid="directions">{settings.directions.join(',')}</div>
      <div data-testid="notation">{settings.notation}</div>
      <div data-testid="fingering">{settings.fingering}</div>
      <button onClick={() => toggle('modes', 'dorian')}>toggle-mode-dorian</button>
      <button onClick={() => toggle('families', 'chromatic')}>toggle-family-chromatic</button>
      <button onClick={() => toggle('keys', 0)}>toggle-key-0</button>
      <button onClick={() => setList('keys', [4, 7])}>set-keys-4-7</button>
      <button onClick={() => setList('directions', ['descending', 'ascending'])}>
        set-directions-descending-ascending
      </button>
      <button onClick={() => setVisibility('notation', 'hidden')}>hide-notation</button>
      <button onClick={() => reset()}>reset</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <SettingsProvider>
      <Probe />
    </SettingsProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('useSettings', () => {
  it('throws a clear error when used outside a SettingsProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => renderHook(() => useSettings())).toThrow(/SettingsProvider/);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe('SettingsProvider', () => {
  it('hydrates from an empty store with DEFAULT_SETTINGS (no flash of anything else)', () => {
    renderProbe();
    expect(screen.getByTestId('keys')).toHaveTextContent(DEFAULT_SETTINGS.keys.join(','));
    expect(screen.getByTestId('families')).toHaveTextContent(DEFAULT_SETTINGS.families.join(','));
    expect(screen.getByTestId('modes')).toHaveTextContent('');
    expect(screen.getByTestId('notation')).toHaveTextContent(DEFAULT_SETTINGS.notation);
  });

  it('hydrates from existing localStorage content on mount', () => {
    const stored: Settings = { ...DEFAULT_SETTINGS, notation: 'hidden', keys: [1, 3, 5] };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    renderProbe();

    expect(screen.getByTestId('notation')).toHaveTextContent('hidden');
    expect(screen.getByTestId('keys')).toHaveTextContent('1,3,5');
  });

  it('hydrates safely (falls back to defaults) from corrupt localStorage content', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not json at all');

    renderProbe();

    expect(screen.getByTestId('keys')).toHaveTextContent(DEFAULT_SETTINGS.keys.join(','));
  });

  it('toggle adds a value that is not present, and persists it', () => {
    renderProbe();
    expect(screen.getByTestId('modes')).toHaveTextContent('');

    fireEvent.click(screen.getByText('toggle-mode-dorian'));

    expect(screen.getByTestId('modes')).toHaveTextContent('dorian');
    expect(readStoredSettings()?.modes).toEqual(['dorian']);
  });

  it('toggle removes a value that is present, and persists it', () => {
    renderProbe();
    // chromatic is enabled by default.
    expect(screen.getByTestId('families')).toHaveTextContent('chromatic');

    fireEvent.click(screen.getByText('toggle-family-chromatic'));

    expect(screen.getByTestId('families')).not.toHaveTextContent('chromatic');
    expect(readStoredSettings()?.families).toEqual(['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor']);
  });

  it('toggle inserts in canonical order rather than appending', () => {
    renderProbe();
    fireEvent.click(screen.getByText('set-keys-4-7')); // -> [4, 7]
    expect(screen.getByTestId('keys')).toHaveTextContent('4,7');

    fireEvent.click(screen.getByText('toggle-key-0')); // 0 belongs before 4 and 7

    expect(screen.getByTestId('keys')).toHaveTextContent('0,4,7');
    expect(readStoredSettings()?.keys).toEqual([0, 4, 7]);
  });

  it('setList replaces the list wholesale, reordered canonically, and persists it', () => {
    renderProbe();

    // Input order: descending, ascending.
    fireEvent.click(screen.getByText('set-directions-descending-ascending'));

    // DIRECTION_OPTIONS canonical order is ascending, descending, both.
    expect(screen.getByTestId('directions')).toHaveTextContent('ascending,descending');
    expect(readStoredSettings()?.directions).toEqual(
      DIRECTION_OPTIONS.filter((d) => d !== 'both'),
    );
  });

  it('setVisibility updates only the targeted key, and persists it', () => {
    renderProbe();

    fireEvent.click(screen.getByText('hide-notation'));

    expect(screen.getByTestId('notation')).toHaveTextContent('hidden');
    expect(screen.getByTestId('fingering')).toHaveTextContent(DEFAULT_SETTINGS.fingering);
    expect(readStoredSettings()?.notation).toBe('hidden');
    expect(readStoredSettings()?.fingering).toBe(DEFAULT_SETTINGS.fingering);
  });

  it('reset restores DEFAULT_SETTINGS and persists it', () => {
    renderProbe();
    fireEvent.click(screen.getByText('hide-notation'));
    fireEvent.click(screen.getByText('toggle-mode-dorian'));
    expect(screen.getByTestId('notation')).toHaveTextContent('hidden');

    fireEvent.click(screen.getByText('reset'));

    expect(screen.getByTestId('notation')).toHaveTextContent(DEFAULT_SETTINGS.notation);
    expect(screen.getByTestId('modes')).toHaveTextContent('');
    expect(readStoredSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
