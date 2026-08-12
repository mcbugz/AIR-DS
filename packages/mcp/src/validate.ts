/**
 * `validate_usage` — fully deterministic validation of a code (+ optional css)
 * snippet against the loaded registries and the negative-rule catalog.
 * No LLM anywhere in this path (ADR-005). Every check is a regex/set lookup
 * against the closed world loaded at startup.
 */

import type { Registry } from './registry.js';
import { nearestNames } from './registry.js';
import type { NegativeRuleCatalog } from './negativeRules.js';
import { ruleFix, ruleMessage } from './negativeRules.js';

export interface Violation {
  rule: string;
  message: string;
  fix: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}

export interface ValidateInput {
  code: string;
  css?: string;
}

/* ------------------------------------------------------------ constants -- */

/** NR-001: layout primitives intentionally not shipped. */
const LAYOUT_PRIMITIVES = new Set(['Box', 'Stack', 'Container', 'Flex', 'Grid', 'Spacer']);
/** NR-002: typography components intentionally not shipped. */
const TYPOGRAPHY_PRIMITIVES = new Set(['Heading', 'Text']);

/** Properties where --ds-space-* is illegal (NR-006): box dimensions, not gaps. */
const SIZE_PROPERTIES = new Set([
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'inline-size',
  'block-size',
  'min-inline-size',
  'min-block-size',
  'max-inline-size',
  'max-block-size',
  'flex-basis',
]);

/** CLAUDE.md rule 2 allowlist, plus known-legitimate extras. */
const ALLOWED_VALUE_KEYWORDS = new Set(['0', '100%', 'auto', 'none', 'currentcolor', 'transparent']);
/** RAC runtime-provided variable — legal even though it is not a --ds- token. */
export const KNOWN_RUNTIME_VARS = new Set(['--trigger-width']);

const NAMED_CSS_COLORS = new Set([
  'white', 'black', 'red', 'blue', 'green', 'gray', 'grey', 'orange',
  'yellow', 'purple', 'pink', 'teal', 'cyan', 'magenta', 'silver', 'maroon',
  'navy', 'olive', 'lime', 'aqua', 'fuchsia', 'crimson', 'gold', 'indigo',
  'ivory', 'khaki', 'lavender', 'salmon', 'tomato', 'turquoise', 'violet',
  'wheat', 'whitesmoke', 'rebeccapurple',
]);

const COLOR_PROPERTY = /^(color|fill|stroke|caret-color|accent-color|(background|border|outline|text-decoration|column-rule)(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?)$/;

/** Unambiguous Tailwind-style utility classes (NR-004). */
const TAILWIND_CLASS = new RegExp(
  [
    '^-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|w|h|size|space-x|space-y)-\\d+(\\.\\d+)?$',
    '^rounded(-(none|sm|md|lg|xl|2xl|3xl|full))?$',
    '^(text|bg|border|ring|fill|stroke|divide|placeholder|from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}$',
    '^text-(xs|sm|base|lg|xl|\\dxl)$',
    '^font-(thin|light|normal|medium|semibold|bold|black)$',
    '^(items|justify|content|self)-(start|end|center|between|around|stretch|baseline)$',
    '^shadow(-(sm|md|lg|xl|2xl|inner))?$',
  ].join('|'),
);

/* -------------------------------------------------------------- helpers -- */

function stripVarExpressions(value: string): string {
  // remove var(...) including simple nesting so fallbacks are not re-flagged
  let prev = '';
  let out = value;
  while (out !== prev) {
    prev = out;
    out = out.replace(/var\([^()]*\)/g, ' ');
  }
  return out;
}

function extractDsVars(text: string): string[] {
  const vars: string[] = [];
  const re = /var\(\s*(--ds-[a-zA-Z0-9_-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) vars.push(m[1] as string);
  return vars;
}

interface Declaration {
  property: string;
  value: string;
}

function extractDeclarations(css: string): Declaration[] {
  const decls: Declaration[] = [];
  const re = /(?:^|[{;\n])\s*(-{0,2}[a-zA-Z][a-zA-Z0-9-]*)\s*:\s*([^;{}]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    decls.push({ property: (m[1] as string).toLowerCase(), value: (m[2] as string).trim() });
  }
  return decls;
}

/** selectors = everything before each `{`, or the whole text when it has no braces */
function extractSelectors(css: string): string[] {
  const selectors: string[] = [];
  const re = /(^|[}])([^{}]+)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) selectors.push((m[2] as string).trim());
  return selectors;
}

/* ----------------------------------------------------------- the checks -- */

export function validateUsage(
  registry: Registry,
  catalog: NegativeRuleCatalog,
  input: ValidateInput,
): ValidationResult {
  const violations: Violation[] = [];
  const code = input.code ?? '';
  const css = input.css ?? '';
  const componentNames = registry.components.components.map((c) => c.name);

  const push = (rule: string, message: string, fix: string): void => {
    if (!violations.some((v) => v.rule === rule && v.message === message)) {
      violations.push({ rule, message, fix });
    }
  };
  const pushNr = (id: string, detail: string, fallbackMsg: string, fallbackFix: string): void => {
    push(id, `${detail} ${ruleMessage(catalog, id, fallbackMsg)}`, ruleFix(catalog, id, fallbackFix));
  };

  /* (c) NR-005 — deep-path imports */
  const deepImport = /from\s+['"](@ds\/react\/[^'"]+)['"]/g;
  let dm: RegExpExecArray | null;
  while ((dm = deepImport.exec(code)) !== null) {
    pushNr(
      'NR-005',
      `Deep-path import '${dm[1]}' is not a public entry point.`,
      'Do not import from deep paths.',
      "import { <Component> } from '@ds/react' — the only public entry point",
    );
  }

  /* (b) imports from '@ds/react' must exist in the components registry */
  const namedImport = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]@ds\/react['"]/g;
  let im: RegExpExecArray | null;
  const importedNames: string[] = [];
  while ((im = namedImport.exec(code)) !== null) {
    for (const raw of (im[1] as string).split(',')) {
      const name = raw.replace(/\btype\b/g, '').split(/\bas\b/)[0]?.trim() ?? '';
      if (name) importedNames.push(name);
    }
  }
  /* JSX usage counts too — hallucinated primitives are often rendered without an import */
  const jsxNames = new Set<string>();
  const jsxTag = /<([A-Z][A-Za-z0-9]*)\b/g;
  let jm: RegExpExecArray | null;
  while ((jm = jsxTag.exec(code)) !== null) jsxNames.add(jm[1] as string);

  const referenced = new Set([...importedNames, ...jsxNames]);
  for (const name of referenced) {
    if (LAYOUT_PRIMITIVES.has(name)) {
      pushNr(
        'NR-001',
        `<${name}> is not part of this design system.`,
        'Layout primitives do not exist.',
        'plain elements + CSS with space tokens: display:flex; gap: var(--ds-space-gap-md)',
      );
    } else if (TYPOGRAPHY_PRIMITIVES.has(name)) {
      pushNr(
        'NR-002',
        `<${name}> is not part of this design system.`,
        'Typography components do not exist.',
        'semantic HTML (<h2>, <p>) with var(--ds-text-size-*) / var(--ds-text-weight-*)',
      );
    } else if (importedNames.includes(name) && !registry.componentByName.has(name)) {
      const nearest = nearestNames(name, componentNames);
      push(
        'unknown-component',
        `'${name}' is not in the component registry (closed world: a component not in the registry does not exist). Did you mean: ${nearest.join(', ')}? Valid components: ${componentNames.join(', ')}.`,
        `Import one of the registered components: ${componentNames.join(', ')}.`,
      );
    }
  }

  /* NR-004 — Tailwind/utility classes in className */
  const classAttr = /className\s*=\s*(?:\{\s*)?["'`]([^"'`]+)["'`]/g;
  let cm: RegExpExecArray | null;
  while ((cm = classAttr.exec(code)) !== null) {
    const offending = (cm[1] as string).split(/\s+/).filter((cls) => TAILWIND_CLASS.test(cls));
    if (offending.length > 0) {
      pushNr(
        'NR-004',
        `Utility classes [${offending.join(', ')}] are not part of this system.`,
        'Tailwind/utility classes are not part of this system.',
        'CSS Module class consuming --ds-* tokens',
      );
    }
  }

  /* (a) fabrication check — every var(--ds-*) must exist in tokens-index */
  const allVars = [...extractDsVars(code), ...extractDsVars(css)];
  const tokenNames = registry.tokens.tokens.map((t) => t.cssVar);
  for (const v of new Set(allVars)) {
    if (registry.tokenByVar.has(v)) continue;
    if (KNOWN_RUNTIME_VARS.has(v)) continue;
    if (/^--ds-color-text-on-[a-z-]+$/.test(v) || /^--ds-color-status-[a-z]+-on$/.test(v)) {
      /* NR-007 — extrapolated on-<status> text token */
      pushNr(
        'NR-007',
        `${v} does not exist; 'on-accent' exists, but 'on-<status>' names are fabricated.`,
        'There is no on-status text token.',
        'var(--ds-color-text-inverse) on solid status fills — only pairs present in contrast-report.json',
      );
    } else if (/^--ds-palette-/.test(v) || /^--ds-[a-z]+-\d{2,4}$/.test(v)) {
      /* NR-003 — raw color scale / palette name */
      pushNr(
        'NR-003',
        `${v} is a raw palette token; palette scales are not public.`,
        'Raw color scales are not public tokens.',
        'intent tokens: var(--ds-color-accent-default), var(--ds-color-text-primary)',
      );
    } else {
      const nearest = nearestNames(v, tokenNames);
      push(
        'unknown-token',
        `${v} is not in the token registry (closed world: a token not in the registry is provably fabricated). Did you mean: ${nearest.join(', ')}?`,
        `Use a registered --ds-* token; nearest matches: ${nearest.join(', ')}.`,
      );
    }
  }

  if (css.length > 0) {
    /* NR-009 — pseudo-class state selectors */
    const pseudo = /:(hover|active|focus-visible|focus-within|focus|disabled|pressed|checked)\b/g;
    let pm: RegExpExecArray | null;
    const seenPseudo = new Set<string>();
    while ((pm = pseudo.exec(css)) !== null) seenPseudo.add(pm[1] as string);
    for (const p of seenPseudo) {
      pushNr(
        'NR-009',
        `Pseudo-class ':${p}' — react-aria-components exposes interaction state as data attributes.`,
        'State selectors are RAC data attributes, not pseudo-classes.',
        '[data-hovered], [data-focus-visible], [data-disabled]',
      );
    }

    /* NR-010 — generic base class names */
    const selectors = extractSelectors(css);
    const selectorText = selectors.length > 0 ? selectors.join(' ') : css;
    const genericBase = /(^|[\s,>+~(])\.(root|wrapper|container)\b/g;
    let gm: RegExpExecArray | null;
    const seenGeneric = new Set<string>();
    while ((gm = genericBase.exec(selectorText)) !== null) seenGeneric.add(gm[2] as string);
    for (const g of seenGeneric) {
      pushNr(
        'NR-010',
        `Base class '.${g}' is not the canon.`,
        'The base class is the lowercased component name.',
        '.button, .card, .alert — the lowercased component name',
      );
    }

    /* NR-008 — cross-component hook borrowing.
       Subject = class selectors / JSX tags matching a component-token prefix. */
    const subjects = new Set<string>();
    const classSel = /\.([a-z][a-z0-9]*)\b/g;
    let sm: RegExpExecArray | null;
    while ((sm = classSel.exec(selectorText)) !== null) {
      const cls = sm[1] as string;
      if (registry.componentTokenPrefixes.has(cls)) subjects.add(cls);
    }
    for (const name of jsxNames) {
      const lower = name.toLowerCase();
      if (registry.componentTokenPrefixes.has(lower)) subjects.add(lower);
    }
    if (subjects.size > 0) {
      for (const v of new Set(extractDsVars(css))) {
        const m = /^--ds-([a-z0-9]+)-/.exec(v);
        const prefix = m?.[1];
        if (prefix && registry.componentTokenPrefixes.has(prefix) && !subjects.has(prefix)) {
          pushNr(
            'NR-008',
            `${v} is a '${prefix}' component hook used inside '${[...subjects].join('/')}' styles; component-tier tokens belong to their component only.`,
            'Component-tier tokens belong to their component only.',
            'use the component’s own --ds-<component>-* hooks or semantic-tier tokens',
          );
        }
      }
    }

    /* declaration-level checks */
    for (const decl of extractDeclarations(css)) {
      /* NR-006 — space tokens are not sizes */
      if (SIZE_PROPERTIES.has(decl.property) && /--ds-space-/.test(decl.value)) {
        pushNr(
          'NR-006',
          `'${decl.property}: ${decl.value}' uses a space token as a box dimension.`,
          'Space tokens are not sizes.',
          'size tokens for boxes: var(--ds-size-control-md), var(--ds-size-icon-md); space tokens only in margin/padding/gap/inset',
        );
      }

      /* (d) raw literals per CLAUDE.md rule 2 allowlist */
      const residue = stripVarExpressions(decl.value);
      if (/#[0-9a-fA-F]{3,8}\b/.test(residue) || /\b(rgba?|hsla?|oklch|oklab|lab|lch|color)\(/.test(residue)) {
        pushNr(
          'NR-003',
          `'${decl.property}: ${decl.value}' hard-codes a color.`,
          'Raw color literals are not allowed in component CSS.',
          'intent tokens: var(--ds-color-*)',
        );
        continue;
      }
      for (const word of residue.split(/[\s,/()]+/).filter(Boolean)) {
        const lower = word.toLowerCase();
        if (ALLOWED_VALUE_KEYWORDS.has(lower)) continue;
        if (/^-?\d*\.?\d+(deg|turn|rad|grad|fr)$/.test(lower)) continue; // angles & grid fractions
        if (/^-?0+(px|rem|em|pt|s|ms|%)?$/.test(lower)) continue; // zero in any unit
        if (/^-?\d*\.?\d+(px|rem|em|pt|pc|cm|mm|in|q|vh|vw|vmin|vmax|ch|ex|cap|ic|lh|rlh|s|ms|%)$/.test(lower)) {
          push(
            'raw-value',
            `'${decl.property}: ${decl.value}' hard-codes '${word}'. Every color, font, size, space, radius, shadow, and motion value must be var(--ds-*) (CLAUDE.md rule 2). Allowed literals: 0, 100%, auto, none, currentColor, transparent, angles, and layout keywords.`,
            `Replace '${word}' with the appropriate --ds-* token (see list_tokens).`,
          );
        } else if (COLOR_PROPERTY.test(decl.property) && NAMED_CSS_COLORS.has(lower)) {
          pushNr(
            'NR-003',
            `'${decl.property}: ${decl.value}' hard-codes the named color '${word}'.`,
            'Raw color literals are not allowed in component CSS.',
            'intent tokens: var(--ds-color-*)',
          );
        }
      }
    }
  }

  return { valid: violations.length === 0, violations };
}
