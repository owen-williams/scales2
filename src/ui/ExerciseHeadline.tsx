import { Fragment } from 'react';

export interface ExerciseHeadlineProps {
  /** e.g. "E♭ Harmonic Minor" or "C Minor — Rule of the Octave". */
  title: string;
  /** e.g. ["Both Hands", "Similar Motion", "2 Octaves", "Ascending & Descending"]. */
  descriptors: readonly string[];
}

/**
 * Builds the sentence a screen reader hears: one clean utterance rather than
 * the fragments the eye reads.
 *
 * "E♭ Harmonic Minor. Both hands, similar motion, 2 octaves, ascending and descending."
 */
export function announcementFor(title: string, descriptors: readonly string[]): string {
  const detail = descriptors.join(', ').toLowerCase().replace(/ & /g, ' and ');
  if (detail === '') return `${title}.`;
  return `${title}. ${detail.charAt(0).toUpperCase()}${detail.slice(1)}.`;
}

/**
 * The largest thing on the screen, by a wide margin — readable from a metre
 * away, at the piano, in bad light.
 *
 * The whole block is a polite live region so that pressing Next announces the
 * new exercise. The visible pieces are `aria-hidden` and a visually-hidden
 * heading carries the full sentence, so it is spoken once and cleanly instead
 * of as "E flat Harmonic Minor" … "Both Hands · Similar Motion · 2 Octaves · …".
 */
export function ExerciseHeadline({ title, descriptors }: ExerciseHeadlineProps) {
  return (
    <div className="headline" role="status" aria-live="polite" aria-atomic="true">
      <h1 className="visually-hidden">{announcementFor(title, descriptors)}</h1>
      <p className="headline__name" aria-hidden="true">
        {title}
      </p>
      <p className="headline__meta" aria-hidden="true">
        {/* Each descriptor is kept whole so a narrow screen never splits
            "2 Octaves" across two lines; the separators carry the breaks. */}
        {descriptors.map((descriptor, index) => (
          <Fragment key={descriptor}>
            {index > 0 ? ' · ' : null}
            <span className="headline__metaItem">{descriptor}</span>
          </Fragment>
        ))}
      </p>
    </div>
  );
}
