import { Button, Checkbox, Select, TextField } from '@ds/react';
import styles from './SettingsForm.module.css';

/**
 * RECORDED generation (fixture-replay benchmark, variant: system).
 * Plausible output of an agent that consumed the AIR-DS machine surface:
 * closed-world components, semantic tokens only, layout via plain elements.
 */
export function SettingsForm() {
  return (
    <form className={styles.settings} aria-label="User settings">
      <TextField label="Display name" description="Shown on your profile and in mentions." />
      <TextField label="Email" type="email" description="Where account notifications are sent." />
      <Select
        label="Timezone"
        placeholder="Choose a timezone"
        items={[
          { id: 'utc', label: 'UTC' },
          { id: 'america-new_york', label: 'America/New York' },
          { id: 'europe-berlin', label: 'Europe/Berlin' },
          { id: 'asia-tokyo', label: 'Asia/Tokyo' },
        ]}
      />
      <Checkbox defaultSelected>Email me about product updates</Checkbox>
      <div className={styles.actions}>
        <Button variant="primary" type="submit">
          Save
        </Button>
        <Button variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}
