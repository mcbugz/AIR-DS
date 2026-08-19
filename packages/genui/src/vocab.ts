/**
 * The layout and text vocabularies of the wire format.
 *
 * The layout vocabulary is DERIVED from tokens-index.json at runtime — the
 * legal `gap` values are exactly the suffixes of the `--ds-space-gap-*`
 * tokens the brand ships (plus `none`), and `inset` likewise from
 * `--ds-space-inset-*`. A brand that renames or extends its spacing scale
 * changes the document vocabulary with zero code changes here.
 */

import type { TokensIndex } from './registryTypes.js';

export const LAYOUT_KINDS = ['stack', 'row', 'grid'] as const;
export const ALIGN_VALUES = ['start', 'center', 'end', 'stretch'] as const;
export const GRID_COLUMNS = [2, 3, 4] as const;

export interface LayoutVocabulary {
  /** Legal `gap` values: `none` + suffixes of `--ds-space-gap-*`. */
  gap: string[];
  /** Legal `inset` values: `none` + suffixes of `--ds-space-inset-*`. */
  inset: string[];
  align: readonly string[];
  columns: readonly number[];
}

function suffixesOf(tokens: TokensIndex, prefix: string): string[] {
  return tokens.tokens
    .filter((t) => t.cssVar.startsWith(prefix))
    .map((t) => t.cssVar.slice(prefix.length))
    .sort();
}

export function deriveLayoutVocabulary(tokens: TokensIndex): LayoutVocabulary {
  const gap = suffixesOf(tokens, '--ds-space-gap-');
  const inset = suffixesOf(tokens, '--ds-space-inset-');
  if (gap.length === 0 || inset.length === 0) {
    // Fail closed: without the token families the layout contract has no
    // vocabulary, and silently accepting anything would be an open world.
    throw new Error(
      'genui: tokens-index.json defines no --ds-space-gap-* / --ds-space-inset-* tokens; the layout vocabulary cannot be derived.',
    );
  }
  return {
    gap: ['none', ...gap],
    inset: ['none', ...inset],
    align: ALIGN_VALUES,
    columns: GRID_COLUMNS,
  };
}

/* ------------------------------------------------------------ text roles -- */

export interface TextRoleSpec {
  /** Semantic HTML element the role renders as. */
  tag: 'h2' | 'h3' | 'p';
  /** `--ds-*` tokens the role consumes (also asserted against tokens-index). */
  tokens: {
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    color?: string;
  };
}

/**
 * Text roles map to semantic HTML + text tokens (NR-002: typography
 * components do not exist; documents carry roles instead). Every token
 * referenced here must exist in tokens-index.json — a parity test pins it.
 */
export const TEXT_ROLES: Record<string, TextRoleSpec> = {
  heading2: {
    tag: 'h2',
    tokens: {
      fontSize: '--ds-text-size-xl',
      fontWeight: '--ds-text-weight-semibold',
      lineHeight: '--ds-text-leading-tight',
    },
  },
  heading3: {
    tag: 'h3',
    tokens: {
      fontSize: '--ds-text-size-lg',
      fontWeight: '--ds-text-weight-semibold',
      lineHeight: '--ds-text-leading-tight',
    },
  },
  body: {
    tag: 'p',
    tokens: {
      fontSize: '--ds-text-size-md',
      fontWeight: '--ds-text-weight-regular',
      lineHeight: '--ds-text-leading-normal',
    },
  },
  caption: {
    tag: 'p',
    tokens: {
      fontSize: '--ds-text-size-sm',
      fontWeight: '--ds-text-weight-regular',
      lineHeight: '--ds-text-leading-normal',
      color: '--ds-color-text-secondary',
    },
  },
};

export const TEXT_ROLE_NAMES = Object.keys(TEXT_ROLES);

/** Tokens consumed by the screen-title heading (h1) in the renderer. */
export const SCREEN_TITLE_TOKENS = {
  fontSize: '--ds-text-size-2xl',
  fontWeight: '--ds-text-weight-bold',
  lineHeight: '--ds-text-leading-tight',
} as const;
