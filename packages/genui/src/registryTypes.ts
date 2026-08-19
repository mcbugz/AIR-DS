/**
 * Minimal structural types for the two registries the validator consumes.
 * These mirror the GENERATED files in `registries/` (the closed world,
 * CLAUDE.md rule 5) — only the fields @ds/genui reads are typed here.
 */

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
  racPropsNote: string | null;
  racProps: PropEntry[] | null;
  tokenPrefix: string | null;
  storyFile?: string;
  example: string;
  props: PropEntry[];
}

export interface ComponentsIndex {
  $description: string;
  package: string;
  components: ComponentEntry[];
}

export interface TokenEntry {
  name: string;
  cssVar: string;
  tier: 'semantic' | 'component';
  type: string;
  description: string;
  value: string;
}

export interface TokensIndex {
  $description: string;
  brand: string;
  count: number;
  tokens: TokenEntry[];
}

/** The pair of registries every genui check is driven by. */
export interface GenUIRegistries {
  components: ComponentsIndex;
  tokens: TokensIndex;
}
