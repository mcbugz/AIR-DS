import { Alert, Badge, Card, CardBody, CardHeader } from '@ds/react';
import type { FleetData, RepoReport } from '../types.ts';
import { Sparkline } from './Sparkline.tsx';

/**
 * The fleet dashboard — executive-legible: the top row answers "are my
 * agents under control" in five numbers. Everything below is the drill-down.
 * Dogfood discipline: registry components only, every style value in
 * dashboard.css is a var(--ds-*) token.
 */

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const pct = (v: number | null, digits = 1): string => (v === null ? '—' : `${(v * 100).toFixed(digits)}%`);
const num = (v: number | null): string => (v === null ? '—' : String(v));

function rateTone(v: number | null, good: number, warn: number): Tone {
  if (v === null) return 'neutral';
  if (v >= good) return 'success';
  if (v >= warn) return 'warning';
  return 'danger';
}

function hallucinationTone(v: number | null): Tone {
  if (v === null) return 'neutral';
  if (v === 0) return 'success';
  return v <= 0.05 ? 'warning' : 'danger';
}

const deltaArrow = (d: number | null, invert = false): string => {
  if (d === null || d === 0) return '';
  const up = d > 0;
  const good = invert ? !up : up;
  return ` ${up ? '↑' : '↓'}${good ? '' : '!'}`;
};

function ScoreTile(props: { label: string; value: string; tone: Tone; sub: string }) {
  return (
    <Card elevation="raised" className={`fleet-tile fleet-tile--${props.tone}`}>
      <CardBody>
        <div className="fleet-tile-value">{props.value}</div>
        <div className="fleet-tile-label">{props.label}</div>
        <div className="fleet-tile-sub">{props.sub}</div>
      </CardBody>
    </Card>
  );
}

function Scorecard({ data }: { data: FleetData }) {
  const h = data.fleet.headline;
  const t = data.fleet.totals;
  return (
    <section className="fleet-scorecard" aria-label="Fleet scorecard">
      <ScoreTile
        label="Hallucination rate"
        value={h.hallucinationRate === null ? '—' : h.hallucinationRate.toFixed(3)}
        tone={hallucinationTone(h.hallucinationRate)}
        sub={`fabrications per run · ${t.fabrications} across ${t.runs} runs`}
      />
      <ScoreTile
        label="First-pass gauntlet"
        value={pct(h.firstPassRate)}
        tone={rateTone(h.firstPassRate, 0.9, 0.75)}
        sub={`deterministic merge gate, fleet-weighted${deltaArrow(data.fleet.deltas.gauntletPass)}`}
      />
      <ScoreTile
        label="Eval compliance"
        value={pct(h.evalCompliance)}
        tone={rateTone(h.evalCompliance, 0.98, 0.9)}
        sub={`latest eval snapshots, case-weighted${deltaArrow(data.fleet.deltas.evalOverall)}`}
      />
      <ScoreTile
        label="A11y clean stories"
        value={pct(h.a11yCleanRate)}
        tone={rateTone(h.a11yCleanRate, 0.99, 0.95)}
        sub="stories with zero axe violations"
      />
      <ScoreTile
        label="Policy compliance"
        value={pct(h.policyCompliance)}
        tone={rateTone(h.policyCompliance, 0.9, 0.7)}
        sub={`${t.policiesPassing}/${t.repos} repos governed & passing`}
      />
    </section>
  );
}

function policyBadge(r: RepoReport) {
  if (!r.policy.present) return <Badge tone="neutral">no policy</Badge>;
  return r.policy.ok ? <Badge tone="success">compliant</Badge> : <Badge tone="danger">{r.policy.failing.length} breach(es)</Badge>;
}

function axeBadge(r: RepoReport) {
  const axe = r.latest?.storiesAxe ?? null;
  if (!axe) return <Badge tone="neutral">not recorded</Badge>;
  const clean = axe.stories - axe.storiesWithViolations;
  return axe.gatePassed ? (
    <Badge tone={clean === axe.stories ? 'success' : 'warning'}>
      {clean}/{axe.stories} stories clean
    </Badge>
  ) : (
    <Badge tone="danger">{axe.serious + axe.critical} serious+</Badge>
  );
}

function healthTone(h: number): Tone {
  return h >= 0.9 ? 'success' : h >= 0.75 ? 'warning' : 'danger';
}

function RepoTable({ repos }: { repos: RepoReport[] }) {
  return (
    <section aria-label="Per-repo detail">
      <h2>Repos</h2>
      <div className="fleet-table-scroll">
        <table className="fleet-table">
          <thead>
            <tr>
              <th scope="col">Repo</th>
              <th scope="col">Health</th>
              <th scope="col">First-pass</th>
              <th scope="col">Evals</th>
              <th scope="col">Fabrications</th>
              <th scope="col">A11y</th>
              <th scope="col">Registry</th>
              <th scope="col">Policy</th>
            </tr>
          </thead>
          <tbody>
            {repos.map((r) => (
              <tr key={r.id}>
                <th scope="row">
                  <span className="fleet-repo-id">{r.id}</span>
                  <span className="fleet-repo-sub">
                    {r.latest ? `${r.latest.sha} · ${r.lines} runs` : 'no history'}
                  </span>
                </th>
                <td>
                  <Badge tone={healthTone(r.health)}>{(r.health * 100).toFixed(0)}</Badge>
                </td>
                <td>
                  <span className="fleet-cell-value">{pct(r.rates.gauntletFirstPass.rate, 0)}</span>
                  <span className={`fleet-spark-wrap fleet-spark-wrap--${healthTone(r.health)}`}>
                    <Sparkline values={r.trend.gauntletPass} min={0} max={1} label={`${r.id} gauntlet pass trend`} />
                  </span>
                </td>
                <td>
                  <span className="fleet-cell-value">
                    {r.latest?.evals ? pct(r.latest.evals.overall, 0) : '—'}
                    {deltaArrow(r.deltas.evalOverall)}
                  </span>
                  <span className="fleet-spark-wrap">
                    <Sparkline values={r.trend.evalOverall} min={0.5} max={1} label={`${r.id} eval overall trend`} />
                  </span>
                </td>
                <td>
                  <span className="fleet-cell-value">
                    {num(r.latest ? r.latest.fabrications : null)}
                    {deltaArrow(r.deltas.fabrications, true)}
                  </span>
                  <span className={`fleet-spark-wrap${r.rates.fabricationsTotal > 0 ? ' fleet-spark-wrap--danger' : ''}`}>
                    <Sparkline values={r.trend.fabrications} min={0} label={`${r.id} fabrications trend`} />
                  </span>
                </td>
                <td>{axeBadge(r)}</td>
                <td>
                  <span className="fleet-cell-value">
                    {r.latest ? `${r.latest.registry.tokens}t · ${r.latest.registry.components}c` : '—'}
                  </span>
                </td>
                <td>{policyBadge(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PolicyPanel({ repos }: { repos: RepoReport[] }) {
  const governed = repos.filter((r) => r.policy.present);
  const ungoverned = repos.filter((r) => !r.policy.present);
  return (
    <section aria-label="Policy compliance">
      <h2>Policy compliance</h2>
      {governed.map((r) => (
        <Card key={r.id} className="fleet-policy-card">
          <CardHeader>
            <span className="fleet-repo-id">{r.id}</span> {policyBadge(r)}
          </CardHeader>
          <CardBody>
            <ul className="fleet-checklist">
              {r.policy.checks.map((c) => (
                <li key={c.id} className={c.ok ? 'fleet-check--ok' : 'fleet-check--fail'}>
                  <span className="fleet-check-id">{c.ok ? '✓' : '✗'} {c.id}</span>
                  <span className="fleet-check-detail">
                    expected {c.expected}; got {c.actual}
                    {c.detail ? ` — ${c.detail}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ))}
      {ungoverned.length > 0 ? (
        <Alert tone="warning" isLive={false} className="fleet-ungoverned">
          {ungoverned.length} repo(s) without a fleet-policy.json: {ungoverned.map((r) => r.id).join(', ')} — ungoverned
          repos count against fleet policy compliance.
        </Alert>
      ) : null}
    </section>
  );
}

function AdoptionPanel({ repos }: { repos: RepoReport[] }) {
  return (
    <section aria-label="Brand and adoption">
      <h2>Adoption</h2>
      <div className="fleet-adoption-grid">
        {repos.map((r) => (
          <Card key={r.id} className="fleet-adoption-card">
            <CardBody>
              <div className="fleet-repo-id">{r.id}</div>
              <dl className="fleet-adoption-facts">
                <div>
                  <dt>Registry tokens</dt>
                  <dd>
                    {r.latest ? r.latest.registry.tokens : '—'}
                    <span className="fleet-spark-wrap">
                      <Sparkline values={r.trend.tokens} label={`${r.id} token count trend`} />
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Components</dt>
                  <dd>{r.latest ? r.latest.registry.components : '—'}</dd>
                </div>
                <div>
                  <dt>Benchmark compliance</dt>
                  <dd>
                    {r.latest?.benchmark
                      ? `${pct(r.latest.benchmark.systemCompliance, 0)} vs ${pct(r.latest.benchmark.baselineCompliance, 0)} baseline`
                      : 'not run'}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function App({ data }: { data: FleetData }) {
  const worst = data.fleet.worst;
  return (
    <div className="fleet">
      <header className="fleet-header">
        <div className="fleet-header-inner">
          <h1>Fleet control plane</h1>
          <p className="fleet-header-sub">
            {data.fleet.totals.repos} repos · {data.fleet.totals.runs} recorded runs · as of {data.generatedAt}
          </p>
        </div>
      </header>
      <main className="fleet-main">
        <Scorecard data={data} />
        {worst.length > 0 && (worst[0]?.health ?? 1) < 0.75 ? (
          <Alert tone="danger" isLive={false} className="fleet-worst">
            Attention: {worst.filter((w) => w.health < 0.75).map((w) => `${w.id} (health ${(w.health * 100).toFixed(0)})`).join(', ')}
          </Alert>
        ) : null}
        <RepoTable repos={data.repos} />
        <div className="fleet-two-col">
          <PolicyPanel repos={data.repos} />
          <AdoptionPanel repos={data.repos} />
        </div>
      </main>
      <footer className="fleet-footer">
        Generated by <code>ds-fleet</code> from per-repo <code>metrics/history.jsonl</code> — deterministic, credential-free,
        no network at runtime.
      </footer>
    </div>
  );
}
