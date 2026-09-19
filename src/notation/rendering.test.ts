/**
 * End-to-end engraving tests for the scales that are most likely to break.
 *
 * `musicxml.test.ts` checks that the right MusicXML is produced. These tests go
 * one step further and put that MusicXML through OpenSheetMusicDisplay, so a
 * score that is correct on paper but that OSMD cannot lay out still fails.
 *
 * jsdom has no layout engine; `vitest.setup.ts` shims just enough of one
 * (canvas text metrics, `getBBox`, element box sizes) for OSMD to engrave into
 * its SVG backend. Glyph *positions* are therefore meaningless here and nothing
 * below asserts on them — only on which symbols were drawn.
 */

import { describe, expect, it } from 'vitest';
import type { OpenSheetMusicDisplay as OSMD } from 'opensheetmusicdisplay';
import type { ScaleExercise } from '../domain/types';
import { realiseExercise } from '../domain/realise';
import { toMusicXml } from './musicxml';

/** Eighth notes to the 4/4 bar, matching `toMusicXml`. */
const NOTES_PER_BAR = 8;

async function engrave(exercise: ScaleExercise, options: { fingerings?: boolean } = {}) {
  const realised = realiseExercise(exercise);
  const container = document.createElement('div');
  document.body.appendChild(container);

  const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
  const osmd: OSMD = new OpenSheetMusicDisplay(container, {
    autoResize: false,
    backend: 'svg',
    drawTitle: false,
    drawPartNames: false,
  });
  osmd.EngravingRules.RenderFingerings = options.fingerings ?? true;

  await osmd.load(toMusicXml(realised));
  osmd.render();

  const svg = container.querySelector('svg');
  if (svg === null) throw new Error('OSMD produced no SVG');

  return {
    realised,
    svg,
    staves: svg.querySelectorAll('g.staffline').length,
    noteheads: svg.querySelectorAll('g.vf-notehead').length,
    /** Every rendered fingering number, in engraving order. */
    fingerings: [...svg.querySelectorAll('g.vf-text')]
      .map((node) => node.textContent?.trim() ?? '')
      .filter((text) => /^[1-5]$/.test(text)),
    cleanup: () => {
      osmd.clear();
      container.remove();
    },
  };
}

/** The scales a pianist would expect a notation engine to get wrong. */
const DIFFICULT: ReadonlyArray<{ name: string; exercise: ScaleExercise }> = [
  {
    // Six flats plus a natural on every raised seventh.
    name: 'E♭ harmonic minor, 2 octaves, up and down',
    exercise: {
      kind: 'scale',
      tonic: 3,
      scaleTypeId: 'harmonicMinor',
      motion: 'similar',
      octaves: 2,
      direction: 'both',
    },
  },
  {
    // Contains F double sharp — the classic double-accidental case.
    name: 'G♯ harmonic minor, 2 octaves',
    exercise: {
      kind: 'scale',
      tonic: 8,
      scaleTypeId: 'harmonicMinor',
      motion: 'similar',
      octaves: 2,
      direction: 'both',
    },
  },
  {
    // Different notes going up and coming down, and a B sharp at the top.
    name: 'C♯ melodic minor, 2 octaves, up and down',
    exercise: {
      kind: 'scale',
      tonic: 1,
      scaleTypeId: 'melodicMinor',
      motion: 'similar',
      octaves: 2,
      direction: 'both',
    },
  },
  {
    // Twelve notes an octave, an accidental almost everywhere, four octaves of it.
    name: 'D♭ chromatic, 4 octaves',
    exercise: {
      kind: 'scale',
      tonic: 1,
      scaleTypeId: 'chromatic',
      motion: 'similar',
      octaves: 4,
      direction: 'both',
    },
  },
  {
    // Hands moving in opposite directions across a four-octave span.
    name: 'B major contrary motion, 2 octaves',
    exercise: {
      kind: 'scale',
      tonic: 11,
      scaleTypeId: 'major',
      motion: 'contrary',
      octaves: 2,
      direction: 'both',
    },
  },
  {
    // A mode with no curated fingering: must engrave with no fingering marks.
    name: 'D♯ Locrian, 1 octave',
    exercise: {
      kind: 'scale',
      tonic: 3,
      scaleTypeId: 'locrian',
      motion: 'similar',
      octaves: 1,
      direction: 'ascending',
    },
  },
];

describe('engraving difficult scales', () => {
  for (const { name, exercise } of DIFFICULT) {
    it(`renders ${name}`, async () => {
      const result = await engrave(exercise);
      try {
        // VexFlow draws a notehead for rests too, so the expected count is the
        // number of notes rounded up to whole bars — which incidentally checks
        // that every measure was padded to its full length.
        const expectedHeads = result.realised.parts.reduce(
          (total, part) => total + Math.ceil(part.events.length / NOTES_PER_BAR) * NOTES_PER_BAR,
          0,
        );
        expect(result.noteheads).toBe(expectedHeads);
        expect(result.staves).toBeGreaterThan(0);
        // Staff lines, stems and note glyphs all draw as paths.
        expect(result.svg.querySelectorAll('path').length).toBeGreaterThan(20);
      } finally {
        result.cleanup();
      }
    }, 30_000);
  }
});

describe('engraved fingerings', () => {
  it('prints the curated fingering for every note of both hands', async () => {
    // E♭ minor is the awkward one: RH thumbs on F and C♭, LH on F and C♭ too,
    // and neither hand ever reaches the fifth finger.
    const result = await engrave({
      kind: 'scale',
      tonic: 3,
      scaleTypeId: 'harmonicMinor',
      motion: 'similar',
      octaves: 2,
      direction: 'ascending',
    });
    try {
      const expected = result.realised.parts.flatMap((part) =>
        // Every scale event is a single note carrying a single finger.
        part.events.flatMap((event) => event.fingers.map(String)),
      );
      expect(result.fingerings).toEqual(expected);
      // Pinned explicitly, so a regression in the catalogue is legible here.
      expect(result.fingerings.join(' ')).toBe(
        '3 1 2 3 4 1 2 3 1 2 3 4 1 2 3 ' + '2 1 4 3 2 1 3 2 1 4 3 2 1 3 2',
      );
    } finally {
      result.cleanup();
    }
  }, 30_000);

  it('prints no fingerings for a scale the catalogue does not cover', async () => {
    const result = await engrave({
      kind: 'scale',
      tonic: 3,
      scaleTypeId: 'locrian',
      motion: 'similar',
      octaves: 2,
      direction: 'ascending',
    });
    try {
      expect(result.realised.hasFingering).toBe(false);
      expect(result.fingerings).toEqual([]);
    } finally {
      result.cleanup();
    }
  }, 30_000);

  it('omits fingerings when the renderer is asked to hide them', async () => {
    const result = await engrave(
      {
        kind: 'scale',
        tonic: 0,
        scaleTypeId: 'major',
        motion: 'similar',
        octaves: 1,
        direction: 'ascending',
      },
      { fingerings: false },
    );
    try {
      expect(result.fingerings).toEqual([]);
      // One bar of eighths per hand, and both hands always play.
      expect(result.noteheads).toBe(NOTES_PER_BAR * 2);
    } finally {
      result.cleanup();
    }
  }, 30_000);
});

describe('staff layout', () => {
  it('engraves both hands, each with its own run of notes', async () => {
    const together = await engrave({
      kind: 'scale',
      tonic: 0,
      scaleTypeId: 'major',
      motion: 'similar',
      octaves: 1,
      direction: 'ascending',
    });
    try {
      expect(together.realised.parts.map((part) => part.hand)).toEqual(['right', 'left']);
      // Eight notes each, filling exactly one bar per hand.
      for (const part of together.realised.parts) {
        expect(part.events).toHaveLength(NOTES_PER_BAR);
      }
      expect(together.noteheads).toBe(NOTES_PER_BAR * 2);
      expect(together.staves).toBeGreaterThan(0);
    } finally {
      together.cleanup();
    }
  }, 30_000);
});
