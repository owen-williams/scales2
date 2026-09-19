export interface ToggleChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

/**
 * A single on/off choice.
 *
 * `aria-pressed` rather than a checkbox: these are filters applied immediately,
 * not form fields awaiting a submit, and a pressed button is what that means.
 */
export function ToggleChip({ label, selected, onToggle }: ToggleChipProps) {
  return (
    <button type="button" className="chip" aria-pressed={selected} onClick={onToggle}>
      {label}
    </button>
  );
}
