/**
 * Component-library probe (brief practice 2): is there a React library, is it
 * typed, are variants literal unions or loose strings, are exports enumerable,
 * and do stories exist as contract artifacts?
 */
import { isGenerated, isTestish, type RepoFile, type RepoScan } from '../walk.ts';

export interface ComponentFindings {
  /** Non-test, non-generated .tsx/.jsx files with an Uppercase basename. */
  componentFiles: number;
  componentDirs: number;
  /** tsx / (tsx + jsx) among component files. */
  typedShare: number | null;
  /** `interface FooProps` / `type FooProps` declarations found. */
  propsDecls: number;
  propsDeclFiles: string[];
  /** Variant-ish props typed as literal unions vs loose `string`. */
  variantUnionProps: number;
  variantLooseProps: number;
  looseExamples: string[];
  /** Barrel file enumerating exports. */
  barrel: { path: string; exports: number } | null;
  storyFiles: number;
  exampleComponentPaths: string[];
}

const VARIANT_KEY_RE =
  /(?:^|[;{,])\s*(variant|size|tone|kind|appearance|intent|severity|status|color|colorScheme|emphasis)\??\s*:\s*([^;\n}]+)/gm;

/** Read a balanced-brace block starting at the first `{` at/after `from`. */
function braceBlock(source: string, from: number): string | null {
  const open = source.indexOf('{', from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

function isComponentSource(f: RepoFile): boolean {
  if (isGenerated(f) || isTestish(f)) return false;
  if (f.base.endsWith('.d.ts')) return false;
  return /^[A-Z]/.test(f.base) && (f.ext === '.tsx' || f.ext === '.jsx');
}

export function probeComponents(scan: RepoScan): ComponentFindings {
  const compFiles = scan.files.filter(isComponentSource);
  const dirs = new Set(compFiles.map((f) => f.segs.join('/')));
  const tsx = compFiles.filter((f) => f.ext === '.tsx').length;
  const typedShare = compFiles.length > 0 ? tsx / compFiles.length : null;

  // Props + variant typing over ALL non-test TS sources (shared type files count).
  let propsDecls = 0;
  const propsDeclFiles: string[] = [];
  let variantUnionProps = 0;
  let variantLooseProps = 0;
  const looseExamples: string[] = [];
  const tsSources = scan.files.filter(
    (f) =>
      (f.ext === '.ts' || f.ext === '.tsx') &&
      !f.base.endsWith('.d.ts') &&
      !isGenerated(f) &&
      !isTestish(f),
  );
  const propsDeclRe = /(?:interface|type)\s+([A-Za-z0-9_]*Props)\b/g;
  for (const f of tsSources) {
    const text = scan.read(f);
    if (text === null) continue;
    propsDeclRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    let found = 0;
    while ((m = propsDeclRe.exec(text)) !== null) {
      found++;
      const block = braceBlock(text, m.index);
      if (block === null) continue;
      VARIANT_KEY_RE.lastIndex = 0;
      let vm: RegExpExecArray | null;
      while ((vm = VARIANT_KEY_RE.exec(block)) !== null) {
        const typeText = (vm[2] as string).trim();
        if (/['"][^'"]*['"]/.test(typeText)) {
          variantUnionProps++;
        } else if (/^string$/.test(typeText.replace(/;$/, '').trim())) {
          variantLooseProps++;
          if (looseExamples.length < 5) {
            looseExamples.push(`${f.rel}: ${vm[1]}: string`);
          }
        }
      }
    }
    if (found > 0) {
      propsDecls += found;
      propsDeclFiles.push(f.rel);
    }
  }

  // Barrel: an index.ts(x)/index.js under a src/ dir with >=5 export statements.
  let barrel: { path: string; exports: number } | null = null;
  for (const f of scan.byBase(/^index\.[cm]?[jt]sx?$/)) {
    if (isGenerated(f) || isTestish(f)) continue;
    const text = scan.read(f);
    if (text === null) continue;
    const exports = (text.match(/^export\s+(\{|\*|type\s+\{)/gm) ?? []).length;
    if (exports >= 5 && (barrel === null || exports > barrel.exports)) {
      barrel = { path: f.rel, exports };
    }
  }

  const storyFiles = scan.files.filter(
    (f) => /\.stories\.[cm]?[jt]sx?$/.test(f.base) && !isGenerated(f),
  ).length;

  return {
    componentFiles: compFiles.length,
    componentDirs: dirs.size,
    typedShare,
    propsDecls,
    propsDeclFiles,
    variantUnionProps,
    variantLooseProps,
    looseExamples,
    barrel,
    storyFiles,
    exampleComponentPaths: compFiles.slice(0, 5).map((f) => f.rel),
  };
}
