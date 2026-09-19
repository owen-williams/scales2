import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { SettingsProvider } from '../settings/SettingsProvider';
import { STORAGE_KEY } from '../settings/storage';
import type { Settings } from '../settings/types';

vi.mock('../notation/ScoreView', () => ({
  ScoreView: ({ label }: { label: string }) => (
    <div data-testid="score" role="img" aria-label={label} />
  ),
}));

/*
 * jsdom ships the <dialog> element but not its modal behaviour: showModal() and
 * close() throw "not implemented". The component depends on the real element for
 * focus trapping and Esc, so rather than avoid it, give jsdom the minimum that
 * makes the open/closed state observable — the `open` attribute and the `close`
 * event. Everything the browser does for free (focus trap, inert background) is
 * simply absent here and is not what these tests assert.
 */
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

function seed(overrides: Partial<Settings>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...overrides }));
}

function storedSettings(): Settings {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) throw new Error('nothing persisted');
  return JSON.parse(raw) as Settings;
}

function poolCount(): number {
  const node = screen.getByText(/exercises? in the pool/);
  return Number((node.textContent ?? '').replace(/[^0-9]/g, ''));
}

function renderApp() {
  return render(
    <SettingsProvider>
      <App />
    </SettingsProvider>,
  );
}

async function openSettings() {
  const user = userEvent.setup();
  renderApp();
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  return user;
}

beforeEach(() => {
  localStorage.clear();
});

describe('settings dialog', () => {
  it('opens from the header button and closes again', async () => {
    const user = await openSettings();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleName('Settings');

    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    // Focus goes back where it came from, not to the top of the document.
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const user = await openSettings();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
  });

  it('closes on a backdrop click', async () => {
    const user = await openSettings();

    // A click on the backdrop is reported against the <dialog> element itself;
    // clicks on the contents are reported against the contents.
    await user.click(screen.getByRole('dialog'));

    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('toggles a key chip, updates aria-pressed and persists the change', async () => {
    const user = await openSettings();

    const chip = screen.getByRole('button', { name: 'C' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    await user.click(chip);

    expect(screen.getByRole('button', { name: 'C' })).toHaveAttribute('aria-pressed', 'false');
    expect(storedSettings().keys).not.toContain(0);

    await user.click(screen.getByRole('button', { name: 'C' }));
    expect(screen.getByRole('button', { name: 'C' })).toHaveAttribute('aria-pressed', 'true');
    expect(storedSettings().keys).toContain(0);
  });

  it('selects and clears every key at once', async () => {
    const user = await openSettings();

    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByRole('button', { name: 'C' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'F♯ / G♭' })).toHaveAttribute('aria-pressed', 'false');
    expect(storedSettings().keys).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByRole('button', { name: 'C' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'F♯ / G♭' })).toHaveAttribute('aria-pressed', 'true');
    expect(storedSettings().keys).toHaveLength(12);
  });

  it('keeps the pool count in step with the choices', async () => {
    const user = await openSettings();

    const before = poolCount();
    expect(before).toBeGreaterThan(0);

    // One key fewer out of twelve.
    await user.click(screen.getByRole('button', { name: 'C' }));
    expect(poolCount() * 12).toBe(before * 11);

    // One octave count fewer out of two.
    await user.click(screen.getByRole('button', { name: '1 Octave' }));
    expect(poolCount() * 24).toBe(before * 11);
  });

  it('warns, and says why, when the choices leave nothing to practise', async () => {
    // Both motions and only the long octave counts: still a full pool, because
    // similar motion happily runs to four octaves.
    seed({ motions: ['similar', 'contrary'], octaves: [3, 4] });
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Turning similar motion off leaves only contrary motion at 3 and 4
    // octaves, which runs off the ends of the keyboard.
    await user.click(screen.getByRole('button', { name: 'Similar Motion' }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No exercises match these settings.');
    expect(alert).toHaveTextContent(/Contrary motion only goes up to 2 octaves/);
    expect(screen.queryByText(/in the pool/)).not.toBeInTheDocument();
  });

  it('changes a visibility preference through the segmented control', async () => {
    const user = await openSettings();

    const always = screen.getAllByRole('radio', { name: 'Always' })[0];
    expect(always).toBeDefined();
    if (always === undefined) throw new Error('missing radio');
    await user.click(always);

    expect(storedSettings().notation).toBe('always');
  });

  describe('Rule of the Octave', () => {
    /** The chips of one Rule of the Octave row, by its legend. */
    const row = (legend: string) => within(screen.getByRole('group', { name: legend }));

    const versions = () => row('Rule of the Octave — Version');
    const modes = () => row('Rule of the Octave — Mode');
    const positions = () => row('Rule of the Octave — Position');

    it('ships switched off, with its modes and positions ready', async () => {
      await openSettings();

      // No version selected is how the rule is off: this is scale practice
      // first, and the rule changes its character.
      expect(versions().getByRole('button', { name: 'Fenaroli' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(versions().getByRole('button', { name: 'Campion' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      // Everything else is on, so turning a version on is the only step needed.
      for (const mode of ['Major', 'Minor']) {
        expect(modes().getByRole('button', { name: mode })).toHaveAttribute('aria-pressed', 'true');
      }
      for (const position of ['First Position', 'Second Position', 'Third Position']) {
        expect(positions().getByRole('button', { name: position })).toHaveAttribute(
          'aria-pressed',
          'true',
        );
      }
      expect(storedSettings().rooVersions).toEqual([]);
    });

    it('says what the rule is, and that the versions differ only in minor', async () => {
      await openSettings();

      const note = screen.getByText(/thoroughbass convention/);
      expect(note.textContent).toMatch(/chord over every degree of the scale/);
      expect(note.textContent).toMatch(/identical in major and differ at one chord in minor/);
    });

    it('adds the rule to the pool, and adds the second version only where it differs', async () => {
      const user = await openSettings();

      // The defaults: 12 keys x 5 families x 1 motion x 2 octaves x 1 direction.
      expect(poolCount()).toBe(120);

      // One version: 12 keys x 2 modes x 3 positions.
      await user.click(versions().getByRole('button', { name: 'Fenaroli' }));
      expect(storedSettings().rooVersions).toEqual(['fenaroli']);
      expect(poolCount()).toBe(120 + 12 * 2 * 3);
      expect(poolCount()).toBe(192);

      // The second version adds the minor half only — 12 keys x 3 positions —
      // because Campion's major rule is Fenaroli's, figure for figure.
      await user.click(versions().getByRole('button', { name: 'Campion' }));
      expect(storedSettings().rooVersions).toEqual(['fenaroli', 'campion']);
      expect(poolCount()).toBe(192 + 12 * 3);
      expect(poolCount()).toBe(228);
    });

    it('drops a mode and a position from the pool as they are switched off', async () => {
      seed({ rooVersions: ['fenaroli'], families: [], modes: [] });
      const user = userEvent.setup();
      renderApp();
      await user.click(screen.getByRole('button', { name: 'Settings' }));

      // Nothing but the rule: 12 keys x 2 modes x 3 positions.
      expect(poolCount()).toBe(72);

      await user.click(modes().getByRole('button', { name: 'Major' }));
      expect(storedSettings().rooModes).toEqual(['minor']);
      expect(poolCount()).toBe(36);

      await user.click(positions().getByRole('button', { name: 'Third Position' }));
      expect(storedSettings().rooPositions).toEqual([1, 2]);
      expect(poolCount()).toBe(24);
    });

    it('warns, and says why, when the rule is the only thing left and has no position', async () => {
      seed({ rooVersions: ['fenaroli'], families: [], modes: [] });
      const user = userEvent.setup();
      renderApp();
      await user.click(screen.getByRole('button', { name: 'Settings' }));

      for (const position of ['First Position', 'Second Position', 'Third Position']) {
        await user.click(positions().getByRole('button', { name: position }));
      }

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('No scale families or modes are selected.');
      expect(alert).toHaveTextContent('No position is selected for the Rule of the Octave.');
    });

    it('keeps the two Major chips apart: one is a scale family, one is the rule', async () => {
      const user = await openSettings();

      await user.click(modes().getByRole('button', { name: 'Major' }));

      // The scale family is untouched — the chips are in different fieldsets
      // and mean different things.
      expect(storedSettings().rooModes).toEqual(['minor']);
      expect(storedSettings().families).toEqual(DEFAULT_SETTINGS.families);
    });
  });

  it('restores the defaults', async () => {
    seed({ keys: [0], octaves: [4] });
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('button', { name: 'D' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    expect(screen.getByRole('button', { name: 'D' })).toHaveAttribute('aria-pressed', 'true');
    expect(storedSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
