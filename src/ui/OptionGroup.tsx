import { useId } from 'react';
import type { ReactNode } from 'react';

export interface OptionGroupProps {
  legend: string;
  /** Buttons shown on the legend row, e.g. "Select all" / "Clear all". */
  actions?: ReactNode;
  /** A short clarification shown under the legend. */
  note?: string;
  children: ReactNode;
}

/**
 * A labelled set of related controls.
 *
 * A real `<fieldset>`/`<legend>`: it is the one construct screen readers
 * announce as the group name when focus lands on a control inside it. The
 * legend's contents sit in a nested flex row rather than styling the `<legend>`
 * box itself, which browsers lay out inconsistently.
 *
 * `aria-labelledby` points at the title alone. A fieldset is otherwise named by
 * the entire text content of its legend, and the legend has to stay the first
 * child to name the group at all — so with "Select all" and "Clear all" sharing
 * that row, all twelve key chips were announced as being inside a group called
 * "Keys Select all Clear all". Naming the group explicitly keeps the layout and
 * fixes the announcement.
 */
export function OptionGroup({ legend, actions, note, children }: OptionGroupProps) {
  const titleId = useId();

  return (
    <fieldset className="group" aria-labelledby={titleId}>
      <legend className="group__legend">
        <span className="group__legendRow">
          <span className="group__title" id={titleId}>
            {legend}
          </span>
          {actions ? <span className="group__actions">{actions}</span> : null}
        </span>
      </legend>
      {note ? <p className="group__note">{note}</p> : null}
      <div className="group__options">{children}</div>
    </fieldset>
  );
}
