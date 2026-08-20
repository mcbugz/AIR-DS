const REPO = 'https://github.com/mcbugz/AIR-DS';

export function Footer() {
  return (
    <footer className="footer">
      <div className="section-inner">
        <blockquote className="footer-quote">
          “Instruction hopes the model complies. Structure checks.”
        </blockquote>
        <nav className="footer-links" aria-label="Project links">
          <a href={REPO}>GitHub</a>
          <a href="./AIR-DS-overview.pptx" download>
            Overview deck (.pptx)
          </a>
          <a href={`${REPO}/blob/main/docs/architecture.md`}>Architecture</a>
          <a href={`${REPO}/blob/main/docs/EVOLUTION.md`}>The record: brief → mandate</a>
        </nav>
        <p className="footer-note">
          AIR-DS is built by an agent team and gated by a deterministic validation gauntlet — no
          LLM in the merge path. This page is itself built from the system: every control is a
          registry component, every style value a <code>var(--ds-*)</code> token.
        </p>
      </div>
    </footer>
  );
}
