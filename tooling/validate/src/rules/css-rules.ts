import { parseCss } from '../css-parser.ts';
import type { NrId, RegistryContext, Violation } from '../types.ts';

/**
 * CSS rules: G1 (token closed-world), G2 (literal discipline), G3
 * (property<->category conformance), G6 (cross-hook borrowing / NR-008),
 * G8 (state selectors / NR-009), NR-010 (base-class canon).
 *
 * Documented relaxations vs the raw rule statements (see package docs):
 *  - Percentage literals are allowed everywhere (proportions, not brand
 *    values: 100% widths, 50% color-mix, keyframe offsets).
 *  - Unitless numbers are allowed except in font-weight/line-height/z-index
 *    (flex: 1, opacity: 0.5, calc multipliers are legitimate).
 *  - G3 size-token direction: --ds-size-* is allowed in dimension props,
 *    flex-basis, translate/transform, and anywhere inside calc() — the shipped
 *    corpus deliberately derives paddings/offsets from size tokens with calc()
 *    (Switch, Dialog). Direct size tokens in spacing props are still flagged.
 */

/** RAC runtime-provided custom properties that are legal to consume. */
const RUNTIME_VARS = new Set(['--trigger-width']);

/** Component hook families that may share a namespace (documented in NR-008). */
const SHARED_NAMESPACES: Record<string, string[]> = {
  IconButton: ['iconbutton', 'button'],
  TextField: ['textfield', 'field'],
  TextArea: ['textarea', 'field'],
  Select: ['select', 'field'],
};

const STATE_PSEUDO = /(?<!:):(hover|active|focus(?:-visible|-within)?|disabled)(?![\w-])/;

const SPACE_PROP =
  /^(margin|padding|gap$|row-gap$|column-gap$|inset|top$|right$|bottom$|left$|scroll-margin|scroll-padding)/;
const DIMENSION_PROP = /^((min|max)-)?(inline-size|block-size|width|height)$|^flex-basis$/;
const RADIUS_PROP = /^border(-(top|bottom|start|end)(-(left|right|start|end))?)?-radius$/;
const MOTION_PROP = /^(transition|animation)/;
const TRANSFORM_PROP = /^(translate|transform|scale|rotate)$/;

const FLAGGED_UNITS = /(-?\d*\.?\d+)(px|rem|em|pt|cm|mm|in|pc|ch|ex|vw|vh|vmin|vmax|ms|s)\b/gi;
const UNITLESS_TOKEN_PROPS = new Set(['font-weight', 'line-height', 'z-index']);
const STRING_OK_PROPS = new Set(['content', 'grid-template-areas', 'grid-template']);
const FONT_KEYWORDS = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

export interface CssFileInfo {
  /** PascalCase component dir name when the file lives under components/<Name>/. */
  componentName: string | null;
}

export function cssFileInfo(path: string): CssFileInfo {
  const m = /components\/([A-Za-z0-9]+)\/[^/]+\.module\.css$/.exec(path.replace(/\\/g, '/'));
  return { componentName: m?.[1] ?? null };
}

function allowedSegments(componentName: string): Set<string> {
  const shared = SHARED_NAMESPACES[componentName];
  return new Set(shared ?? [componentName.toLowerCase()]);
}

/**
 * Is hook namespace `seg` legal inside the CSS of component dir `componentName`?
 * Own namespace and documented shared families, plus the subcomponent relation:
 * subcomponents live in their parent's directory (Radio in RadioGroup/, Tab in
 * Tabs/, CardHeader in Card/), so a prefix relation between dir name and
 * segment is treated as the same component family.
 */
function segmentAllowed(componentName: string, seg: string): boolean {
  const own = allowedSegments(componentName);
  if (own.has(seg)) return true;
  const lowerDir = componentName.toLowerCase();
  return lowerDir.startsWith(seg) || seg.startsWith(lowerDir);
}

function nrForFabricatedToken(name: string): NrId | null {
  // NR-003: raw color scales / palette names (--ds-blue-500, --ds-palette-primary-600).
  if (/^--ds-(palette-)?[a-z]+-\d{2,3}$/.test(name) || name.startsWith('--ds-palette-')) {
    return 'NR-003';
  }
  // NR-007: extrapolated on-<status> text tokens (--ds-color-text-on-danger, --ds-color-status-danger-on).
  if (/^--ds-color-/.test(name) && /(-on-|-on$)/.test(name)) return 'NR-007';
  return null;
}

/** Extract every custom-property name referenced through var() in a value. */
function varRefs(value: string): string[] {
  const out: string[] = [];
  const re = /var\(\s*(--[\w-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) out.push(m[1] as string);
  return out;
}

/** Mask var(...) expressions (balanced parens) so literal scanning skips token refs. */
function maskVarCalls(value: string): string {
  let out = '';
  let i = 0;
  while (i < value.length) {
    if (value.startsWith('var(', i)) {
      let depth = 0;
      let j = i + 3;
      do {
        const c = value[j];
        if (c === '(') depth++;
        else if (c === ')') depth--;
        j++;
      } while (j < value.length && depth > 0);
      out += '§';
      i = j;
    } else {
      out += value[i];
      i++;
    }
  }
  return out;
}

export function checkCssFile(
  file: string,
  content: string,
  ctx: RegistryContext,
): Violation[] {
  const violations: Violation[] = [];
  const { componentName } = cssFileInfo(file);
  const own = componentName ? allowedSegments(componentName) : null;
  const sheet = parseCss(content);

  for (const rule of sheet.rules) {
    // G8 / NR-009: pseudo-class interaction states.
    if (!rule.inKeyframes && STATE_PSEUDO.test(rule.selector)) {
      const state = STATE_PSEUDO.exec(rule.selector)?.[1] ?? 'state';
      violations.push({
        rule: 'G8',
        nr: 'NR-009',
        file,
        line: rule.line,
        message: `Selector "${rule.selector}" uses :${state} — use RAC data attributes ([data-hovered], [data-focus-visible], [data-disabled]) instead of pseudo-classes.`,
      });
    }

    // NR-010: base-class canon (component CSS only).
    if (componentName && /\.(root|wrapper|container)\b/.test(rule.selector)) {
      violations.push({
        rule: 'NR-010',
        nr: 'NR-010',
        file,
        line: rule.line,
        message: `Selector "${rule.selector}" uses a generic base class — the base class is the lowercased component name (".${componentName.toLowerCase()}"), never .root/.wrapper/.container.`,
      });
    }

    for (const decl of rule.decls) {
      const { prop, value, line } = decl;

      // Custom-property declarations do not belong in component CSS —
      // tokens are defined by @ds/tokens, consumed here.
      if (prop.startsWith('--')) {
        violations.push({
          rule: 'G2',
          nr: null,
          file,
          line,
          message: `Declaration of custom property "${prop}" in component CSS — tokens are defined in @ds/tokens, component CSS only consumes var(--ds-*).`,
        });
        continue;
      }

      const refs = varRefs(value);
      for (const name of refs) {
        if (name.startsWith('--ds-')) {
          // G1: token closed-world.
          if (!ctx.tokenVars.has(name)) {
            violations.push({
              rule: 'G1',
              nr: nrForFabricatedToken(name),
              file,
              line,
              message: `Token "${name}" is not in registries/tokens-index.json — it does not exist (closed world).`,
            });
          }

          // G6 / NR-008: cross-component hook borrowing (registered or not).
          const seg = /^--ds-([a-z0-9]+)-/.exec(name)?.[1];
          if (seg && ctx.componentSegments.has(seg)) {
            const legal = componentName ? segmentAllowed(componentName, seg) : false;
            if (!legal) {
              violations.push({
                rule: 'G6',
                nr: 'NR-008',
                file,
                line,
                message: componentName
                  ? `"${name}" belongs to the "${seg}" component namespace — ${componentName} may only consume ${[...(own as Set<string>)].map((s) => `--ds-${s}-*`).join(' / ')} hooks or semantic tokens (NR-008).`
                  : `"${name}" is a component-tier hook of "${seg}" — non-component CSS must use semantic-tier tokens only (NR-008).`,
              });
            }
          }

          // G3: property <-> category conformance (semantic categories).
          checkCategoryConformance(name, prop, value, file, line, violations);
        } else if (!RUNTIME_VARS.has(name)) {
          violations.push({
            rule: 'G2',
            nr: null,
            file,
            line,
            message: `Unregistered custom property "${name}" — only var(--ds-*) tokens and the RAC runtime var --trigger-width are allowed.`,
          });
        }
      }

      // G2 literal scanning over the value with var() calls masked out.
      const masked = maskVarCalls(value);

      const hex = /#[0-9a-fA-F]{3,8}\b/.exec(masked);
      if (hex) {
        violations.push({
          rule: 'G2',
          nr: 'NR-003',
          file,
          line,
          message: `Raw hex color "${hex[0]}" in "${prop}" — every color is a var(--ds-color-*) token.`,
        });
      }

      FLAGGED_UNITS.lastIndex = 0;
      let um: RegExpExecArray | null;
      while ((um = FLAGGED_UNITS.exec(masked)) !== null) {
        if (parseFloat(um[1] as string) !== 0) {
          violations.push({
            rule: 'G2',
            nr: null,
            file,
            line,
            message: `Literal "${um[0]}" in "${prop}" — dimensions come from var(--ds-*) tokens (allowed literals: 0, percentages, angles, keywords).`,
          });
        }
      }

      const str = /"[^"]*"|'[^']*'/.exec(masked);
      if (str && !STRING_OK_PROPS.has(prop)) {
        violations.push({
          rule: 'G2',
          nr: null,
          file,
          line,
          message: `String literal ${str[0]} in "${prop}" — ${prop.startsWith('font') ? 'font stacks come from var(--ds-font-family-*)' : 'string values are only allowed in content/grid-template'}.`,
        });
      }

      if ((prop === 'font-family' || prop === 'font') && !rule.inKeyframes) {
        const leftover = masked
          .replace(/["'][^"']*["']/g, '')
          .split(/[\s,/]+/)
          .filter((t) => /^[A-Za-z][\w-]*$/.test(t) && !FONT_KEYWORDS.has(t.toLowerCase()));
        if (leftover.length > 0) {
          violations.push({
            rule: 'G2',
            nr: null,
            file,
            line,
            message: `Font family literal "${leftover[0]}" in "${prop}" — use var(--ds-font-family-sans) / var(--ds-font-family-mono).`,
          });
        }
      }

      if (UNITLESS_TOKEN_PROPS.has(prop)) {
        const bare = /(^|[\s(])(-?\d*\.?\d+)(?![\w.%])/.exec(masked);
        if (bare && parseFloat(bare[2] as string) !== 0) {
          violations.push({
            rule: 'G2',
            nr: null,
            file,
            line,
            message: `Numeric literal "${bare[2]}" in "${prop}" — ${prop} values come from tokens (${prop === 'z-index' ? '--ds-z-*' : prop === 'line-height' ? '--ds-text-leading-*' : '--ds-text-weight-*'}).`,
          });
        }
      }
    }
  }

  return violations;
}

function checkCategoryConformance(
  name: string,
  prop: string,
  value: string,
  file: string,
  line: number,
  violations: Violation[],
): void {
  const push = (nr: NrId | null, message: string): void => {
    violations.push({ rule: 'G3', nr, file, line, message });
  };

  if (name.startsWith('--ds-space-')) {
    if (!SPACE_PROP.test(prop)) {
      const isSizeMisuse = DIMENSION_PROP.test(prop);
      push(
        isSizeMisuse ? 'NR-006' : null,
        isSizeMisuse
          ? `"${name}" used in "${prop}" — space tokens are not sizes (NR-006); box dimensions use --ds-size-* tokens.`
          : `"${name}" used in "${prop}" — space tokens are only legal in margin/padding/gap/inset properties.`,
      );
    }
  } else if (name.startsWith('--ds-size-')) {
    const inCalc = value.includes('calc(');
    if (!DIMENSION_PROP.test(prop) && !TRANSFORM_PROP.test(prop) && !inCalc) {
      push(
        null,
        `"${name}" used in "${prop}" — size tokens are only legal in width/height/*-size properties (or derived via calc()).`,
      );
    }
  } else if (name.startsWith('--ds-radius-')) {
    if (!RADIUS_PROP.test(prop)) {
      push(null, `"${name}" used in "${prop}" — radius tokens are only legal in border-radius properties.`);
    }
  } else if (name.startsWith('--ds-z-')) {
    if (prop !== 'z-index') {
      push(null, `"${name}" used in "${prop}" — z tokens are only legal in z-index.`);
    }
  } else if (name.startsWith('--ds-motion-')) {
    if (!MOTION_PROP.test(prop)) {
      push(null, `"${name}" used in "${prop}" — motion tokens are only legal in transition/animation properties.`);
    }
  }
}
