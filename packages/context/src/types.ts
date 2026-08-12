export interface TokenEntry {
  name: string;
  cssVar: string;
  tier: 'semantic' | 'component';
  type: string;
  description: string;
  /** Brand-resolved value. Strings for most types; numbers for fontWeight / number tokens. */
  value: string | number;
}

export interface TokensIndex {
  $description: string;
  brand: string;
  count: number;
  tokens: TokenEntry[];
}

export interface PropEntry {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  description: string;
}

/**
 * Inherited-but-legal RAC prop (optional registry enrichment). The registry
 * may emit plain names ("value") or objects with types; loadInputs normalizes
 * both spellings to this shape.
 */
export interface RacPropEntry {
  name: string;
  type: string | null;
}

export interface ComponentEntry {
  name: string;
  description: string;
  racBase: string | null;
  example: string;
  props: PropEntry[];
  /** OPTIONAL enrichment: inherited-but-legal props from the racBase. */
  racProps?: (string | { name: string; type?: string })[];
  /** OPTIONAL enrichment: registry prose accompanying racProps. */
  racPropsNote?: string;
  /** OPTIONAL enrichment: component-token prefix ("button", "field") or null. */
  tokenPrefix?: string | null;
  /** OPTIONAL enrichment: repo-relative path of the component's story file. */
  storyFile?: string;
}

export interface ComponentsIndex {
  $description: string;
  package: string;
  components: ComponentEntry[];
}

export interface ContrastPair {
  foreground: string;
  background: string;
  foregroundValue: string;
  backgroundValue: string;
  ratio: number;
  required: number;
  pass: boolean;
}

export interface ContrastReport {
  standard: string;
  threshold: number;
  brand: string;
  failures: number;
  pairs: ContrastPair[];
}

/** OPTIONAL registry: registries/icons-metadata.json (tolerant shape). */
export interface IconEntry {
  name: string;
  /** Named export (e.g. "ArrowDownIcon") when the registry declares one. */
  export?: string;
  description?: string;
  keywords?: string[];
  category?: string;
  sizes?: string[];
}

export interface IconsMetadata {
  $description?: string;
  icons: IconEntry[];
}

/** OPTIONAL registry: registries/patterns-index.json (tolerant shape — `name` or `id`). */
export interface PatternEntry {
  name: string;
  title?: string;
  description?: string;
  components?: string[];
  storyFile?: string;
  docFile?: string;
  keywords?: string[];
}

export interface PatternsIndex {
  $description?: string;
  patterns: PatternEntry[];
}

export interface NegativeRule {
  id: string; // "NR-001"
  title: string;
  wrong: string;
  right: string;
  why: string | null;
}

export interface RuleCatalog {
  preamble: string;
  rules: NegativeRule[];
}

export interface CompilerInputs {
  brand: string;
  tokensIndex: TokensIndex;
  componentsIndex: ComponentsIndex;
  contrastReport: ContrastReport;
  /** null when registries/icons-metadata.json is absent (older registry set). */
  iconsMetadata: IconsMetadata | null;
  /** null when registries/patterns-index.json is absent (older registry set). */
  patternsIndex: PatternsIndex | null;
  ruleCatalog: RuleCatalog;
  contributingMd: string;
  auditorTemplate: string;
  /** component export name -> sorted repo-relative story file paths that use it */
  storyFilesByExport: Map<string, string[]>;
  /** LOGICAL input path (stable, repo-relative shape) -> file bytes (for hashing into the manifest) */
  rawInputs: Map<string, Buffer>;
  /**
   * LOGICAL input path -> actual path the bytes were read from (repo-relative
   * when inside the repo, absolute otherwise). Differs from the logical path
   * only when --registries-dir / --brand-path point outside the defaults.
   */
  inputPaths: Map<string, string>;
  warnings: string[];
}

export interface EmittedFile {
  path: string; // relative to dist/<brand>/, posix
  sha256: string;
  bytes: number;
  estTokens: number;
}

export interface Manifest {
  $description: string;
  brand: string;
  generatedAt: string;
  compiler: string;
  sourceHash: string;
  budgets: { indexMaxTokens: number; sliceMaxTokens: number };
  inputs: { path: string; sha256: string }[];
  files: EmittedFile[];
  warnings: string[];
}
