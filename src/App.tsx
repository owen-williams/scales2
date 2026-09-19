import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useKeyboardShortcuts } from './practice/useKeyboardShortcuts';
import { usePractice } from './practice/usePractice';
import { useSettings } from './settings/SettingsProvider';
import { describePoolConflicts } from './ui/EmptyPool';
import { PracticeScreen } from './ui/PracticeScreen';
import { SettingsDialog } from './ui/SettingsDialog';

export function App() {
  const { settings } = useSettings();
  const practice = usePractice();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  /**
   * Put focus back on the Settings button once the dialog has actually gone.
   *
   * It has to be an effect rather than part of `closeSettings`. React flushes
   * the state update after the handler returns, so focusing there ran while the
   * dialog was still open — and everything outside an open modal dialog is
   * inert, so the call did nothing at all. The browser's own restoration covers
   * the case where the dialog was opened by clicking that button; this covers
   * the `s` shortcut, where focus was on the body and there is nothing sensible
   * for the browser to restore to.
   */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !settingsOpen) settingsButtonRef.current?.focus();
    wasOpen.current = settingsOpen;
  }, [settingsOpen]);

  useKeyboardShortcuts({
    enabled: !settingsOpen,
    onNext: practice.next,
    onToggleNotation: practice.toggleNotation,
    onToggleFingering: practice.toggleFingering,
    onOpenSettings: openSettings,
  });

  const poolConflicts = useMemo(() => describePoolConflicts(settings), [settings]);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__inner app__headerInner">
          <span className="wordmark">Scales</span>
          <button
            type="button"
            className="button"
            ref={settingsButtonRef}
            onClick={openSettings}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
          >
            Settings
          </button>
        </div>
      </header>

      <main className="app__main app__inner">
        <PracticeScreen
          realised={practice.realised}
          poolSize={practice.poolSize}
          notationVisible={practice.notationVisible}
          fingeringVisible={practice.fingeringVisible}
          notationPreference={settings.notation}
          fingeringPreference={settings.fingering}
          poolConflicts={poolConflicts}
          onNext={practice.next}
          onToggleNotation={practice.toggleNotation}
          onToggleFingering={practice.toggleFingering}
          onOpenSettings={openSettings}
        />
      </main>

      <SettingsDialog open={settingsOpen} onClose={closeSettings} poolSize={practice.poolSize} />
    </div>
  );
}
