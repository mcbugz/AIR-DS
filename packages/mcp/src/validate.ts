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
// The shared allowed-literal ruleset — a GENERATED verbatim copy of
// tooling/validate/src/rules/allowlist.ts (single source of truth), synced by
// scripts/sync-allowlist.mjs and pinned by tests/allowlist-parity.test.ts, so
// this validator and the gauntlet return identical literal verdicts.
import {
  extractJsxStyleObjects,
  scanCssValueLiterals,
  scanJsxStyleValue,
} from './generated/allowlist.js';

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

/** RAC runtime-provided variable — legal even though it is not a --ds- token. */
export const KNOWN_RUNTIME_VARS = new Set(['--trigger-width']);

/** Class names that RAC positions with inline z-index (NR-012 subjects). */
const RAC_OVERLAY_CLASS = /\.(popover|tooltip|overlay|dropdown|menu|listbox|modal|dialog)\b/;

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

      /* (d) raw literals — the SHARED allowed-literal ruleset (same verdicts
         as the gauntlet's G2; percentages/angles/unitless numbers allowed,
         hex / color functions / named colors / non-zero unit literals and
         bare numbers in font-weight|line-height|z-index flagged). */
      for (const lv of scanCssValueLiterals(decl.property, decl.value)) {
        if (lv.isColor) {
          pushNr(
            'NR-003',
            `'${decl.property}: ${decl.value}' hard-codes a color (${lv.literal}).`,
            'Raw color literals are not allowed in component CSS.',
            'intent tokens: var(--ds-color-*)',
          );
        } else {
          push(
            'raw-value',
            `'${decl.property}: ${decl.value}' hard-codes '${lv.literal}'. Every color, font, size, space, radius, shadow, and motion value must be var(--ds-*) (CLAUDE.md rule 2). Allowed literals: 0, percentages, auto, none, currentColor, transparent, angles, and layout keywords.`,
            `Replace '${lv.literal}' with the appropriate --ds-* token (see list_tokens).`,
          );
        }
      }
    }

    /* NR-012 — class z-index does not reach RAC-positioned overlays */
    const blockRe = /([^{}]+)\{([^{}]*)\}/g;
    let bm: RegExpExecArray | null;
    while ((bm = blockRe.exec(css)) !== null) {
      if (RAC_OVERLAY_CLASS.test(bm[1] as string) && /(^|[\s;{])z-index\s*:/.test(bm[2] as string)) {
        pushNr(
          'NR-012',
          `'${(bm[1] as string).trim()}' sets z-index in a class rule; react-aria positions this element with an inline z-index that wins.`,
          'Class z-index does not reach RAC-positioned overlays.',
          "pass style={{ zIndex: 'var(--ds-z-*)' }} on the RAC overlay element",
        );
      }
    }

    /* NR-013 — motion must be gated; movement always */
    if (!/@media[^{]*prefers-reduced-motion\s*:\s*reduce/.test(css)) {
      const hasKeyframes = /@(-\w+-)?keyframes\b/.test(css);
      const movesOnTransition = extractDeclarations(css).some(
        (d) =>
          /^(transition|transition-property|animation|animation-name)$/.test(d.property) &&
          /(^|[\s,])(transform|translate|rotate|scale|all)([\s,]|$)/.test(stripVarExpressions(d.value)),
      );
      if (hasKeyframes || movesOnTransition) {
        pushNr(
          'NR-013',
          hasKeyframes
            ? '@keyframes with no reduced-motion gate.'
            : 'transform/translate/rotate/scale transition with no reduced-motion gate.',
          'Motion must be gated; movement always.',
          '@media (prefers-reduced-motion: reduce) { animation: none; transition: none } — color-only transitions are exempt',
        );
      }
    }

    /* NR-011 — CSS-module classes are a closed world too */
    const definedClasses = new Set<string>();
    const clsDef = /\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g;
    let cd: RegExpExecArray | null;
    while ((cd = clsDef.exec(selectorText)) !== null) definedClasses.add(cd[1] as string);
    if (definedClasses.size > 0) {
      const styleRef = /\bstyles\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*(['"])([^'"]+)\2\s*\])/g;
      let sr: RegExpExecArray | null;
      const missing = new Set<string>();
      while ((sr = styleRef.exec(code)) !== null) {
        const cls = (sr[1] ?? sr[3]) as string | undefined;
        if (cls && !definedClasses.has(cls)) missing.add(cls);
      }
      for (const cls of missing) {
        pushNr(
          'NR-011',
          `styles.${cls} — no class '.${cls}' exists in the provided stylesheet; the className silently vanishes at runtime.`,
          'CSS-module classes are a closed world too.',
          'reference only classes that exist in the component’s own .module.css; add the rule before the reference',
        );
      }
    }

    /* NR-010 (kebab form) — kebab-casing a registered CamelCase component name */
    for (const cls of definedClasses) {
      if (!cls.includes('-')) continue;
      const joined = cls.split('-').join('');
      const pascalMatch = registry.components.components.find(
        (c) => c.name.toLowerCase() === joined && c.name.toLowerCase() !== cls,
      );
      if (pascalMatch) {
        pushNr(
          'NR-010',
          `Base class '.${cls}' kebab-cases ${pascalMatch.name}; the canon is '.${joined}' — the name lowercased literally, no separators.`,
          'The base class is the lowercased component name.',
          `.${joined} — the lowercased component name, no separators`,
        );
      }
    }
  }

  /* B1 — JSX inline-style literal discipline (shared ruleset). String/number
     literals for COLOR / DIMENSION style props are violations unless
     var(--ds-*), 0, a percentage, auto/none/currentColor, or a pure runtime
     expression. Sanctioned runtime-geometry pattern: `${percentage}%`. */
  for (const obj of extractJsxStyleObjects(code)) {
    for (const entry of obj.entries) {
      for (const lv of scanJsxStyleValue(entry.prop, entry.valueText)) {
        if (lv.isColor) {
          pushNr(
            'NR-003',
            `style={{ ${entry.prop}: … }} hard-codes ${lv.literal}; inline styles follow the same token rule.`,
            'Raw color literals are not allowed in component CSS.',
            'intent tokens: var(--ds-color-*)',
          );
        } else {
          push(
            'raw-value',
            `style={{ ${entry.prop}: … }} hard-codes '${lv.literal}'. Inline-style dimensions must be var(--ds-*) tokens; runtime-computed geometry interpolates with no literal parts (inlineSize: \`\${percentage}%\` — the sanctioned pattern).`,
            `Replace '${lv.literal}' with a --ds-* token (see list_tokens) or a pure runtime interpolation.`,
          );
        }
      }
    }
  }

  return { valid: violations.length === 0, violations };
}
