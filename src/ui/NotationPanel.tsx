import { useMemo } from 'react';
import type { RealisedExercise } from '../domain/types';
import { toMusicXml } from '../notation/musicxml';
import { ScoreView } from '../notation/ScoreView';

export interface NotationPanelProps {
  realised: RealisedExercise;
  /** e.g. ["Both Hands", "Similar Motion", "2 Octaves", "Ascending & Descending"]. */
  descriptors: readonly string[];
  showFingerings: boolean;
}

/**
 * The engraved score.
 *
 * Mounted only while the panel is actually visible, so someone who practises
 * with notation hidden never pays for building MusicXML — and, because
 * `ScoreView` imports OpenSheetMusicDisplay lazily, never downloads it either.
 */
export function NotationPanel({ realised, descriptors, showFingerings }: NotationPanelProps) {
  const musicXml = useMemo(() => toMusicXml(realised), [realised]);
  const label = `Notation for ${realised.title}, ${descriptors.join(', ').toLowerCase()}`;

  return (
    <ScoreView
      musicXml={musicXml}
      showFingerings={showFingerings}
      evenMeasures={realised.evenMeasures ?? false}
      label={label}
    />
  );
}
