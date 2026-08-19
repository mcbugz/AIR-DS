/** Shared shapes for the retrofit pipeline. Registry output shapes mirror
 *  the canonical `registries/*.json` contracts EXACTLY (additive `provenance`
 *  fields only) so @ds/context and @ds/mcp consume them unchanged. */

export type AdapterId = 'css-custom-properties' | 'tailwind' | 'dtcg';

export interface Provenance {
  adapter: AdapterId;
  /** Path relative to the scanned repo root. */
  source: string;
  /** 1-based line of the source declaration (best-effort for tailwind/dtcg). */
  line: number;
  /** Original spelling at the source (`--Btn_primary_bg`, `theme.colors.brand.600`, `color.brand`). */
  declaredAs: string;
  /** true when the cssVar is a PROPOSED mapping (tailwind/dtcg) — it does not exist in shipped CSS yet. */
  proposed?: boolean;
  /** false when a var() reference chain could not be fully resolved. */
  resolved?: boolean;
  /** Number of scoped re-declarations seen elsewhere (themes, media blocks). */
  redeclarations?: number;
}

/** tokens-index.json entry — canonical shape + provenance. */
export interface RetroToken {
  name: string;
  cssVar: string;
  tier: 'semantic';
  type: string;
  description: string;
  value: string | number;
  provenance: Provenance;
}

export interface TokensIndexOut {
  $description: string;
  brand: string;
  count: number;
  tokens: RetroToken[];
}

/** components-index.json entry — canonical shape (storyFile omitted when undetectable). */
export interface PropEntryOut {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  description: string;
}

export interface ComponentEntryOut {
  name: string;
  description: string;
  racBase: null;
  racPropsNote: null;
  racProps: null;
  tokenPrefix: null;
  storyFile?: string;
  example: string;
  props: PropEntryOut[];
}

export interface ComponentsIndexOut {
  $description: string;
  package: string;
  components: ComponentEntryOut[];
}

/** contrast-report.json shapes — canonical. */
export interface ContrastPairOut {
  id: string;
  foreground: string;
  background: string;
  foregroundValue: string;
  backgroundValue: string;
  ratio: number;
  required: number;
  pass: boolean;
  resolvesTo: { foreground: string[]; background: string[] };
}

export interface UnauditedEntryOut {
  name: string;
  cssVar: string;
  reason: string;
}

export interface ContrastReportOut {
  $description: string;
  standard: string;
  threshold: number;
  brand: string;
  failures: number;
  pairs: ContrastPairOut[];
  aliasIndex: Record<string, string[]>;
  unaudited: UnauditedEntryOut[];
}

/** A raw CSS custom-property declaration found in a stylesheet. */
export interface CssDecl {
  prop: string;
  value: string;
  selector: string;
  line: number;
  source: string;
}

/** A hard-coded literal (hex color etc.) found in non-token CSS declarations. */
export interface HardcodedFinding {
  source: string;
  line: number;
  property: string;
  literal: string;
}

/** Tailwind mapping-table row (also emitted as tailwind-mapping.json). */
export interface TailwindMapping {
  themePath: string;
  proposedVar: string;
  value: string;
  /** cssVar of an existing CSS custom property with the same resolved value, if any. */
  matchesExistingVar: string | null;
}

export interface AdapterDetection {
  css: string[];
  tailwind: string | null;
  dtcg: string[];
  componentEntry: string | null;
}

export interface ComponentConfidence {
  name: string;
  file: string;
  props: number;
  typing: 'typed' | 'untyped';
}

export interface RetrofitResult {
  repoRoot: string;
  outDir: string;
  brandName: string;
  detection: AdapterDetection;
  detected: boolean;
  tokensIndex: TokensIndexOut | null;
  componentsIndex: ComponentsIndexOut | null;
  contrastReport: ContrastReportOut | null;
  tailwindMappings: TailwindMapping[];
  hardcoded: HardcodedFinding[];
  componentConfidence: ComponentConfidence[];
  unresolvedVars: string[];
  skippedTailwindPaths: string[];
  contextStatus: 'emitted' | 'skipped' | 'failed';
  contextError: string | null;
  contextFiles: number;
  warnings: string[];
}
