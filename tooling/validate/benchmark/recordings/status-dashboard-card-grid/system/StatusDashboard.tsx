import { Alert, Badge, Card, CardBody, CardHeader } from '@ds/react';
import styles from './StatusDashboard.module.css';

/**
 * RECORDED generation (fixture-replay benchmark, variant: system).
 * Card grid via plain CSS grid with system gap tokens (layout components do
 * not exist — closed world); status communicated with Badge tones plus text.
 */
const services = [
  {
    name: 'API Gateway',
    tone: 'success',
    status: 'Operational',
    description: 'All regions responding normally.',
  },
  {
    name: 'Webhooks',
    tone: 'warning',
    status: 'Degraded',
    description: 'Delivery latency elevated; retries are catching up.',
  },
  {
    name: 'Batch exports',
    tone: 'danger',
    status: 'Outage',
    description: 'Export jobs are queued while storage recovers.',
  },
] as const;

export function StatusDashboard() {
  return (
    <section className={styles.dashboard} aria-label="Service status">
      <Alert tone="warning" title="Degraded services">
        Webhooks and batch exports are currently affected. Follow this page for updates.
      </Alert>
      <div className={styles.grid}>
        {services.map((service) => (
          <Card key={service.name}>
            <CardHeader>
              <h3 className={styles.serviceName}>{service.name}</h3>
            </CardHeader>
            <CardBody>
              <Badge tone={service.tone}>{service.status}</Badge>
              <p className={styles.description}>{service.description}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}
