# Scales

A random piano scale practice app.

Rather than working through scales one at a time in a fixed order, this app throws a genuinely random
exercise at you, you play it, you press Next, and it throws another one. The aim is not to memorise scales
individually but to become comfortable reading and playing *any* scale on sight.

Every exercise is played hands together. What varies is the key, the scale type, the motion (similar or
contrary), the number of octaves and the direction.

There is a second kind of exercise, the Rule of the Octave, which ships switched off. See below.

There is deliberately no mastery tracking, no spaced repetition, no adaptive ordering and no streaks. The
same scale twice in a row is not a bug.

---

## Running it

```sh
npm install
npm run dev        # development server
npm test           # unit tests
npm run typecheck  # strict TypeScript check
npm run build      # production bundle in dist/
```

Everything runs in the browser. There is no backend, no API and no database; preferences live in
`localStorage`.

---

## Deploying to Coolify

The repository ships a `Dockerfile` that builds the SPA and serves it from nginx.

1. In Coolify, create a new **Application** and point it at this repository.
2. Set the build pack to **Dockerfile**.
3. Set the exposed port to **80**.
4. Deploy.

No environment variables and no runtime configuration are required. `nginx.conf` handles SPA routing
(unknown paths fall back to `index.html`), caches the content-hashed assets immutably and keeps
`index.html` uncached so a deploy takes effect immediately.

To serve the build from anywhere else instead, `npm run build` produces a fully static `dist/` directory
that any static host will serve as-is, provided it rewrites unknown paths to `index.html`.

---

## Architecture

The musical catalogue is the point of this app, so the domain model leads and the UI follows.

```
src/
  domain/
    types.ts          shared vocabulary — pitches, scale types, exercises
    pitch.ts          spelled-pitch arithmetic (letter + alteration, never bare semitones)
    scaleTypes.ts     the catalogue: interval formulae and metadata, as data
    scale.ts          tonic spelling, key signatures, note generation
    fingering/        curated fingering data, one module per set
    ruleOfOctave/     curated thoroughbass harmonisations, one module per version
    exercise.ts       eligibility rules, pool enumeration, random draw
    realise.ts        Exercise -> actual spelled notes and fingerings
  notation/
    musicxml.ts       MusicXML generated programmatically from a realised exercise
    ScoreView.tsx     OpenSheetMusicDisplay wrapper
  settings/           preferences, validation and localStorage persistence
  practice/           the practice session hook and keyboard shortcuts
  ui/                 presentational components
```

Four decisions carry most of the weight:

**Pitches are spelled, not numbered.** A pitch is a letter plus an alteration plus an octave, so
E♭ and D♯ are different values. Correct enharmonic spelling is a property of the representation rather than
something patched on during rendering. G♯ harmonic minor really does contain an F double sharp, and it
comes out that way without a special case.

**Scales are data.** A scale type is a record of interval formulae plus metadata. Generating one is a
single algorithm: scale degree *n* takes the letter *n* steps above the tonic, and the alteration is
whatever lands on the required semitone. Adding a scale system means adding an entry, not editing the
engine.

**The tonic's spelling is mostly derived rather than tabulated.** For each pitch class the candidate
spellings are scored by the total accidentals in the scale's underlying diatonic collection, and the
cheapest wins — which is what makes the app choose G♯ minor (5 sharps) over A♭ minor (7 flats), the
conventional answer from a rule rather than a lookup table. Twelve pairs tie on that score, though, E♭
against D♯ minor among them, and those are settled by the order of a curated candidate list. The rule does
most of the work; the ordering does the rest, and both are tested.

**Fingerings are curated, never computed.** They live in `src/domain/fingering/` as explicit data with the
thumb positions documented in comments, and the tests assert the invariants that make them trustworthy —
fingers 1–5 only, no repeated finger on adjacent notes, and the thumb never on a black key in the natural,
harmonic or descending-melodic forms. Two keys put a right-hand thumb on a black note in melodic minor
*ascending* only, where the raised sixth moves under it; those are the traditional published fingerings,
are documented at the entry, and are pinned by a test so the exception set cannot grow quietly. Where no
curated fingering exists (the five modes other than Ionian and Aeolian), the app says so rather than
inventing one.

Notation is generated as MusicXML at runtime and rendered by OpenSheetMusicDisplay. There are no static
score files; accidentals, clefs, key signatures and fingerings are all derived from the realised exercise.

Fingerings are engraved onto the score itself rather than listed beside it, so there is one thing to read
rather than two saying the same thing. The Fingering preference controls whether those numbers are drawn.

**The practice screen is one page.** It is meant to be read from a piano stool, so the shell is exactly the
height of the viewport, the headline and the Next button take the height they need, and the notation
absorbs whatever is left. The one exception is a viewport too short to hold even the compressed column — a
small phone in landscape, or a large browser text size — where the page scrolls rather than clipping the
Next button out of reach. `ScoreView` fits the score to the box it has been given,
growing a one-octave scale to fill a laptop and shrinking four octaves onto a phone.

It finds the size by **searching rather than calculating**, which is worth explaining because the obvious
calculations all fail. Height is not proportional to zoom: growing the score rewraps the music onto a
different number of systems and the height jumps when it does, so a proportional guess overshoots and the
correction undershoots, and the fit oscillates. Width is no help either — OSMD lays a score out to the
container and leaves a right margin on a partial system, so the engraved width barely responds to zoom and
a ratio built on it never converges at all. Instead the component probes a few sizes, keeps the largest one
it *measured* to fit, and renders at that last. What is on screen has therefore always been measured, which
is what makes "it never overflows" true rather than usually true.

Music wraps in whole systems, so the score cannot always fill the panel exactly; where it cannot, the spare
height is left as margin rather than spent on an overflowing score.

---

## The Rule of the Octave

The Rule of the Octave is the thoroughbass convention that assigns a chord to every degree of the scale,
ascending and back down: play the scale in the left hand and the rule tells you what the right hand does
over each note. It was how an eighteenth-century keyboard player learned to harmonise, and it is one octave
up and down — fifteen chords — every time, so motion, octaves and direction do not apply to it. It is
engraved a chord to the bar, in semibreves, because it is read and voiced rather than played in time,
with the ascending and descending halves on separate lines. The arrival on the octave is written twice,
closing one line and opening the next, so each line is a complete run of eight bars — without that the
two halves are eight bars against seven and cannot be spaced alike, since every system but the last is
justified to the full width.

Two historical versions ship, and the user picks which are in the pool the way scale families are picked:

- **Fenaroli**, *Regole musicali per i principianti di cembalo* (Naples, 1775) — the Neapolitan partimento
  rule, and the version most modern presentations descend from.
- **Campion**, *Traité d'accompagnement et de composition, selon la règle des octaves de musique*
  (Paris, 1716) — the first printed rule of the octave, and the one that gave it its name.

**In major the two are the same harmonisation, figure for figure.** That is not a gap in the curation but
the historically interesting fact: Heinichen, comparing his version with Campion's and Gasparini's in 1728,
asked how "three subjects of different nations could fall on the same principle" and answered that the
thing is simply too well-founded to admit another. **In minor they differ at exactly one chord** — the
descending sixth degree, where Fenaroli reads an augmented sixth (A♭ against F♯ in C minor) and Campion's
plate has a plain four-three with no sharp anywhere. Both tables are reproduced in full from their own
sources rather than one aliasing the other, and the generator compares them structurally: where two
versions produce the same music, the pool holds that exercise once, and the descriptor line does not print
a version name that makes no difference to the notes.

The **three positions** are the three standard dispositions of the upper parts — octave, third or fifth of
the opening chord on top. They are not three tables but rotations of one voicing, generated by moving the
lowest of the three upper voices above the highest, which is what makes them the same rule entered at
different points. Fenaroli prints all three and they are exact rotations of one another.

There is no fingering. Fingerings for chords are not standard curated data, so none are invented and none
are shown, and the exercise is read at a quarter note to the chord rather than a scale's eighths.

---

## Extending the catalogue

The structure anticipates growth. Adding **arpeggios, dominant sevenths, diminished sevenths, scales in
thirds or sixths, another scale system or an exam syllabus** should mean:

1. Add the interval formulae to `src/domain/scaleTypes.ts` (or a sibling catalogue module).
2. Add the curated fingerings to a new module under `src/domain/fingering/`.
3. Add the new ids to the relevant list in `src/settings/types.ts` so they become selectable.

Nothing in the generator, the MusicXML writer or the UI needs to change. Patterns that are not one note per
scale degree (thirds, sixths, broken chords) will need their own note-sequence builder alongside
`buildRun`, but they slot into the same `RealisedExercise` shape that everything downstream consumes.

The fingering lookup is keyed so that alternative fingerings for the same scale can be added later without
disturbing the default.

A third version of the Rule of the Octave — Heinichen's *Schemata Modorum* (1728), say, or Gasparini
(1708) — is a new file under `src/domain/ruleOfOctave/` exporting a table for each mode, plus one line in
that directory's registry and one id in `ROO_VERSION_IDS`. Nothing else changes: the settings chip, the
pool and the descriptor line are all generated from the registry, and because equal versions are collapsed
by comparing tables rather than by a rule about major, a version that genuinely differs in major simply
starts appearing there.

---

## Testing

```sh
npm test
```

Around 1,400 tests covering scale generation and note spelling across every scale type in all twelve keys,
enharmonic correctness for the awkward cases, fingering validity as structural invariants rather than
golden strings, the Rule of the Octave pinned note for note against its sources in C major and C minor and
spelled correctly in all 24 keys, exercise eligibility and uniform random selection, MusicXML output
including accidental placement and chords, localStorage persistence against corrupt and hostile payloads,
and the UI's reveal logic and keyboard shortcuts.

`src/notation/rendering.test.ts` goes a step further and puts the awkward scales — E♭ harmonic minor,
G♯ harmonic minor with its double sharp, C♯ melodic minor, four octaves of chromatic, contrary motion, and
a mode with no curated fingering — all the way through OpenSheetMusicDisplay, then asserts on what was
actually engraved. That is how the catalogue is checked end to end: the fingerings printed above the stave
are compared, note for note, with the curated data. jsdom has no layout engine, so `vitest.setup.ts` shims
canvas text metrics and element geometry; glyph positions are therefore meaningless in tests and nothing
asserts on them.

### Known limitation

OpenSheetMusicDisplay 1.9 parses the `placement` attribute on `<fingering>` but does not act on it, so
left-hand fingerings are engraved above the bass staff rather than below it. The generated MusicXML marks
them correctly and the app opts into the behaviour, so this resolves itself if OSMD gains support.
