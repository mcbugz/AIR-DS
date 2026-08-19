/** Component adapter: react-docgen-typescript over THEIR component library.
 *  Emits components-index.json in the canonical schema — racBase/racProps/
 *  tokenPrefix are null (retrofit), storyFile included when a co-located
 *  stories file is detectable, examples synthesized from extracted props. */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import {
  withCompilerOptions,
  withCustomConfig,
  type ComponentDoc,
  type FileParser,
  type PropItem,
} from 'react-docgen-typescript';
import type {
  ComponentConfidence,
  ComponentEntryOut,
  ComponentsIndexOut,
  PropEntryOut,
} from './types.js';

const SOURCE_EXT_RE = /\.(tsx|jsx|ts|js|mjs|cjs)$/;
const IGNORE_FILE_RE = /\.(stories|story|test|spec|d)\.[a-z]+$/;
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.next', 'out']);
const STORY_EXTS = ['.stories.tsx', '.stories.jsx', '.stories.ts', '.stories.js', '.stories.mdx', '.story.tsx', '.story.jsx'];

/** Recursively collect parseable source files (deterministic order). */
export function collectSourceFiles(root: string, dir = root, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir).sort();
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const abs = join(dir, entry);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (!IGNORE_DIRS.has(entry) && !entry.startsWith('.')) collectSourceFiles(root, abs, acc);
    } else if (SOURCE_EXT_RE.test(entry) && !IGNORE_FILE_RE.test(entry)) {
      acc.push(abs);
    }
  }
  return acc;
}

/** Minimal glob: `*` = within a segment, `**` = any depth. Comma-separated alternatives. */
export function matchGlob(pattern: string, relPath: string): boolean {
  return pattern.split(',').some((p) => {
    const rx = p
      .trim()
      .split(/\*\*/g)
      .map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))
      .join('(?:.*)?');
    return new RegExp(`^${rx}$`).test(relPath);
  });
}

/** Entry file from package.json `types` -> `main`, when it is a source file. */
export function resolveEntry(repoRoot: string): string | null {
  const pkgPath = join(repoRoot, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
    for (const field of ['types', 'main']) {
      const value = pkg[field];
      if (typeof value === 'string') {
        const abs = resolve(repoRoot, value);
        if (existsSync(abs) && SOURCE_EXT_RE.test(abs)) return abs;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function makeParser(repoRoot: string): FileParser {
  const opts = {
    shouldExtractLiteralValuesFromEnum: true,
    shouldRemoveUndefinedFromOptional: true,
    savePropValueAsString: true,
    propFilter: (prop: PropItem): boolean =>
      prop.parent == null || !prop.parent.fileName.includes('node_modules'),
  };
  const tsconfig = join(repoRoot, 'tsconfig.json');
  if (existsSync(tsconfig)) return withCustomConfig(tsconfig, opts);
  return withCompilerOptions(
    {
      jsx: 4, // ts.JsxEmit.ReactJSX
      allowJs: true,
      esModuleInterop: true,
      skipLibCheck: true,
      target: 7, // ts.ScriptTarget.ES2020
      module: 99, // ts.ModuleKind.ESNext
      moduleResolution: 100, // ts.ModuleResolutionKind.Bundler
      noEmit: true,
    },
    opts,
  );
}

function formatType(prop: PropItem): string {
  const { type } = prop;
  if (type.name === 'enum' && Array.isArray(type.value)) {
    return (type.value as Array<{ value: string }>).map((v) => v.value).join(' | ');
  }
  return type.raw ?? type.name;
}

function toPropEntry(prop: PropItem): PropEntryOut {
  return {
    name: prop.name,
    type: formatType(prop),
    required: prop.required,
    defaultValue:
      prop.defaultValue && prop.defaultValue.value != null ? String(prop.defaultValue.value) : null,
    description: (prop.description ?? '').trim(),
  };
}

/** Deterministic minimal example synthesized from the extracted props. */
export function synthesizeExample(name: string, props: PropEntryOut[]): string {
  const attrs: string[] = [];
  for (const prop of props) {
    if (attrs.length >= 2) break;
    const first = /^"([^"]*)"/.exec(prop.type);
    if (first && prop.type.includes(' | ') && prop.name !== 'children') {
      attrs.push(`${prop.name}="${first[1] ?? ''}"`);
    } else if (prop.required && prop.type === 'string' && prop.name !== 'children') {
      attrs.push(`${prop.name}="…"`);
    }
  }
  const attrText = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
  const hasChildren = props.some((p) => p.name === 'children');
  return hasChildren ? `<${name}${attrText}>…</${name}>` : `<${name}${attrText} />`;
}

function findStoryFile(componentFile: string, repoRoot: string): string | null {
  const dir = dirname(componentFile);
  const base = basename(componentFile).replace(SOURCE_EXT_RE, '');
  for (const ext of STORY_EXTS) {
    const candidate = join(dir, `${base}${ext}`);
    if (existsSync(candidate)) return relative(repoRoot, candidate).split('\\').join('/');
  }
  return null;
}

export interface ComponentAdapterResult {
  index: ComponentsIndexOut;
  confidence: ComponentConfidence[];
  parsedFiles: number;
}

export interface ComponentAdapterOptions {
  /** Comma-separated minimal globs relative to the repo root; overrides discovery. */
  componentsGlob?: string;
  packageName?: string;
}

export function componentIndex(repoRoot: string, options: ComponentAdapterOptions = {}): ComponentAdapterResult {
  const all = collectSourceFiles(repoRoot);
  let files: string[];
  if (options.componentsGlob !== undefined) {
    files = all.filter((f) => matchGlob(options.componentsGlob as string, relative(repoRoot, f).split('\\').join('/')));
  } else {
    files = all;
    const entry = resolveEntry(repoRoot);
    if (entry !== null && !files.includes(entry)) files.push(entry);
  }
  files.sort();

  const parser = makeParser(repoRoot);
  let docs: ComponentDoc[] = [];
  if (files.length > 0) {
    try {
      docs = parser.parse(files);
    } catch {
      docs = [];
    }
  }

  // Keep component-looking docs; dedupe by displayName preferring more props.
  const byName = new Map<string, ComponentDoc>();
  for (const doc of docs) {
    if (!/^[A-Z]/.test(doc.displayName)) continue;
    if (IGNORE_FILE_RE.test(doc.filePath)) continue;
    const existing = byName.get(doc.displayName);
    if (existing === undefined || Object.keys(doc.props).length > Object.keys(existing.props).length) {
      byName.set(doc.displayName, doc);
    }
  }

  const packageName = options.packageName ?? readPackageName(repoRoot) ?? basename(repoRoot);
  const components: ComponentEntryOut[] = [];
  const confidence: ComponentConfidence[] = [];
  for (const doc of [...byName.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'en'))) {
    const props = Object.values(doc.props)
      .filter((p) => p.name !== 'key' && p.name !== 'ref')
      .map(toPropEntry)
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
    const storyFile = findStoryFile(doc.filePath, repoRoot);
    const typed = props.length > 0 && props.some((p) => p.type !== 'any' && p.type !== '');
    const entry: ComponentEntryOut = {
      name: doc.displayName,
      description: doc.description.trim(),
      racBase: null,
      racPropsNote: null,
      racProps: null,
      tokenPrefix: null,
      ...(storyFile !== null ? { storyFile } : {}),
      example: synthesizeExample(doc.displayName, props),
      props,
    };
    components.push(entry);
    confidence.push({
      name: doc.displayName,
      file: relative(repoRoot, doc.filePath).split('\\').join('/'),
      props: props.length,
      typing: typed ? 'typed' : 'untyped',
    });
  }

  const index: ComponentsIndexOut = {
    $description:
      `GENERATED closed-world component registry synthesized by @ds/retrofit from ${packageName}. ` +
      'Any component not listed here does not exist — an import of an unlisted name is provably fabricated. ' +
      'Props were extracted from the library\'s OWN types by react-docgen-typescript; untyped (plain JS) components ' +
      'appear with an empty props list and low confidence (see RETROFIT.md). ' +
      '`racBase`/`racPropsNote`/`racProps` are null: no react-aria-components contract was detected in the target. ' +
      '`tokenPrefix` is null: no component-tier token namespaces were synthesized. ' +
      '`storyFile` (target-repo-relative) is present only when a co-located stories file was detected. ' +
      '`example` is a synthesized minimal usage, not ground truth. ' +
      'Regenerate with: ds-retrofit <repo> -o <outdir>',
    package: packageName,
    components,
  };
  return { index, confidence, parsedFiles: files.length };
}

function readPackageName(repoRoot: string): string | null {
  try {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as Record<string, unknown>;
    return typeof pkg['name'] === 'string' ? pkg['name'] : null;
  } catch {
    return null;
  }
}
