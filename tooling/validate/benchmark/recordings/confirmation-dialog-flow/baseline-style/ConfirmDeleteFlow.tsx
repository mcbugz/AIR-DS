import { useState } from 'react';
import styles from './ConfirmDeleteFlow.module.css';

/**
 * RECORDED generation (fixture-replay benchmark, variant: baseline-style).
 * Plausible no-design-system output: a hand-rolled fixed-overlay "modal" with
 * no focus trap or Escape handling, Tailwind utility classes, guessed token
 * names, and a nameless icon close button (an axe 'button-name' violation).
 */
export function ConfirmDeleteFlow() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className={styles.danger} onClick={() => setOpen(true)}>
        Delete project
      </button>
      {open && (
        <div className={styles.overlay}>
          <div role="dialog" className={styles.modal}>
            <button type="button" className={styles.close} onClick={() => setOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold">Delete this project?</h2>
            <p className="text-sm text-gray-600">
              Deleting a project is permanent and cannot be undone.
            </p>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.danger} onClick={() => setOpen(false)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
