import { Button, Dialog } from '@ds/react';
import styles from './ConfirmDeleteFlow.module.css';

/**
 * RECORDED generation (fixture-replay benchmark, variant: system).
 * Destructive-action confirmation using the components' own open/close APIs:
 * Dialog owns its title, focus trap, and dismissal; the flow requires an
 * explicit choice (isDismissable={false}).
 */
export function ConfirmDeleteFlow() {
  return (
    <Dialog
      title="Delete this project?"
      size="sm"
      isDismissable={false}
      trigger={<Button variant="danger">Delete project</Button>}
    >
      {({ close }) => (
        <div className={styles.body}>
          <p className={styles.copy}>
            Deleting a project permanently removes its screens, tokens, and build history. This
            action cannot be undone.
          </p>
          <div className={styles.actions}>
            <Button variant="secondary" onPress={close}>
              Cancel
            </Button>
            <Button variant="danger" onPress={close}>
              Confirm
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
