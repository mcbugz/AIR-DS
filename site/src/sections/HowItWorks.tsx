import { Card, CardBody, CardHeader } from '@ds/react';

const LAYERS: Array<{ n: string; title: string; body: string }> = [
  {
    n: '1',
    title: 'Tokens',
    body:
      'DTCG source in three tiers; the brand tier is the only theming surface. The build emits CSS variables, TS types, and a closed-world token index — and a WCAG-AA contrast gate fails the build, not the review.',
  },
  {
    n: '2',
    title: 'Components',
    body:
      'React 19 on react-aria-components: typed literal-union props, token-only CSS Modules, accessibility inside. 97 Storybook stories are the contract — axe-swept in real Chromium, 0 violations.',
  },
  {
    n: '3',
    title: 'Machine surface',
    body:
      'Everything an agent consumes — llms.txt family, 6 skills, 4 editor channels, a 6-tool MCP server — is compiled from the registries, never hand-written, and re-emitted per customer brand.',
  },
  {
    n: '4',
    title: 'Enforcement',
    body:
      'One deterministic gauntlet gates merges: typecheck, 11+ custom closed-world rules, build, test + axe, registry check. 21 eval pairs at 1.0 on critical gates. No LLM in the merge path.',
  },
];

/** The four layers, one source of truth (docs/architecture.md, condensed). */
export function HowItWorks() {
  return (
    <section className="section" aria-labelledby="how-title">
      <div className="section-inner">
        <p className="eyebrow">Architecture</p>
        <h2 id="how-title" className="section-title">
          Four layers, one source of truth
        </h2>
        <p className="section-lede">
          Every arrow is a deterministic build step. Instruction hopes the model complies —
          structure checks.
        </p>
        <div className="how-grid">
          {LAYERS.map((l) => (
            <Card elevation="flat" key={l.n}>
              <CardHeader>
                <h3 className="card-title">
                  <span className="layer-n" aria-hidden="true">
                    {l.n}
                  </span>
                  {l.title}
                </h3>
              </CardHeader>
              <CardBody>
                <p className="demo-text">{l.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
