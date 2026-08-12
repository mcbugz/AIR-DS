import { Box, Stack, TextField, Button } from '@ds/react';
import Select from '@ds/react/dist/Select';
import styles from './SettingsForm.module.css';

/**
 * Committed BAD benchmark fixture: deliberately violates the closed world —
 * fabricated layout components (NR-001), a deep import (NR-005), Tailwind
 * utility classes (NR-004), and token fabrications in the CSS twin. The
 * dry-run scorer must fail this output.
 */
export function SettingsForm() {
  return (
    <Box className="p-4 rounded-lg bg-white">
      <Stack gap="md">
        <TextField label="Display name" />
        <TextField label="Email" />
        <Select label="Timezone" />
        <div className={styles.actions}>
          <Button variant="primary">Save</Button>
          <Button variant="secondary">Cancel</Button>
        </div>
      </Stack>
    </Box>
  );
}
