import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { ROO_VERSIONS } from '../domain/ruleOfOctave';
import { getScaleType } from '../domain/scaleTypes';
import {
  DIRECTION_OPTIONS,
  MODE_IDS,
  MOTION_OPTIONS,
  OCTAVE_OPTIONS,
  ROO_MODES,
  ROO_POSITIONS,
  SCALE_FAMILY_IDS,
} from '../domain/types';
import type { PitchClass } from '../domain/types';
import {
  DIRECTION_LABELS,
  KEY_LABELS,
  MOTION_LABELS,
  ROO_MODE_LABELS,
  ROO_POSITION_LABELS,
  VISIBILITY_LABELS,
} from '../settings/labels';
import { useSettings } from '../settings/SettingsProvider';
import { VISIBILITY_OPTIONS } from '../settings/types';
import type { Visibility } from '../settings/types';
import { describePoolConflicts } from './EmptyPool';
import { OptionGroup } from './OptionGroup';
import { ToggleChip } from './ToggleChip';

const PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Live count of eligible exercises, so choices show their effect immediately. */
  poolSize: number;
}

interface VisibilityControlProps {
  name: string;
  value: Visibility;
  onChange: (value: Visibility) => void;
}

/**
 * Always / Reveal / Hidden.
 *
 * Native radios inside the group's `<fieldset>` — which is already the radio
 * group, and already gives arrow-key navigation, roving focus and the right
 * announcements. Only their appearance is replaced; no ARIA is re-implemented.
 */
function VisibilityControl({ name, value, onChange }: VisibilityControlProps) {
  return (
    <div className="segmented">
      {VISIBILITY_OPTIONS.map((option) => (
        <label className="segmented__option" key={option}>
          <input
            type="radio"
            className="visually-hidden"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
          />
          <span className="segmented__label">{VISIBILITY_LABELS[option]}</span>
        </label>
      ))}
    </div>
  );
}

export function SettingsDialog({ open, onClose, poolSize }: SettingsDialogProps) {
  const { settings, toggle, setList, setVisibility, reset } = useSettings();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const titleId = `${id}-title`;

  // The native dialog is the source of truth for modality; React drives it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const openRef = useRef(open);
  openRef.current = open;

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>): void {
    if (event.key !== 'Escape') return;
    // Close it ourselves rather than letting the browser dismiss the element
    // out from under React, which would leave `open` stuck true.
    event.preventDefault();
    onClose();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>): void {
    if (event.target === event.currentTarget) onClose();
  }

  // Only asked when there is something to explain: the answer is derived from
  // the pool enumeration, and an empty pool is the only time it says anything.
  const conflicts = poolSize === 0 ? describePoolConflicts(settings) : [];

  return (
    <dialog
      className="dialog"
      ref={dialogRef}
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (openRef.current) onClose();
      }}
    >
      {open ? (
        <div className="dialog__frame">
          <header className="dialog__head">
            <h2 className="dialog__title" id={titleId}>
              Settings
            </h2>
            <button type="button" className="button" onClick={onClose} autoFocus>
              Done
            </button>
          </header>

          <div className="dialog__body">
            <OptionGroup
              legend="Keys"
              actions={
                <>
                  <button
                    type="button"
                    className="linkButton"
                    onClick={() => setList('keys', PITCH_CLASSES)}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="linkButton"
                    onClick={() => setList('keys', [])}
                  >
                    Clear all
                  </button>
                </>
              }
            >
              {PITCH_CLASSES.map((pitchClass) => (
                <ToggleChip
                  key={pitchClass}
                  label={KEY_LABELS[pitchClass]}
                  selected={settings.keys.includes(pitchClass)}
                  onToggle={() => toggle('keys', pitchClass)}
                />
              ))}
            </OptionGroup>

            <OptionGroup legend="Scale families">
              {SCALE_FAMILY_IDS.map((familyId) => (
                <ToggleChip
                  key={familyId}
                  label={getScaleType(familyId).name}
                  selected={settings.families.includes(familyId)}
                  onToggle={() => toggle('families', familyId)}
                />
              ))}
            </OptionGroup>

            <OptionGroup
              legend="Modes"
              note="Modes are generated from the same interval formulae. Curated fingerings exist only for Ionian and Aeolian."
            >
              {MODE_IDS.map((modeId) => (
                <ToggleChip
                  key={modeId}
                  label={getScaleType(modeId).name}
                  selected={settings.modes.includes(modeId)}
                  onToggle={() => toggle('modes', modeId)}
                />
              ))}
            </OptionGroup>

            <OptionGroup
              legend="Motion"
              note="Every exercise is played hands together. Contrary motion is only generated up to 2 octaves."
            >
              {MOTION_OPTIONS.map((motion) => (
                <ToggleChip
                  key={motion}
                  label={MOTION_LABELS[motion]}
                  selected={settings.motions.includes(motion)}
                  onToggle={() => toggle('motions', motion)}
                />
              ))}
            </OptionGroup>

            <OptionGroup legend="Octaves">
              {OCTAVE_OPTIONS.map((octaves) => (
                <ToggleChip
                  key={octaves}
                  label={`${octaves} ${octaves === 1 ? 'Octave' : 'Octaves'}`}
                  selected={settings.octaves.includes(octaves)}
                  onToggle={() => toggle('octaves', octaves)}
                />
              ))}
            </OptionGroup>

            <OptionGroup legend="Direction">
              {DIRECTION_OPTIONS.map((direction) => (
                <ToggleChip
                  key={direction}
                  label={DIRECTION_LABELS[direction]}
                  selected={settings.directions.includes(direction)}
                  onToggle={() => toggle('directions', direction)}
                />
              ))}
            </OptionGroup>

            {/* The rule shares the Keys list above: a key is a key, and a second
                twelve chips saying the same thing would only drift from it. */}
            <OptionGroup
              legend="Rule of the Octave — Version"
              note="The Rule of the Octave sets a chord over every degree of the scale, ascending and back down — the thoroughbass convention behind most eighteenth-century keyboard accompaniment. Campion and Fenaroli are identical in major and differ at one chord in minor, the descending sixth degree, so a major key is drawn once however many versions are selected."
            >
              {ROO_VERSIONS.map((version) => (
                <ToggleChip
                  key={version.id}
                  label={version.label}
                  selected={settings.rooVersions.includes(version.id)}
                  onToggle={() => toggle('rooVersions', version.id)}
                />
              ))}
            </OptionGroup>

            <OptionGroup legend="Rule of the Octave — Mode">
              {ROO_MODES.map((mode) => (
                <ToggleChip
                  key={mode}
                  label={ROO_MODE_LABELS[mode]}
                  selected={settings.rooModes.includes(mode)}
                  onToggle={() => toggle('rooModes', mode)}
                />
              ))}
            </OptionGroup>

            <OptionGroup legend="Rule of the Octave — Position">
              {ROO_POSITIONS.map((position) => (
                <ToggleChip
                  key={position}
                  label={ROO_POSITION_LABELS[position]}
                  selected={settings.rooPositions.includes(position)}
                  onToggle={() => toggle('rooPositions', position)}
                />
              ))}
            </OptionGroup>

            <OptionGroup legend="Notation">
              <VisibilityControl
                name={`${id}-notation`}
                value={settings.notation}
                onChange={(value) => setVisibility('notation', value)}
              />
            </OptionGroup>

            <OptionGroup legend="Fingering">
              <VisibilityControl
                name={`${id}-fingering`}
                value={settings.fingering}
                onChange={(value) => setVisibility('fingering', value)}
              />
            </OptionGroup>
          </div>

          <footer className="dialog__foot">
            {poolSize === 0 ? (
              <div className="warning" role="alert">
                <p className="warning__title">No exercises match these settings.</p>
                {conflicts.length > 0 ? (
                  <ul className="warning__list">
                    {conflicts.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="dialog__count" aria-live="polite">
                {poolSize.toLocaleString()} {poolSize === 1 ? 'exercise' : 'exercises'} in the pool
              </p>
            )}
            <button type="button" className="button" onClick={reset}>
              Reset to defaults
            </button>
          </footer>
        </div>
      ) : null}
    </dialog>
  );
}
