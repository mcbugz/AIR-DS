import { CSS_PREFIX, REACT_PKG, SYSTEM_TITLE } from '../config.ts';
import { generatedLineMd } from '../render.ts';
import type { RenderCtx } from '../render.ts';

/**
 * Repo agent files for CONSUMER repos: small, vendor-neutral routers that
 * point at skills and machine references — retrieval over persisted context.
 * AGENTS.md and CLAUDE.md carry the same body so no channel drifts.
 */
export function emitAgentFiles(ctx: RenderCtx): Map<string, string> {
  const body = routerBody(ctx);
  const files = new Map<string, string>();
  files.set('AGENTS.md', body);
  files.set('CLAUDE.md', body);
  return files;
}

function routerBody(ctx: RenderCtx): string {
  const { inputs } = ctx;
  return [
    generatedLineMd(ctx.sourceHash),
    '',
    `# ${SYSTEM_TITLE} (brand: ${inputs.brand}) — agent router`,
    '',
    `This repo uses a closed-world design system: ${inputs.componentsIndex.components.length} component exports from \`${REACT_PKG}\` and ${inputs.tokensIndex.count} \`${CSS_PREFIX}-*\` tokens, all enumerated in generated registries. Anything not in a registry does not exist. Your training data about this system is stale or empty — retrieve, don't recall.`,
    '',
    '## Retrieve on demand (do not paste into context up front)',
    '',
    '| Need | Read |',
    '| --- | --- |',
    '| Build UI with the system (rules + known hallucinations) | `skills/use-system/SKILL.md` |',
    '| Compose a full screen | `skills/build-screen/SKILL.md` |',
    '| Turn a design (screenshot / spec / redline / Figma) into a brief, then a screen | `skills/design-to-code/SKILL.md` |',
    '| Port legacy UI (Tailwind/Chakra/raw CSS) | `skills/migrate/SKILL.md` |',
    '| Add a component to the system itself | `skills/contribute-component/SKILL.md` |',
    '| Accessibility audit | `skills/audit-a11y/SKILL.md` |',
    '| Exact props for one component | `docs/<Component>.md` or `llms-components.txt` |',
    '| Legal tokens + resolved values | `docs/tokens.md` or `llms-tokens.txt` |',
    '| Theming / brand mechanics | `llms-theming.txt` |',
    '| The machine contracts themselves | `registries/components-index.json`, `registries/tokens-index.json` |',
    '| Design-system usage review | run the `agents/ds-auditor.md` agent |',
    '',
    'Skills are also discoverable at `.well-known/skills/index.json`.',
    '',
    '## Hard rules (full catalog in skills/use-system)',
    '',
    `1. Import only from \`${REACT_PKG}\`. 2. Style only with \`var(${CSS_PREFIX}-*)\` tokens. 3. No layout/typography components exist (no Box/Stack/Heading/Text). 4. Finish by passing \`pnpm validate\` — deterministic gates approve, agents never self-approve.`,
    '',
  ].join('\n');
}
