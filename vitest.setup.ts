import '@testing-library/jest-dom/vitest';

// jsdom has no layout engine. The shims below give OpenSheetMusicDisplay just
// enough of one to engrave a real score into the SVG backend, so the notation
// tests can assert on actual output rather than on an error state. Glyph
// metrics are approximations — the tests check that the right symbols were
// drawn, never where they landed.

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/**
 * `localStorage`, when the environment forgets to provide one.
 *
 * jsdom implements it, but whether it survives into the test global depends on
 * the Node version underneath vitest — Node 26 has its own opinion about the
 * name and the jsdom one stops coming through, which silently breaks every test
 * that touches preferences. The app's own storage layer is written to cope with
 * a missing or hostile `localStorage`, so the failure looked like a product bug
 * rather than an environment one.
 *
 * This is a fallback and nothing more: where the environment supplies a real
 * implementation, that is what the tests use.
 */
if (typeof globalThis.localStorage === 'undefined') {
  const entries = new Map<string, string>();

  const memoryStorage: Storage = {
    get length() {
      return entries.size;
    },
    key(index) {
      return [...entries.keys()][index] ?? null;
    },
    getItem(key) {
      return entries.get(String(key)) ?? null;
    },
    setItem(key, value) {
      entries.set(String(key), String(value));
    },
    removeItem(key) {
      entries.delete(String(key));
    },
    clear() {
      entries.clear();
    },
  };

  // Configurable, because one of the storage tests replaces this very property
  // with a throwing accessor and puts it back afterwards.
  for (const target of [globalThis, window]) {
    Object.defineProperty(target, 'localStorage', {
      value: memoryStorage,
      configurable: true,
      writable: true,
    });
  }
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Every element in jsdom reports a zero-sized box. OSMD refuses to engrave into
// zero width, so give elements a plausible viewport-sized default; individual
// tests can still override it per element.
for (const [property, value] of [
  ['offsetWidth', 900],
  ['offsetHeight', 600],
  ['clientWidth', 900],
  ['clientHeight', 600],
] as const) {
  Object.defineProperty(HTMLElement.prototype, property, {
    configurable: true,
    get() {
      return value;
    },
  });
}

// VexFlow measures text through a 2D context even when rendering to SVG, and
// OSMD's sky/bottom-line calculator reads back pixel data. One context per
// canvas, so `context.canvas` resolves the way callers expect.
const CHAR_WIDTH = 6;
const contexts = new WeakMap<HTMLCanvasElement, object>();

function createContext(canvas: HTMLCanvasElement) {
  return {
    canvas,
    measureText: (text: string) => ({
      width: String(text).length * CHAR_WIDTH,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    }),
    // A transparent readback yields a flat skyline, which is all the tests need.
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(Math.max(0, width * height * 4)),
    }),
    arc: () => {},
    beginPath: () => {},
    bezierCurveTo: () => {},
    clearRect: () => {},
    closePath: () => {},
    fill: () => {},
    fillRect: () => {},
    fillText: () => {},
    lineTo: () => {},
    moveTo: () => {},
    quadraticCurveTo: () => {},
    rect: () => {},
    restore: () => {},
    rotate: () => {},
    save: () => {},
    scale: () => {},
    setLineDash: () => {},
    setTransform: () => {},
    stroke: () => {},
    strokeText: () => {},
    translate: () => {},
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
  };
}

HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement) {
  let context = contexts.get(this);
  if (context === undefined) {
    context = createContext(this);
    contexts.set(this, context);
  }
  return context;
} as unknown as HTMLCanvasElement['getContext'];

// jsdom implements the SVG DOM but none of its geometry interfaces.
const svgPrototype = SVGElement.prototype as unknown as Record<string, unknown>;

svgPrototype.getBBox = function getBBox(this: Element) {
  const text = this.textContent ?? '';
  return { x: 0, y: 0, width: text.length * CHAR_WIDTH, height: 12 };
};

const identityMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
svgPrototype.getScreenCTM = () => ({ ...identityMatrix, inverse: () => identityMatrix });
svgPrototype.createSVGMatrix = () => identityMatrix;
