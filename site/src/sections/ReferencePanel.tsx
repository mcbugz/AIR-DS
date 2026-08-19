import { SettingsScreen } from '../../../examples/reference-screen/SettingsScreen';

/**
 * The acceptance-test artifact, rendered live: the workspace-settings
 * reference screen from examples/reference-screen, imported as-is.
 */
export function ReferencePanel() {
  return (
    <section className="section section-alt" aria-labelledby="reference-title">
      <div className="section-inner">
        <p className="eyebrow">Proof of consumption</p>
        <h2 id="reference-title" className="section-title">
          The reference screen
        </h2>
        <p className="section-lede">
          Built by an agent that had never seen the source — only the compiled machine layer
          (llms.txt, skills, registries, MCP). Zero fabrications, validator-verified. This is the
          actual screen, imported from <code>examples/reference-screen</code> and running live below
          — try the switches, open the delete dialog, flip the brand above.
        </p>
        <div className="reference-frame">
          <SettingsScreen />
        </div>
      </div>
    </section>
  );
}
