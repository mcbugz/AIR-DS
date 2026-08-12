import type { NrId, RegistryContext, Violation } from '../types.ts';

/**
 * Code rules over .ts/.tsx sources:
 *   G5     component closed-world: named imports from '@ds/react' must exist in
 *          registries/components-index.json (NR-001/NR-002 mapping for the
 *          industry-standard fabrications).
 *   NR-005 deep imports from '@ds/react/...' / '@ds/tokens/...'.
 *   NR-004 Tailwind-style utility classes in className string literals.
 *   G1     var(--ds-*) / --ds-* token references in code (inline styles in
 *          stories, style objects) must exist in the token registry.
 */

const LAYOUT_FABRICATIONS = new Set([
  'Box',
  'Stack',
  'HStack',
  'VStack',
  'Flex',
  'Grid',
  'SimpleGrid',
  'Container',
  'Spacer',
  'Center',
  'Wrap',
  'Cluster',
  'Inline',
  'Columns',
]);

const TYPOGRAPHY_FABRICATIONS = new Set([
  'Heading',
  'Text',
  'Title',
  'Paragraph',
  'Typography',
  'Caption',
]);

/**
 * Public subpath exports declared in the packages' `exports` maps (NR-005
 * exemptions). Kept as an explicit list so the rule engine stays pure/hermetic
 * (evals never read package.json); update it when a package declares a new
 * public subpath.
 */
const PUBLIC_SUBPATHS = new Set(['@ds/tokens/css', '@ds/react/icons']);

const TW_PATTERNS: RegExp[] = [
  /^-?(p|px|py|pt|pb|pr|pl|m|mx|my|mt|mb|mr|ml|gap|gap-x|gap-y|space-x|space-y|w|h|max-w|min-w|max-h|min-h)-(\d+(\.\d+)?|px|full|screen|auto|fit|min|max)$/,
  /^(text|bg|border|ring|from|to|via|fill|stroke|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-\d{2,3})?(\/\d{1,3})?$/,
  /^rounded(-(none|sm|md|lg|xl|2xl|3xl|full))?$/,
  /^text-(xs|sm|base|lg|xl|\d?xl)$/,
  /^font-(sans|serif|mono|thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
  /^shadow(-(sm|md|lg|xl|2xl|inner|none))?$/,
];

function lineAt(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}

function nrForFabricatedComponent(name: string): NrId | null {
  if (LAYOUT_FABRICATIONS.has(name)) return 'NR-001';
  if (TYPOGRAPHY_FABRICATIONS.has(name)) return 'NR-002';
  return null;
}

function nrForFabricatedToken(name: string): NrId | null {
  if (/^--ds-(palette-)?[a-z]+-\d{2,3}$/.test(name) || name.startsWith('--ds-palette-')) {
    return 'NR-003';
  }
  if (/^--ds-color-/.test(name) && /(-on-|-on$)/.test(name)) return 'NR-007';
  return null;
}

export function checkCodeFile(
  file: string,
  content: string,
  ctx: RegistryContext,
): Violation[] {
  const violations: Violation[] = [];

  // NR-005: deep imports — only declared public entry points are importable.
  const deepImport = /from\s*['"](@ds\/(?:react|tokens)\/[^'"]+)['"]/g;
  let dm: RegExpExecArray | null;
  while ((dm = deepImport.exec(content)) !== null) {
    const path = dm[1] as string;
    if (PUBLIC_SUBPATHS.has(path)) continue; // documented public subpath exports
    violations.push({
      rule: 'NR-005',
      nr: 'NR-005',
      file,
      line: lineAt(content, dm.index),
      message: `Deep import "${path}" — the only public entry point is the package root (import { X } from '@ds/react').`,
    });
  }

  // G5: named imports from '@ds/react' must be registered components (or their Props types).
  if (ctx.componentNames.size > 0) {
    const importRe = /import\s+(?:type\s+)?\{([^}]+)\}\s*from\s*['"]@ds\/react['"]/g;
    let im: RegExpExecArray | null;
    while ((im = importRe.exec(content)) !== null) {
      const names = (im[1] as string)
        .split(',')
        .map((s) => s.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim() ?? '')
        .filter(Boolean);
      for (const name of names) {
        const base = name.endsWith('Props') ? name.slice(0, -'Props'.length) : name;
        if (!ctx.componentNames.has(name) && !ctx.componentNames.has(base)) {
          violations.push({
            rule: 'G5',
            nr: nrForFabricatedComponent(name),
            file,
            line: lineAt(content, im.index),
            message: `"${name}" is not exported by @ds/react — it is not in registries/components-index.json (closed world).${
              LAYOUT_FABRICATIONS.has(name)
                ? ' Layout primitives do not exist (NR-001): use plain elements + CSS with space tokens.'
                : TYPOGRAPHY_FABRICATIONS.has(name)
                  ? ' Typography components do not exist (NR-002): use semantic HTML with text tokens.'
                  : ''
            }`,
          });
        }
      }
    }
  }

  // NR-004: Tailwind utility classes in className string literals.
  const classAttr = /className\s*=\s*(?:\{\s*)?(["'`])([^"'`]*)\1/g;
  let cm: RegExpExecArray | null;
  while ((cm = classAttr.exec(content)) !== null) {
    const classes = (cm[2] as string).split(/\s+/).filter(Boolean);
    const hits = classes.filter((c) => TW_PATTERNS.some((p) => p.test(c)));
    if (hits.length > 0) {
      violations.push({
        rule: 'NR-004',
        nr: 'NR-004',
        file,
        line: lineAt(content, cm.index),
        message: `Tailwind/utility classes are not part of this system (NR-004): ${hits.join(' ')} — use a CSS Module class consuming --ds-* tokens.`,
      });
    }
  }

  // G1: --ds-* token references in code must exist in the token registry.
  const tokenRef = /--ds-[a-z0-9]+(?:-[a-z0-9]+)*/g;
  let tm: RegExpExecArray | null;
  while ((tm = tokenRef.exec(content)) !== null) {
    const name = tm[0];
    // Skip wildcard mentions in prose/comments: "--ds-button-*", "--ds-alert-*".
    const tail = content.slice(tm.index + name.length, tm.index + name.length + 2);
    if (tail.startsWith('*') || tail.startsWith('-*')) continue;
    if (!ctx.tokenVars.has(name)) {
      violations.push({
        rule: 'G1',
        nr: nrForFabricatedToken(name),
        file,
        line: lineAt(content, tm.index),
        message: `Token "${name}" is not in registries/tokens-index.json — it does not exist (closed world).`,
      });
    }
  }

  return violations;
}
