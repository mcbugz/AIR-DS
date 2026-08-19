import { CodeBlock } from '../CodeBlock';

const REPO = 'https://github.com/mcbugz/AIR-DS';

const BUILD_IT = `git clone ${REPO}.git
cd AIR-DS
pnpm install
pnpm build`;

const SEE_IT = `pnpm storybook        # all 14 components + 97 stories
bash scripts/demo.sh  # 30s offline tour: build, gauntlet, evals, ingest`;

const AGENTS = `# compiled agent context (llms.txt family, skills, editor rules)
packages/context/dist/default/llms.txt

# MCP: open the repo in Claude Code — .mcp.json auto-wires ds-mcp
# (search_docs, get_component, list_tokens, validate_usage, ...)`;

/** Getting started — everything below runs offline, zero credentials. */
export function GetStarted() {
  return (
    <section className="section section-alt" aria-labelledby="start-title">
      <div className="section-inner">
        <p className="eyebrow">Get started</p>
        <h2 id="start-title" className="section-title">
          Run it yourself — offline, zero credentials
        </h2>
        <p className="section-lede">
          Node ≥ 24 and pnpm 9 are the only prerequisites. Nothing here requires a key, a login, or
          the network at demo time — that is a recorded project rule.
        </p>
        <div className="start-grid">
          <div>
            <h3 className="start-subtitle">Build it</h3>
            <CodeBlock label="Clone and build commands" code={BUILD_IT} />
          </div>
          <div>
            <h3 className="start-subtitle">See it</h3>
            <CodeBlock label="Demo commands" code={SEE_IT} />
          </div>
        </div>
        <div className="start-agents">
          <h3 className="start-subtitle">For AI agents</h3>
          <p className="demo-text">
            Agents do not read this page — they read the compiled machine layer:{' '}
            <a href={`${REPO}/blob/main/packages/context/dist/default/llms.txt`}>llms.txt</a>, the{' '}
            <a href={`${REPO}/tree/main/registries`}>closed-world registries</a>, and the{' '}
            <a href={`${REPO}/tree/main/packages/mcp`}>ds-mcp server</a> that answers from them at
            runtime.
          </p>
          <CodeBlock label="Agent entry points" code={AGENTS} />
        </div>
      </div>
    </section>
  );
}
