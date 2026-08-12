import { Button, Checkbox, Select, TextField } from '@ds/react';
import styles from './SettingsForm.module.css';

/** Committed GOOD benchmark fixture: closed-world components + tokens only. */
export function SettingsForm() {
  return (
    <form className={styles.form}>
      <TextField label="Display name" />
      <TextField label="Email" type="email" />
      <Select
        label="Timezone"
        items={[
          { id: 'utc', label: 'UTC' },
          { id: 'us-east', label: 'US Eastern' },
          { id: 'eu-central', label: 'Central European' },
        ]}
      />
      <Checkbox>Email me about product updates</Checkbox>
      <div className={styles.actions}>
        <Button variant="primary" type="submit">
          Save
        </Button>
        <Button variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}
