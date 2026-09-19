/**
 * Renders MusicXML with OpenSheetMusicDisplay.
 *
 * OSMD is a large, imperative, DOM-mutating library, so the whole component is
 * built around three worries:
 *
 * 1. **Never crash the app.** Every OSMD call is inside a try/catch; a failure
 *    degrades to a plain-text fallback rather than taking the practice screen
 *    down with it.
 * 2. **Never render a stale score.** Loading and parsing are asynchronous while
 *    the Next button is not, so every async continuation is guarded by a
 *    generation token that a newer render invalidates.
 * 3. **Be cheap on resize.** OSMD re-lays-out from the container width, so
 *    resizes are debounced and ignored unless the width actually moved.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { IOSMDOptions, OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

export interface ScoreViewProps {
  musicXml: string;
  showFingerings: boolean;
  /** Accessible description, e.g. "Notation for E♭ Harmonic Minor, both hands, similar motion, 2 octaves". */
  label: string;
}

type Status = 'loading' | 'ready' | 'error';

/** How long to wait for resizing to settle before re-laying-out the score. */
const RESIZE_DEBOUNCE_MS = 120;
/** Box changes smaller than this are not worth a re-render. */
const BOX_EPSILON_PX = 4;

/** What was last handed to OSMD; a change in any of it forces a reload. */
interface LoadedSignature {
  readonly musicXml: string;
  readonly showFingerings: boolean;
  readonly colour: string;
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/**
 * OSMD wants a `#rrggbb` string, while `getComputedStyle` hands back whatever
 * the browser felt like — usually `rgb(r, g, b)`. Anything unrecognised yields
 * null, in which case the option is omitted and OSMD keeps its own default.
 */
function toHexColour(css: string): string | null {
  const value = css.trim();
  if (value === '') return null;

  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    const [, r = '', g = '', b = ''] = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value) ?? [];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(value);
  if (rgb) {
    const channels = [rgb[1], rgb[2], rgb[3]].map((part) => {
      const n = Math.round(Number(part));
      return Number.isFinite(n) ? Math.min(255, Math.max(0, n)) : 0;
    });
    return `#${channels.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  }

  return null;
}

/** The colour the score should be drawn in: whatever CSS says the text colour is. */
function readColour(element: HTMLElement): string {
  try {
    return toHexColour(window.getComputedStyle(element).color) ?? '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// OSMD lifecycle helpers
// ---------------------------------------------------------------------------

function buildOptions(showFingerings: boolean, colour: string): IOSMDOptions {
  return {
    // We drive layout from our own ResizeObserver, so OSMD must not also bind
    // a window resize handler of its own.
    autoResize: false,
    backend: 'svg',
    drawingParameters: 'compacttight',
    drawTitle: false,
    drawSubtitle: false,
    drawCredits: false,
    drawComposer: false,
    drawLyricist: false,
    drawPartNames: false,
    drawPartAbbreviations: false,
    drawMeasureNumbers: false,
    drawMetronomeMarks: false,
    disableCursor: true,
    drawFingerings: showFingerings,
    ...(colour === '' ? {} : { defaultColorMusic: colour }),
  };
}

/**
 * OSMD 1.9 exposes no `dispose()`, so tearing an instance down means clearing
 * what it drew and dropping the reference. The `dispose` probe is there so a
 * future version that grows one is used automatically.
 */
function teardown(osmd: OpenSheetMusicDisplay | null, container: HTMLElement | null): void {
  if (osmd !== null) {
    try {
      const maybeDisposable = osmd as unknown as { dispose?: () => void };
      if (typeof maybeDisposable.dispose === 'function') {
        maybeDisposable.dispose();
      } else {
        osmd.clear();
      }
    } catch {
      // A half-initialised instance can throw on clear; there is nothing useful
      // to do about it during teardown.
    }
  }
  if (container !== null) {
    try {
      container.replaceChildren();
    } catch {
      // Ignore: the container may already be detached.
    }
  }
}

/**
 * How much larger than life size a score may be drawn. The app is read from a
 * piano stool rather than a desk, so this is deliberately generous — it is what
 * lets a one- or two-octave scale fill a laptop panel instead of floating in
 * the middle of it — but bounded, so the notation never turns cartoonish.
 */
const MAX_ZOOM = 2.5;
/**
 * How far it may be shrunk. Four octaves in both hands on a small phone genuinely
 * is tiny — 194 notes across two staves in 300 points of width — but the app's
 * promise is that everything stays on one screen, so the floor is set by what
 * fits rather than by what is comfortable.
 */
const MIN_ZOOM = 0.12;
/** Don't re-render for a change too small to see. */
const ZOOM_EPSILON = 0.02;

/** How tall the music OSMD just drew actually is, in CSS pixels. */
function drawnHeight(container: HTMLElement): number {
  const svg = container.querySelector('svg');
  if (svg === null) return 0;
  const height = Number(svg.getAttribute('height') ?? Number.NaN);
  return Number.isFinite(height) ? height : 0;
}

/**
 * Choose the largest zoom at which this score still fits its panel, by trying
 * sizes and keeping the biggest one that fitted.
 *
 * Searching rather than calculating, because the obvious calculations do not
 * work. Height is not proportional to zoom: growing the score rewraps the music
 * onto a different number of systems, and the height jumps when it does. Width
 * is no help either — OSMD lays a score out to the container and leaves a right
 * margin on a partial system, so the engraved width barely responds to zoom at
 * all, and a ratio built on it never converges.
 *
 * So: probe, measure, narrow. `best` only ever holds a zoom that was measured to
 * fit, and the caller renders at `best` last, which is what makes "it never
 * overflows" true rather than usually true. Bounded to a handful of renders,
 * each of which is a few milliseconds.
 */
function searchZoom(params: {
  container: HTMLElement;
  renderAt: (zoom: number) => void;
  isCurrent: () => boolean;
}): { zoom: number; rendered: number } | null {
  const { container, renderAt, isCurrent } = params;
  const available = container.clientHeight;
  if (available <= 0) return null;

  /** Leave the score a little air rather than butting it against the edges. */
  const target = available * 0.94;

  let rendered = Number.NaN;
  const measure = (zoom: number): number | null => {
    renderAt(zoom);
    if (!isCurrent()) return null;
    rendered = zoom;
    return drawnHeight(container);
  };

  const first = measure(1);
  if (first === null) return null;
  if (first <= 0) return null;

  // `low` is the largest zoom known to fit and `high` the smallest known not to,
  // so the answer is always between them. `best` holds only a zoom that was
  // measured and did fit — never a guess — which is what lets the caller finish
  // by rendering something known to be safe.
  let best: number | null = first <= target ? 1 : null;
  let low = best === null ? MIN_ZOOM : 1;
  let high = best === null ? 1 : MAX_ZOOM;

  // Start from the proportional guess. It is exact when the music does not
  // rewrap, and a tight bound when it does, so it is worth far more than a
  // blind bisection step — which is why it is measured rather than assumed.
  let candidate = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, target / first));

  for (let probe = 0; probe < 4; probe += 1) {
    // Nothing left to learn: the next probe would redraw what is already on
    // screen, and each probe is a full engraving.
    if (Math.abs(candidate - rendered) <= ZOOM_EPSILON) break;

    const height = measure(candidate);
    if (height === null) return null;

    if (height <= target) {
      best = candidate;
      low = candidate;
    } else {
      high = candidate;
    }
    candidate = (low + high) / 2;
  }

  if (best === null) {
    // Nothing tried fitted, so fall back to the floor — and measure it, so the
    // promise that the final render was measured holds even here. If even this
    // overflows there is no zoom that would not, and the CSS max-height on the
    // SVG clips it rather than letting it escape the panel.
    if (measure(MIN_ZOOM) === null) return null;
    best = MIN_ZOOM;
  }

  return { zoom: best, rendered };
}

/** Keep OSMD's SVG out of the accessibility tree and following the CSS colour. */
function decorateSvg(container: HTMLElement): void {
  const svg = container.querySelector('svg');
  if (svg === null) return;
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.setProperty('color', 'currentColor');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------


export function ScoreView({ musicXml, showFingerings, label }: ScoreViewProps): JSX.Element {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  /** Bumped by every render attempt; stale continuations compare unequal and bail. */
  const generationRef = useRef(0);
  const loadedRef = useRef<LoadedSignature | null>(null);
  const lastBoxRef = useRef<{ width: number; height: number } | null>(null);
  /**
   * The last zoom that was measured to fit. Used only when the panel has no
   * height yet and there is nothing to fit to — the search itself always starts
   * from life size, because a remembered zoom is not a cheaper starting point:
   * the first measurement has to happen at a known scale to mean anything.
   */
  const lastGoodZoomRef = useRef(1);

  const [status, setStatus] = useState<Status>('loading');
  /** Incremented to request a re-layout that is not caused by a prop change. */
  const [resizeNonce, setResizeNonce] = useState(0);


  const requestRelayout = useCallback(() => {
    setResizeNonce((n) => n + 1);
  }, []);

  // -- Draw ----------------------------------------------------------------
  useEffect(() => {
    const container = canvasRef.current;
    if (container === null) return;

    const generation = ++generationRef.current;
    const isCurrent = (): boolean => generationRef.current === generation;

    // Only blank the score out when there is nothing on screen yet. A resize or
    // an options tweak should not flash a loading message over a drawn score.
    if (osmdRef.current === null) setStatus('loading');

    void (async () => {
      try {
        const osmdModule = await import('opensheetmusicdisplay');
        if (!isCurrent()) return;

        const colour = readColour(container);
        const signature: LoadedSignature = { musicXml, showFingerings, colour };
        const previous = loadedRef.current;
        const needsLoad =
          osmdRef.current === null ||
          previous === null ||
          previous.musicXml !== signature.musicXml ||
          previous.showFingerings !== signature.showFingerings ||
          previous.colour !== signature.colour;

        if (osmdRef.current === null) {
          osmdRef.current = new osmdModule.OpenSheetMusicDisplay(
            container,
            buildOptions(showFingerings, colour),
          );
        } else if (needsLoad) {
          osmdRef.current.setOptions(buildOptions(showFingerings, colour));
        }

        const osmd = osmdRef.current;

        if (needsLoad) {
          // `drawFingerings: true` is a no-op in OSMD 1.9 — the option can only
          // turn fingerings off — so the rule has to be set directly for the
          // flag to be able to turn them back on.
          osmd.EngravingRules.RenderFingerings = showFingerings;
          // There is no `fingeringPositionFromXML` option in 1.9; it lives on
          // EngravingRules. Note that OSMD 1.9 parses the `placement` attribute
          // we write but does not act on it for fingerings — it engraves them
          // above the staff either way, so the left hand's numbers sit above
          // the bass staff rather than below it. The attribute stays in the
          // MusicXML because it is correct and other renderers honour it; this
          // flag stays on so the app picks the behaviour up if OSMD gains it.
          osmd.EngravingRules.FingeringPositionFromXML = true;

          await osmd.load(musicXml);
          if (!isCurrent()) return;
          loadedRef.current = signature;
        }

        const renderAt = (value: number): void => {
          osmd.Zoom = value;
          osmd.render();
        };

        const fitted = searchZoom({ container, renderAt, isCurrent });
        if (!isCurrent()) return;

        if (fitted === null) {
          // The panel has no height yet, so there is nothing to fit to. Draw it
          // at the last size that worked and wait for the observer to run again
          // with a real box.
          renderAt(lastGoodZoomRef.current);
          if (!isCurrent()) return;
        } else {
          // Finish on the winning size, so what is left on screen is always one
          // that was measured to fit — but only redraw when the search did not
          // already end there, since every render is a full engraving.
          if (Math.abs(fitted.zoom - fitted.rendered) > ZOOM_EPSILON) {
            renderAt(fitted.zoom);
            if (!isCurrent()) return;
          }
          lastGoodZoomRef.current = fitted.zoom;
        }

        lastBoxRef.current = { width: container.clientWidth, height: container.clientHeight };
        decorateSvg(container);
        setStatus('ready');
      } catch {
        if (!isCurrent()) return;
        // A malformed score or an OSMD internal failure must not escape: show
        // the fallback and let the rest of the app carry on. The instance is
        // thrown away rather than reused, since it may be half-built.
        const broken = osmdRef.current;
        osmdRef.current = null;
        loadedRef.current = null;
        teardown(broken, container);
        setStatus('error');
      }
    })();

    return () => {
      // Invalidate anything still in flight for this effect run.
      generationRef.current++;
    };
  }, [musicXml, showFingerings, resizeNonce]);

  // -- Resize --------------------------------------------------------------
  useEffect(() => {
    const container = canvasRef.current;
    if (container === null || typeof ResizeObserver !== 'function') return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const observer = new ResizeObserver(() => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const width = container.clientWidth;
        const height = container.clientHeight;
        const last = lastBoxRef.current;
        // Sub-pixel jitter and scrollbar-induced wobble are not worth a relayout.
        // Height matters as much as width now that the score is fitted to the
        // box rather than just to the line.
        if (
          last !== null &&
          Math.abs(width - last.width) <= BOX_EPSILON_PX &&
          Math.abs(height - last.height) <= BOX_EPSILON_PX
        ) {
          return;
        }
        lastBoxRef.current = { width, height };
        requestRelayout();
      }, RESIZE_DEBOUNCE_MS);
    });

    observer.observe(container);

    return () => {
      if (timer !== null) clearTimeout(timer);
      observer.disconnect();
    };
  }, [requestRelayout]);

  // -- Teardown ------------------------------------------------------------
  useEffect(() => {
    // Captured now: on unmount React may have already detached the ref.
    const container = canvasRef.current;
    return () => {
      generationRef.current++;
      const osmd = osmdRef.current;
      osmdRef.current = null;
      loadedRef.current = null;
      teardown(osmd, container);
    };
  }, []);

  return (
    <div
      className="score"
      role="img"
      aria-label={label}
      data-state={status}
    >
      <div className="score__canvas" ref={canvasRef} aria-hidden="true" />
      {status === 'loading' && (
        <p className="score__status" role="status">
          Loading notation…
        </p>
      )}
      {status === 'error' && <p className="score__status">Notation unavailable.</p>}
    </div>
  );
}
