import styles from './StatusDashboard.module.css';

/**
 * RECORDED generation (fixture-replay benchmark, variant: baseline-style).
 * Plausible no-design-system output: Tailwind grid habits, guessed "--ds-"
 * palette tokens, color-only status dots, and a nameless icon-only refresh
 * button (an axe 'button-name' violation).
 */
const services = [
  { name: 'API Gateway', color: 'green', description: 'All regions responding normally.' },
  { name: 'Webhooks', color: 'yellow', description: 'Delivery latency elevated.' },
  { name: 'Batch exports', color: 'red', description: 'Export jobs are queued.' },
];

export function StatusDashboard() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className={styles.banner}>
        Some services are degraded.
        <button type="button" className={styles.refresh}>
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M12 7a5 5 0 1 1-2-4" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </button>
      </div>
      <div className="grid gap-4">
        {services.map((service) => (
          <div key={service.name} className={styles.card}>
            <div className="flex items-center gap-2">
              <span className={styles.dot} data-color={service.color} />
              <span className="font-medium">{service.name}</span>
            </div>
            <p className="text-sm text-gray-500">{service.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
