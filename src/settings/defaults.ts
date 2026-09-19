import { OCTAVE_OPTIONS, ROO_POSITIONS } from '../domain/types';
import type { Settings } from './types';

/**
 * The settings a first-time user sees, and the fallback `parseSettings` uses
 * for anything it cannot salvage from storage.
 *
 * The Rule of the Octave ships switched off (`rooVersions: []`). This is a scale
 * practice app first, and the rule changes its character completely — chords to
 * read vertically instead of a line to run — so it is something the user opts
 * into. The other two lists are full, so turning a version on is the only step
 * needed to get the whole rule.
 */
export const DEFAULT_SETTINGS: Settings = {
  keys: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  families: ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor', 'chromatic'],
  modes: [],
  motions: ['similar'],
  octaves: [OCTAVE_OPTIONS[0], OCTAVE_OPTIONS[1]],
  directions: ['both'],
  rooVersions: [],
  rooModes: ['major', 'minor'],
  rooPositions: [ROO_POSITIONS[0], ROO_POSITIONS[1], ROO_POSITIONS[2]],
  notation: 'reveal',
  fingering: 'reveal',
};
