import { parseCss } from '../css-parser.ts';
import type { SourceFile, Violation } from '../types.ts';

/**
 * G10 / NR-011: CSS-module classes are a closed world too. Every STATIC
 * `styles.<x>` / `styles['x']` reference in a .tsx must exist as a class in
 * the .module.css it imports — an undefined module lookup fails silently
 * (the className vanishes at runtime).
 *
 * Cross-file by nature, so it runs over the whole batch handed to
 * validateSources: a reference is only checked when the imported .module.css
 * is present in the same batch (the gauntlet always passes the full
 * packages/react/src tree; eval fixtures ship the pair). Dynamic lookups
 * (styles[variant]) are unverifiable lexically and are skipped.
 */

/** Class names defined in a stylesheet (selector class tokens + composes targets). */
export function cssModuleClasses(content: string): Set<string> {
  const classes = new Set<string>();
  for (const rule of parseCss(content).rules) {
    if (rule.inKeyframes) continue;
    const re = /\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rule.selector)) !== null) classes.add(m[1] as string);
  }
  return classes;
}

/** Resolve `./x` / `../x` against the importing file's directory (posix-ish). */
function resolveRelative(fromFile: string, spec: string): string {
  const norm = fromFile.replace(/\\/g, '/');
  const parts = norm.split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '.' || seg === '') continue;
    else if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

function lineAt(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}

export function checkModuleClassRefs(files: SourceFile[]): Violation[] {
  const violations: Violation[] = [];
  const byPath = new Map<string, SourceFile>();
  for (const f of files) byPath.set(f.path.replace(/\\/g, '/'), f);

  for (const f of files) {
    const path = f.path.replace(/\\/g, '/');
    if (!/\.(tsx|jsx)$/.test(path)) continue;

    // import <binding> from './X.module.css'
    const importRe = /import\s+([A-Za-z_$][\w$]*)\s+from\s*['"](\.[^'"]*\.module\.css)['"]/g;
    let im: RegExpExecArray | null;
    while ((im = importRe.exec(f.content)) !== null) {
      const binding = im[1] as string;
      const cssPath = resolveRelative(path, im[2] as string);
      const cssFile = byPath.get(cssPath);
      if (!cssFile) continue; // stylesheet not in this batch — cannot verify
      const classes = cssModuleClasses(cssFile.content);

      // Static references: styles.foo and styles['foo'] / styles["foo"].
      const refRe = new RegExp(
        `\\b${binding}\\s*(?:\\.\\s*([A-Za-z_$][\\w$]*)|\\[\\s*(['"])([^'"]+)\\2\\s*\\])`,
        'g',
      );
      let rm: RegExpExecArray | null;
      while ((rm = refRe.exec(f.content)) !== null) {
        const cls = (rm[1] ?? rm[3]) as string | undefined;
        if (!cls) continue;
        if (!classes.has(cls)) {
          violations.push({
            rule: 'G10',
            nr: 'NR-011',
            file: f.path,
            line: lineAt(f.content, rm.index),
            message: `"${binding}.${cls}" — no class ".${cls}" exists in ${im[2]} (CSS-module classes are a closed world, NR-011): the className silently vanishes at runtime. Add the rule before the reference.`,
          });
        }
      }
    }
  }
  return violations;
}
