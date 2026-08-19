/**
 * The scoring rubric: six pillars mapped to the brief §5 ten practices, each
 * pillar composed of weighted deterministic checks. Check weights sum to 100
 * within a pillar; pillar weights sum to 100 overall. Every check outcome
 * carries evidence — including evidence of absence.
 */
import type { ComponentFindings } from './probes/components.ts';
import type { EnforcementFindings } from './probes/enforcement.ts';
import type { EvidenceFindings } from './probes/evidence.ts';
import type { MachineSurfaceFindings } from './probes/machine-surface.ts';
import type { RegistryFindings } from './probes/registries.ts';
import type { TokenFindings } from './probes/tokens.ts';
import type { WhiteLabelFindings } from './probes/whitelabel.ts';
import type {
  CheckOutcome,
  CheckResult,
  Evidence,
  FabricationExposure,
  Grade,
  PillarId,
  PillarResult,
} from './types.ts';

export interface Findings {
  tokens: TokenFindings;
  components: ComponentFindings;
  machine: MachineSurfaceFindings;
  enforcement: EnforcementFindings;
  registries: RegistryFindings;
  whitelabel: WhiteLabelFindings;
  evidence: EvidenceFindings;
  fabrication: FabricationExposure;
}

interface CheckDef {
  id: string;
  pillar: PillarId;
  title: string;
  weight: number;
  run: (f: Findings) => CheckOutcome;
}

export interface PillarDef {
  id: PillarId;
  name: string;
  weight: number;
  practices: number[];
}

export const PILLARS: PillarDef[] = [
  { id: 'tokens', name: 'Tokens', weight: 20, practices: [1] },
  { id: 'components', name: 'Components', weight: 18, practices: [2] },
  { id: 'machine-surface', name: 'Machine surface', weight: 18, practices: [3, 4, 5, 6] },
  { id: 'enforcement', name: 'Enforcement', weight: 16, practices: [7, 8, 9] },
  { id: 'white-label', name: 'White-label readiness', weight: 14, practices: [1] },
  { id: 'evidence', name: 'Evidence', weight: 14, practices: [8, 9] },
];

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const found = (detail: string, path?: string, count?: number): Evidence =>
  path === undefined ? { detail, ...(count !== undefined ? { count } : {}) } : { detail, path, ...(count !== undefined ? { count } : {}) };

export const CHECKS: CheckDef[] = [
  // ------------------------------------------------------------- Tokens (20)
  {
    id: 'TOK-1',
    pillar: 'tokens',
    title: 'Design tokens in a standard source format (W3C DTCG JSON)',
    weight: 25,
    run: ({ tokens }) => {
      if (tokens.dtcgTokenCount === 0) {
        return {
          score: 0,
          evidence: [found('No JSON files with DTCG "$value" tokens found anywhere in the repo.')],
        };
      }
      const top = tokens.dtcgFiles[0];
      return {
        score: clamp01(tokens.dtcgTokenCount / 20),
        evidence: [
          found(
            `${tokens.dtcgTokenCount} DTCG tokens across ${tokens.dtcgFiles.length} file(s)`,
            top?.path,
            tokens.dtcgTokenCount,
          ),
        ],
      };
    },
  },
  {
    id: 'TOK-2',
    pillar: 'tokens',
    title: 'Token build pipeline (source compiled to platform outputs)',
    weight: 15,
    run: ({ tokens }) => {
      if (tokens.styleDictionary !== null) {
        return { score: 1, evidence: [found('Style Dictionary detected', tokens.styleDictionary)] };
      }
      if (tokens.tokenPackage !== null && tokens.dtcgTokenCount > 0) {
        return {
          score: 1,
          evidence: [found('Dedicated token package with a build script over DTCG source', tokens.tokenPackage)],
        };
      }
      if (tokens.tailwindConfig !== null) {
        return {
          score: 0.4,
          evidence: [
            found(
              'Tailwind config found — token values exist but live inside one build tool, not a portable token pipeline',
              tokens.tailwindConfig,
            ),
          ],
        };
      }
      return { score: 0, evidence: [found('No token build pipeline (no Style Dictionary, token package, or Tailwind config).')] };
    },
  },
  {
    id: 'TOK-3',
    pillar: 'tokens',
    title: 'Tokens delivered as CSS custom properties',
    weight: 15,
    run: ({ tokens }) => {
      const n = tokens.cssVarNames.length;
      if (n === 0) return { score: 0, evidence: [found('No CSS custom properties defined in any stylesheet.')] };
      const top = tokens.cssVarDefFiles[0];
      return {
        score: clamp01(n / 50),
        evidence: [found(`${n} distinct custom properties defined`, top?.path, n)],
      };
    },
  },
  {
    id: 'TOK-4',
    pillar: 'tokens',
    title: 'Consistent token naming (one namespace prefix)',
    weight: 20,
    run: ({ tokens }) => {
      if (tokens.dominantPrefix === null) {
        return {
          score: 0,
          evidence: [found(`Too few custom properties (${tokens.cssVarNames.length}) to establish a naming convention.`)],
        };
      }
      const { prefix, share } = tokens.dominantPrefix;
      return {
        score: clamp01(share),
        evidence: [
          found(`${Math.round(share * 100)}% of ${tokens.cssVarNames.length} custom properties share the "--${prefix}-" namespace`),
        ],
      };
    },
  },
  {
    id: 'TOK-5',
    pillar: 'tokens',
    title: 'Published token registry (machine-enumerable closed world)',
    weight: 15,
    run: ({ registries }) => {
      if (registries.tokenRegistry === null) {
        return {
          score: 0,
          evidence: [found('No machine-readable token enumeration found — any token an agent invents is undetectable.')],
        };
      }
      return {
        score: 1,
        evidence: [
          found(
            `Token registry with ${registries.tokenRegistry.entries} entries`,
            registries.tokenRegistry.path,
            registries.tokenRegistry.entries,
          ),
        ],
      };
    },
  },
  {
    id: 'TOK-6',
    pillar: 'tokens',
    title: 'Semantic (intent-based) token names, not raw scales',
    weight: 10,
    run: ({ tokens }) => {
      const n = tokens.cssVarNames.length;
      if (n < 10) {
        return {
          score: 0,
          evidence: [found(`Too few custom properties (${n}) to constitute a semantic naming layer.`)],
        };
      }
      const raw = tokens.rawScaleNames.length;
      const share = raw / n;
      return {
        score: clamp01(1 - share),
        evidence: [
          found(
            raw === 0
              ? `0 of ${n} custom properties use raw-scale names (blue-500 style) — naming is intent-based`
              : `${raw} of ${n} custom properties are raw scales (e.g. ${tokens.rawScaleNames.slice(0, 3).join(', ')})`,
            undefined,
            raw,
          ),
        ],
      };
    },
  },

  // --------------------------------------------------------- Components (18)
  {
    id: 'CMP-1',
    pillar: 'components',
    title: 'A real component library (enumerable component source files)',
    weight: 20,
    run: ({ components }) => {
      const n = components.componentFiles;
      if (n === 0) return { score: 0, evidence: [found('No React component source files (.tsx/.jsx) found.')] };
      return {
        score: clamp01(n / 10),
        evidence: [found(`${n} component source files in ${components.componentDirs} directories (e.g. ${components.exampleComponentPaths[0] ?? ''})`, undefined, n)],
      };
    },
  },
  {
    id: 'CMP-2',
    pillar: 'components',
    title: 'TypeScript component APIs',
    weight: 20,
    run: ({ components }) => {
      if (components.typedShare === null) {
        return { score: 0, evidence: [found('No component files to evaluate.')] };
      }
      return {
        score: clamp01(components.typedShare),
        evidence: [found(`${Math.round(components.typedShare * 100)}% of component files are TypeScript (.tsx)`)],
      };
    },
  },
  {
    id: 'CMP-3',
    pillar: 'components',
    title: 'Typed props with literal-union variants (invalid combinations fail to compile)',
    weight: 25,
    run: ({ components }) => {
      const { propsDecls, variantUnionProps, variantLooseProps } = components;
      const propsScore = clamp01(propsDecls / 5);
      let unionShare: number;
      if (variantUnionProps + variantLooseProps > 0) {
        unionShare = variantUnionProps / (variantUnionProps + variantLooseProps);
      } else {
        unionShare = propsDecls > 0 ? 0.75 : 0;
      }
      const evidence: Evidence[] = [
        found(`${propsDecls} Props type declarations found`, components.propsDeclFiles[0], propsDecls),
        found(
          `${variantUnionProps} variant-ish props typed as literal unions, ${variantLooseProps} as loose string`,
        ),
      ];
      for (const ex of components.looseExamples) evidence.push(found(`loose: ${ex}`));
      return { score: 0.5 * propsScore + 0.5 * unionShare, evidence };
    },
  },
  {
    id: 'CMP-4',
    pillar: 'components',
    title: 'Closed component registry / enumerable exports',
    weight: 20,
    run: ({ components, registries }) => {
      if (registries.componentRegistry !== null) {
        return {
          score: 1,
          evidence: [
            found(
              `Machine-readable component registry with ${registries.componentRegistry.entries} entries`,
              registries.componentRegistry.path,
              registries.componentRegistry.entries,
            ),
          ],
        };
      }
      if (components.barrel !== null) {
        return {
          score: 0.5,
          evidence: [
            found(
              `Barrel with ${components.barrel.exports} exports (enumerable, but no machine-readable prop contract)`,
              components.barrel.path,
            ),
          ],
        };
      }
      return { score: 0, evidence: [found('No component enumeration — an agent-invented component is unprovable.')] };
    },
  },
  {
    id: 'CMP-5',
    pillar: 'components',
    title: 'Stories as contract artifacts (ground-truth usage per component)',
    weight: 15,
    run: ({ components }) => {
      if (components.storyFiles === 0) {
        return { score: 0, evidence: [found('No Storybook stories found.')] };
      }
      const ratio = components.storyFiles / Math.max(3, components.componentDirs * 0.7);
      return {
        score: clamp01(ratio),
        evidence: [found(`${components.storyFiles} story files across ${components.componentDirs} component directories`, undefined, components.storyFiles)],
      };
    },
  },

  // ------------------------------------------------------ Machine surface (18)
  {
    id: 'MS-1',
    pillar: 'machine-surface',
    title: 'MCP server (agents can query the system, not guess it)',
    weight: 25,
    run: ({ machine }) => {
      if (machine.mcp === null) {
        return { score: 0, evidence: [found('No MCP server or MCP configuration found.')] };
      }
      return { score: 1, evidence: [found('MCP surface detected', machine.mcp)] };
    },
  },
  {
    id: 'MS-2',
    pillar: 'machine-surface',
    title: 'llms.txt family (compiled agent-readable docs index)',
    weight: 20,
    run: ({ machine }) => {
      if (machine.llmsTxt === null) {
        return { score: 0, evidence: [found('No llms.txt found — agents have no compiled entry point to the docs.')] };
      }
      const hasTiers = machine.llmsFull !== null || machine.llmsSlices >= 2;
      const evidence = [found('llms.txt present', machine.llmsTxt)];
      if (machine.llmsFull !== null) evidence.push(found('llms-full.txt present', machine.llmsFull));
      if (machine.llmsSlices > 0) evidence.push(found(`${machine.llmsSlices} llms-*.txt slices`, undefined, machine.llmsSlices));
      return { score: hasTiers ? 1 : 0.7, evidence };
    },
  },
  {
    id: 'MS-3',
    pillar: 'machine-surface',
    title: 'Repo agent files (AGENTS.md / CLAUDE.md routers)',
    weight: 20,
    run: ({ machine }) => {
      if (machine.agentFiles.length === 0) {
        return { score: 0, evidence: [found('No AGENTS.md / CLAUDE.md / .cursorrules found.')] };
      }
      return {
        score: machine.rootAgentFile ? 1 : 0.7,
        evidence: machine.agentFiles.slice(0, 3).map((p) => found('agent file', p)),
      };
    },
  },
  {
    id: 'MS-4',
    pillar: 'machine-surface',
    title: 'Agent skills (.well-known/skills or SKILL.md)',
    weight: 15,
    run: ({ machine }) => {
      if (machine.skills === null) return { score: 0, evidence: [found('No agent skills distribution found.')] };
      return { score: 1, evidence: [found('skills surface detected', machine.skills)] };
    },
  },
  {
    id: 'MS-5',
    pillar: 'machine-surface',
    title: 'Editor rules (Cursor / Copilot / Windsurf)',
    weight: 20,
    run: ({ machine }) => {
      if (machine.editorRules.length === 0) {
        return { score: 0, evidence: [found('No editor rule files found.')] };
      }
      return {
        score: 1,
        evidence: machine.editorRules.slice(0, 3).map((p) => found('editor rules', p)),
      };
    },
  },

  // ---------------------------------------------------------- Enforcement (16)
  {
    id: 'ENF-1',
    pillar: 'enforcement',
    title: 'CI pipeline (a merge gate exists)',
    weight: 20,
    run: ({ enforcement }) => {
      if (enforcement.ciConfigs.length === 0) return { score: 0, evidence: [found('No CI configuration found.')] };
      return {
        score: 1,
        evidence: enforcement.ciConfigs.slice(0, 3).map((p) => found('CI config', p)),
      };
    },
  },
  {
    id: 'ENF-2',
    pillar: 'enforcement',
    title: 'Token/style linting (hard-coded values are mechanically caught)',
    weight: 25,
    run: ({ enforcement }) => {
      if (enforcement.customValidator !== null) {
        return { score: 1, evidence: [found('Custom token validator package (gauntlet-style)', enforcement.customValidator)] };
      }
      if (enforcement.styleLint !== null) {
        return { score: 0.7, evidence: [found('Stylelint present (rule coverage of token discipline not verified)', enforcement.styleLint)] };
      }
      return { score: 0, evidence: [found('No style/token linting — hard-coded values merge silently.')] };
    },
  },
  {
    id: 'ENF-3',
    pillar: 'enforcement',
    title: 'Accessibility testing in the loop (axe or equivalent)',
    weight: 20,
    run: ({ enforcement }) => {
      if (enforcement.a11yTooling === null) return { score: 0, evidence: [found('No a11y testing tooling (axe/pa11y/addon-a11y) found.')] };
      return { score: 1, evidence: [found('a11y test tooling detected', enforcement.a11yTooling)] };
    },
  },
  {
    id: 'ENF-4',
    pillar: 'enforcement',
    title: 'Eval files (agent-behavior regression suite)',
    weight: 15,
    run: ({ enforcement }) => {
      if (enforcement.evalFiles.length === 0) return { score: 0, evidence: [found('No eval files found.')] };
      return { score: 1, evidence: enforcement.evalFiles.slice(0, 3).map((p) => found('eval file', p)) };
    },
  },
  {
    id: 'ENF-5',
    pillar: 'enforcement',
    title: 'Automated tests exist at meaningful volume',
    weight: 20,
    run: ({ enforcement }) => {
      const n = enforcement.testFiles;
      if (n === 0) return { score: 0, evidence: [found('No test files found.')] };
      return { score: clamp01(n / 10), evidence: [found(`${n} test files`, undefined, n)] };
    },
  },

  // ---------------------------------------------------------- White-label (14)
  {
    id: 'WL-1',
    pillar: 'white-label',
    title: 'Brand tier isolated as swappable data (theme = a file, not a fork)',
    weight: 30,
    run: ({ whitelabel }) => {
      const n = whitelabel.brandFiles.length;
      if (n === 0) return { score: 0, evidence: [found('No brands/themes data directory found — re-branding means code changes.')] };
      return {
        score: n >= 2 ? 1 : 0.7,
        evidence: [
          found(`${n} brand/theme data file(s) under ${whitelabel.brandDirs.join(', ')}`, whitelabel.brandFiles[0], n),
        ],
      };
    },
  },
  {
    id: 'WL-2',
    pillar: 'white-label',
    title: 'Fabrication exposure: styles reference variables, not hard-coded values',
    weight: 40,
    run: ({ fabrication }) => {
      if (fabrication.ratio === null) {
        return {
          score: 0,
          evidence: [found('No token-relevant style code found to sample — exposure is unmeasurable, which is itself the finding.')],
        };
      }
      const pct = Math.round(fabrication.ratio * 100);
      const evidence: Evidence[] = [
        found(
          `${fabrication.hardcoded} hard-coded values vs ${fabrication.variableRefs} variable references across ${fabrication.sampledFiles} sampled style files (${pct}% hard-coded)`,
        ),
      ];
      for (const w of fabrication.worstFiles.slice(0, 3)) {
        evidence.push(found(`${w.hardcoded} hard-coded / ${w.variableRefs} vars`, w.path));
      }
      return { score: clamp01(1 - fabrication.ratio), evidence };
    },
  },
  {
    id: 'WL-3',
    pillar: 'white-label',
    title: 'Usage sites consume semantic tokens (no appearance-coupled names)',
    weight: 30,
    run: ({ tokens }) => {
      const used = tokens.usageVarNames.length;
      if (used === 0) {
        return { score: 0, evidence: [found('No var(--*) consumption found in hand-written styles.')] };
      }
      const raw = tokens.rawUsageNames.length;
      // Tiny samples earn proportionally little: 1 clean var ref is not a
      // semantic-consumption architecture.
      return {
        score: clamp01((1 - raw / used) * Math.min(1, used / 5)),
        evidence: [
          found(
            raw === 0
              ? `All ${used} consumed custom properties are semantic (no blue-500-style usage)`
              : `${raw} of ${used} consumed custom properties are raw scales (e.g. ${tokens.rawUsageNames.slice(0, 3).join(', ')})`,
            undefined,
            raw,
          ),
        ],
      };
    },
  },

  // -------------------------------------------------------------- Evidence (14)
  {
    id: 'EVD-1',
    pillar: 'evidence',
    title: 'Machine contracts committed (token + component registries)',
    weight: 30,
    run: ({ registries }) => {
      const t = registries.tokenRegistry;
      const c = registries.componentRegistry;
      if (t === null && c === null) {
        return { score: 0, evidence: [found('Neither a token registry nor a component registry exists.')] };
      }
      const evidence: Evidence[] = [];
      if (t !== null) evidence.push(found(`token registry (${t.entries} entries)`, t.path));
      if (c !== null) evidence.push(found(`component registry (${c.entries} entries)`, c.path));
      return { score: t !== null && c !== null ? 1 : 0.5, evidence };
    },
  },
  {
    id: 'EVD-2',
    pillar: 'evidence',
    title: 'Accessibility/contrast evidence artifacts',
    weight: 25,
    run: ({ evidence }) => {
      if (evidence.a11yArtifacts.length === 0) {
        return { score: 0, evidence: [found('No a11y/contrast report artifacts found — compliance claims have no proof.')] };
      }
      return { score: 1, evidence: evidence.a11yArtifacts.slice(0, 3).map((p) => found('a11y evidence', p)) };
    },
  },
  {
    id: 'EVD-3',
    pillar: 'evidence',
    title: 'Metrics/benchmark history (quality tracked over time)',
    weight: 25,
    run: ({ evidence }) => {
      if (evidence.metricsHistory.length === 0) {
        return { score: 0, evidence: [found('No metrics or benchmark history artifacts found.')] };
      }
      return { score: 1, evidence: evidence.metricsHistory.slice(0, 3).map((p) => found('metrics history', p)) };
    },
  },
  {
    id: 'EVD-4',
    pillar: 'evidence',
    title: 'Reproducible quality gates (validate/evals/benchmark scripts)',
    weight: 20,
    run: ({ enforcement }) => {
      if (enforcement.qualityScripts.length === 0) {
        return { score: 0, evidence: [found('No validate/gauntlet/evals/benchmark scripts in package manifests.')] };
      }
      return { score: 1, evidence: enforcement.qualityScripts.slice(0, 3).map((s) => found(s)) };
    },
  },
];

export function scorePillars(findings: Findings): PillarResult[] {
  return PILLARS.map((p) => {
    const checks: CheckResult[] = CHECKS.filter((c) => c.pillar === p.id).map((c) => {
      const outcome = c.run(findings);
      const score = clamp01(outcome.score);
      return {
        id: c.id,
        title: c.title,
        weight: c.weight,
        score,
        earned: Math.round(c.weight * score * 10) / 10,
        evidence: outcome.evidence,
      };
    });
    const score = checks.reduce((s, c) => s + c.weight * c.score, 0);
    return {
      id: p.id,
      name: p.name,
      weight: p.weight,
      practices: p.practices,
      score: Math.round(score * 10) / 10,
      checks,
    };
  });
}

export function overallScore(pillars: PillarResult[]): number {
  const total = pillars.reduce((s, p) => s + (p.weight / 100) * p.score, 0);
  return Math.round(total * 10) / 10;
}

export function gradeOf(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
