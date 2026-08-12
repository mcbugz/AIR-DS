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

export interface ComponentEntry {
  name: string;
  description: string;
  racBase: string | null;
  example: string;
  props: PropEntry[];
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
  ruleCatalog: RuleCatalog;
  contributingMd: string;
  auditorTemplate: string;
  /** component export name -> sorted repo-relative story file paths that use it */
  storyFilesByExport: Map<string, string[]>;
  /** repo-relative input path -> file bytes (for hashing into the manifest) */
  rawInputs: Map<string, Buffer>;
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
