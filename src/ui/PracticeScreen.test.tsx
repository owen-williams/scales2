import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { SettingsProvider } from '../settings/SettingsProvider';
import { STORAGE_KEY } from '../settings/storage';
import type { Settings } from '../settings/types';

// OSMD needs a real layout engine and is slow to load; the score is not what
// these tests are about, so it never runs here.
// `showFingerings` is surfaced as an attribute because fingerings are now
// engraved on the score itself rather than listed beside it, so it is the only
// place these tests can observe the fingering preference taking effect.
vi.mock('../notation/ScoreView', () => ({
  ScoreView: ({ label, showFingerings }: { label: string; showFingerings: boolean }) => (
    <div
      data-testid="score"
      data-fingerings={String(showFingerings)}
      role="img"
      aria-label={label}
    />
  ),
}));

// jsdom implements <dialog> but not showModal()/close(); the settings shortcut
// opens one, so give it just enough behaviour to be observable.
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

/** One exercise only: C Major, similar motion, 2 octaves, up and down. */
const SINGLE: Partial<Settings> = {
  keys: [0],
  families: ['major'],
  modes: [],
  motions: ['similar'],
  octaves: [2],
  directions: ['both'],
};

/** Two exercises with different names: C Major and F Major. */
const PAIR: Partial<Settings> = { ...SINGLE, keys: [0, 5], octaves: [1], directions: ['ascending'] };

function renderApp() {
  return render(
    <SettingsProvider>
      <App />
    </SettingsProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('practice screen', () => {
  it('shows the scale name and the exercise meta line', () => {
    seed(SINGLE);
    renderApp();

    expect(screen.getByText('C Major')).toBeInTheDocument();

    // Each descriptor is its own element with the separators between them, so
    // the line has to be read off the container rather than matched whole.
    const meta = screen.getByText('Both Hands').parentElement;
    expect(meta).toHaveClass('headline__meta');
    expect(meta?.textContent).toBe(
      'Both Hands · Similar Motion · 2 Octaves · Ascending & Descending',
    );
  });

  it('announces the whole exercise as one sentence in a live region', () => {
    seed(SINGLE);
    renderApp();

    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent(
      'C Major. Both hands, similar motion, 2 octaves, ascending and descending.',
    );
  });

  it('draws a new exercise when Next is pressed', async () => {
    seed(PAIR);
    const user = userEvent.setup();
    renderApp();

    const next = screen.getByRole('button', { name: 'Next' });
    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      seen.add(screen.getByRole('status').textContent ?? '');
      await user.click(next);
    }

    expect([...seen].some((text) => text.includes('C Major'))).toBe(true);
    expect([...seen].some((text) => text.includes('F Major'))).toBe(true);
  });

  it('draws a new exercise when Space is pressed', async () => {
    seed(PAIR);
    const user = userEvent.setup();
    renderApp();

    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      seen.add(screen.getByRole('status').textContent ?? '');
      // Focus is on the body, so this reaches the document-level shortcut
      // rather than activating a focused button.
      await user.keyboard(' ');
    }

    expect([...seen].some((text) => text.includes('C Major'))).toBe(true);
    expect([...seen].some((text) => text.includes('F Major'))).toBe(true);
  });

  describe('reveal preferences', () => {
    it('offers Show buttons when the preference is "reveal"', async () => {
      seed({ ...SINGLE, notation: 'reveal', fingering: 'reveal' });
      const user = userEvent.setup();
      renderApp();

      expect(screen.queryByTestId('score')).not.toBeInTheDocument();
      // Nothing to put fingerings on yet, so no control for them either.
      expect(screen.queryByRole('button', { name: /fingering/i })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Show notation' }));
      expect(screen.getByTestId('score')).toHaveAttribute('data-fingerings', 'false');
      expect(screen.getByRole('button', { name: 'Hide notation' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );

      await user.click(screen.getByRole('button', { name: 'Show fingering' }));
      expect(screen.getByTestId('score')).toHaveAttribute('data-fingerings', 'true');

      await user.click(screen.getByRole('button', { name: 'Hide notation' }));
      expect(screen.queryByTestId('score')).not.toBeInTheDocument();
    });

    it('shows a fingered score and no buttons when the preference is "always"', () => {
      seed({ ...SINGLE, notation: 'always', fingering: 'always' });
      renderApp();

      expect(screen.getByTestId('score')).toHaveAttribute('data-fingerings', 'true');
      expect(screen.queryByRole('button', { name: /notation/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /fingering/i })).not.toBeInTheDocument();
    });

    it('shows nothing when the preference is "hidden", but the shortcut still works', async () => {
      seed({ ...SINGLE, notation: 'hidden', fingering: 'hidden' });
      const user = userEvent.setup();
      renderApp();

      expect(screen.queryByTestId('score')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /notation/i })).not.toBeInTheDocument();

      await user.keyboard('n');
      expect(screen.getByTestId('score')).toHaveAttribute('data-fingerings', 'false');

      await user.keyboard('f');
      expect(screen.getByTestId('score')).toHaveAttribute('data-fingerings', 'true');
    });

    it('resets a revealed panel when the next exercise is drawn', async () => {
      seed({ ...SINGLE, notation: 'reveal' });
      const user = userEvent.setup();
      renderApp();

      await user.click(screen.getByRole('button', { name: 'Show notation' }));
      expect(screen.getByTestId('score')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.queryByTestId('score')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show notation' })).toBeInTheDocument();
    });
  });

  describe('fingering', () => {
    it('keeps the fingering off the score while the preference hides it', () => {
      seed({ ...SINGLE, notation: 'always', fingering: 'hidden' });
      renderApp();

      expect(screen.getByTestId('score')).toHaveAttribute('data-fingerings', 'false');
    });

    it('says so plainly when a scale has no curated fingering', () => {
      const DORIAN: Partial<Settings> = {
        keys: [0],
        families: [],
        modes: ['dorian'],
        motions: ['similar'],
        octaves: [1],
        directions: ['ascending'],
        notation: 'always',
        fingering: 'always',
      };
      seed(DORIAN);
      renderApp();

      expect(screen.getByText('C Dorian')).toBeInTheDocument();
      expect(screen.getByText('No curated fingering for this scale.')).toBeInTheDocument();
      // Nothing to engrave and nothing to toggle, so no control is offered.
      expect(screen.getByTestId('score')).toHaveAttribute('data-fingerings', 'false');
      expect(screen.queryByRole('button', { name: /fingering/i })).not.toBeInTheDocument();
    });
  });

  describe('the Rule of the Octave', () => {
    /** Nothing but the rule: one key, one mode, one version, one position. */
    const RULE: Partial<Settings> = {
      keys: [0],
      families: [],
      modes: [],
      rooVersions: ['fenaroli'],
      rooModes: ['minor'],
      rooPositions: [1],
    };

    it('shows the key as the title and the rule in the meta line, saying it once', () => {
      seed(RULE);
      renderApp();

      expect(screen.getByText('C Minor')).toBeInTheDocument();

      const meta = screen.getByText('Rule of the Octave').parentElement;
      expect(meta).toHaveClass('headline__meta');
      expect(meta?.textContent).toBe('Rule of the Octave · Fenaroli · First Position');
      // Once on the screen, not twice: the title carries the key, the meta line
      // carries the rule.
      expect(screen.getByRole('status').textContent?.match(/Rule of the Octave/g)).toHaveLength(1);
    });

    it('leaves the version out in major, where the two versions are the same music', () => {
      seed({ ...RULE, rooModes: ['major'], rooVersions: ['fenaroli', 'campion'] });
      renderApp();

      expect(screen.getByText('C Major')).toBeInTheDocument();
      expect(screen.getByText('Rule of the Octave').parentElement?.textContent).toBe(
        'Rule of the Octave · First Position',
      );
      expect(screen.queryByText('Fenaroli')).not.toBeInTheDocument();
      expect(screen.queryByText('Campion')).not.toBeInTheDocument();
    });

    it('announces the whole exercise as one sentence', () => {
      seed(RULE);
      renderApp();

      expect(screen.getByRole('status')).toHaveTextContent(
        'C Minor. Rule of the octave, fenaroli, first position.',
      );
    });

    it('says nothing about fingering: the rule is not a scale and never carries any', () => {
      seed({ ...RULE, notation: 'always', fingering: 'always' });
      renderApp();

      // The "no curated fingering" line is about the modes the catalogue does
      // not cover. Chord fingerings are not standard curated data, so for the
      // rule there is no absence to explain — and it is not a scale.
      expect(screen.queryByText('No curated fingering for this scale.')).not.toBeInTheDocument();
      expect(screen.queryByText(/curated fingering/)).not.toBeInTheDocument();
      // Nothing to engrave, so no control is offered either.
      expect(screen.getByTestId('score')).toHaveAttribute('data-fingerings', 'false');
      expect(screen.queryByRole('button', { name: /fingering/i })).not.toBeInTheDocument();
    });

    it('shares one pool with the scales, and Next draws from all of it', async () => {
      // One scale and one rule exercise, so both must appear — the draw is
      // uniform over the concatenated pool, with no separate dice for the kind.
      seed({
        ...RULE,
        families: ['major'],
        motions: ['similar'],
        octaves: [1],
        directions: ['ascending'],
      });
      const user = userEvent.setup();
      renderApp();

      const next = screen.getByRole('button', { name: 'Next' });
      const seen = new Set<string>();
      for (let i = 0; i < 40; i += 1) {
        seen.add(screen.getByRole('status').textContent ?? '');
        await user.click(next);
      }

      expect([...seen].some((text) => text.includes('C Major. Both hands'))).toBe(true);
      expect([...seen].some((text) => text.includes('C Minor. Rule of the octave'))).toBe(true);
    });
  });

  it('opens settings with the S shortcut', async () => {
    seed(SINGLE);
    const user = userEvent.setup();
    renderApp();

    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
    await user.keyboard('s');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('lets a focused button keep Space for itself instead of also firing Next', async () => {
    seed({ ...SINGLE, notation: 'reveal' });
    const user = userEvent.setup();
    renderApp();

    screen.getByRole('button', { name: 'Show notation' }).focus();
    await user.keyboard(' ');

    // The browser turns Space on a focused button into a click. Had the
    // document shortcut fired as well, Next would have redrawn the exercise and
    // reset the override, closing the panel again.
    expect(screen.getByTestId('score')).toBeInTheDocument();
  });

  it('explains an empty pool instead of showing a broken exercise', () => {
    seed({ motions: ['contrary'], octaves: [3, 4] });
    renderApp();

    expect(screen.getByRole('heading', { name: 'Nothing to practise' })).toBeInTheDocument();
    expect(screen.getByText(/Contrary motion only goes up to 2 octaves/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeInTheDocument();
  });
});
