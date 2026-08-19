import { Badge, Card, CardBody, CardHeader } from '@ds/react';

const MOVES: Array<{ tag: string; title: string; body: string; proof: string }> = [
  {
    tag: 'ds-assess',
    title: 'Score any design system',
    body:
      'A deterministic scanner grades any repo’s AI-readiness across six evidence-backed pillars — fabrication exposure, context coverage, enforcement gaps — no credentials, no LLM, no network.',
    proof: 'This repo: 99.4/A. A typical 2023 design system fixture: 6.6/F, with the five gaps named.',
  },
  {
    tag: 'ds-retrofit',
    title: 'Keep the system you have',
    body:
      'Point it at an existing design system — CSS variables, Tailwind config, a React library — and it synthesizes the registries, compiles the full machine surface, and arms the fabrication gauntlet on top of YOUR components. No rewrite.',
    proof: 'Proven end-to-end on a committed legacy fixture: 44 tokens with provenance, 4 components indexed, 48-file AI layer emitted.',
  },
  {
    tag: 'ds-fleet',
    title: 'Govern hundreds of repos',
    body:
      'Every repo’s gauntlet, eval, and a11y telemetry rolls up into one executive dashboard — hallucination rate, first-pass rate, policy compliance — with policy-as-code the gauntlet enforces.',
    proof: 'Five headline numbers a CTO reads in ten seconds; breaches exit nonzero in CI.',
  },
  {
    tag: '@ds/genui',
    title: 'Safe generative UI at runtime',
    body:
      'A versioned wire format agents emit live — validated closed-world against the registries, rendered only through registry components, interactivity bound by the host, never by agent code.',
    proof: '51-case fuzz run: every injection attempt rejected or rendered inert.',
  },
  {
    tag: '@ds/wc + RN',
    title: 'Not just React',
    body:
      'The same resolved token graph emits Shadow-DOM CSS and typed React Native styles; a zero-dependency <ds-button> ships with its own closed-world registry. Framework is a render target, not the architecture.',
    proof: 'Existing outputs proven byte-identical while the new platforms were added.',
  },
  {
    tag: 'evidence pack',
    title: 'Prove it to your auditors',
    body:
      'One command produces an auditor-ready bundle: WCAG evidence, provenance with freshly executed gate results, dependency inventory — a broken system cannot generate passing evidence.',
    proof: 'Deterministic, offline, hash-manifested.',
  },
];

/** Mandate v2: the control plane for AI-generated UI (docs/strategy/mandate-v2.md). */
export function ControlPlane() {
  return (
    <section className="section" aria-labelledby="cto-title">
      <div className="section-inner">
        <p className="eyebrow">For engineering leaders</p>
        <h2 id="cto-title" className="section-title">
          The control plane for AI-generated UI
        </h2>
        <p className="section-lede">
          Agents will produce most of your UI; the only open question is governed or ungoverned.
          The design system above is the proof — these six capabilities are the product. All of
          them run locally with zero credentials.
        </p>
        <div className="control-grid">
          {MOVES.map((m) => (
            <Card key={m.tag} elevation="raised">
              <CardHeader>
                <div className="control-head">
                  <Badge tone="info">{m.tag}</Badge>
                  <span className="control-title">{m.title}</span>
                </div>
              </CardHeader>
              <CardBody>
                <p className="control-body">{m.body}</p>
                <p className="control-proof">{m.proof}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
