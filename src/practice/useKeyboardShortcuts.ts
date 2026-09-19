import { useEffect, useRef } from 'react';

/**
 * Single-key shortcuts for someone with one hand on the keyboard and the other
 * on the piano.
 *
 *   Space / Enter — next exercise
 *   n             — toggle notation
 *   f             — toggle fingering
 *   s             — open settings
 */
export interface KeyboardShortcuts {
  /** False while the settings dialog is open, so its own keys are never stolen. */
  readonly enabled: boolean;
  readonly onNext: () => void;
  readonly onToggleNotation: () => void;
  readonly onToggleFingering: () => void;
  readonly onOpenSettings: () => void;
}

const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Elements the browser already activates with Space or Enter. */
const ACTIVATABLE_TAGS = new Set(['BUTTON', 'A', 'SUMMARY', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL']);
const ACTIVATABLE_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'tab',
  'menuitem',
  'option',
]);

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return TEXT_ENTRY_TAGS.has(target.tagName) || target.isContentEditable;
}

function activatesItself(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (ACTIVATABLE_TAGS.has(target.tagName)) return true;
  const role = target.getAttribute('role');
  return role !== null && ACTIVATABLE_ROLES.has(role);
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts): void {
  // The listener is bound once; the ref keeps it looking at fresh handlers so a
  // re-render never detaches and re-attaches it mid-keystroke.
  const latest = useRef(shortcuts);
  latest.current = shortcuts;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const handlers = latest.current;
      if (!handlers.enabled) return;
      if (event.defaultPrevented) return;
      // Auto-repeat would fly through a dozen exercises from one held key.
      if (event.repeat) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isTextEntry(event.target)) return;

      if (event.key === ' ' || event.key === 'Enter') {
        // A focused button already gets a click from the browser for these keys.
        // Bailing here is what stops Next firing twice.
        if (activatesItself(event.target)) return;
        if (event.key === ' ') event.preventDefault();
        handlers.onNext();
        return;
      }

      switch (event.key) {
        case 'n':
        case 'N':
          event.preventDefault();
          handlers.onToggleNotation();
          break;
        case 'f':
        case 'F':
          event.preventDefault();
          handlers.onToggleFingering();
          break;
        case 's':
        case 'S':
          event.preventDefault();
          handlers.onOpenSettings();
          break;
        default:
          break;
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
