import styles from './SettingsForm.module.css';

/**
 * RECORDED generation (fixture-replay benchmark, variant: baseline-style).
 * Plausible output of an agent that never read the machine surface: Tailwind
 * utility habits, guessed "--ds-" token names that do not exist, and a
 * placeholder-as-label email input (an axe 'label' violation).
 */
export function SettingsForm() {
  return (
    <form className={styles.panel}>
      <h2 className="text-lg font-semibold">Settings</h2>
      <label className="flex flex-col gap-1">
        <span>Display name</span>
        <input className={styles.input} />
      </label>
      <input type="email" placeholder="Email" className={styles.input} />
      <label className="flex flex-col gap-1">
        <span>Timezone</span>
        <select className={styles.input}>
          <option>UTC</option>
          <option>America/New York</option>
          <option>Europe/Berlin</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" defaultChecked />
        <span>Email me about product updates</span>
      </label>
      <div className="flex gap-2 mt-4">
        <button type="submit" className={styles.primary}>
          Save
        </button>
        <button type="button" className={styles.secondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
