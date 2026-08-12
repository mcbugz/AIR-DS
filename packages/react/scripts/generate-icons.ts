/**
 * @ds/react icon + pattern registry compiler.
 *
 * Run with: pnpm --filter @ds/react exec tsx scripts/generate-icons.ts
 * (package.json scripts are owned by scripts/generate.ts's owner; this file
 * is intentionally invocable without a script entry.)
 *
 * Compiles two closed-world registries (CLAUDE.md rules 1 & 5 — docs and
 * component sources are the source of truth, the JSON is compiled output):
 *
 *   1. `<repo>/registries/icons-metadata.json` — from `src/icons/<Name>Icon.tsx`
 *      sources: export name, kebab icon name, `@keywords` TSDoc tag, sizes.
 *      Also CHECKS the hand-written `src/icons/index.ts` barrel against the
 *      filesystem: a missing or extra export fails generation.
 *
 *   2. `<repo>/registries/patterns-index.json` — from `docs/patterns/*.md`
 *      frontmatter (id, title, components, tokensUsed, keywords). Every
 *      `components` entry is validated against components-index.json and
 *      every `tokensUsed` entry against tokens-index.json — a pattern that
 *      cites a fabricated component or token fails generation ("Instruction
 *      hopes the model complies. Structure checks.").
 *
 * Output is deterministic: icons sorted by name, patterns by id, keywords
 * sorted, stable key order, 2-space indent, trailing newline.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const repoRoot = path.resolve(pkgRoot, '..', '..');
const iconsDir = path.join(pkgRoot, 'src', 'icons');
const patternsDir = path.join(repoRoot, 'docs', 'patterns');
const registriesDir = path.join(repoRoot, 'registries');

const ICON_SIZES = ['sm', 'md', 'lg'] as const;
const ICON_SINCE = '0.1.0';

/* ---------------------------------------------------------------- icons -- */

export interface IconEntry {
  name: string;
  export: string;
  keywords: string[];
  sizes: string[];
  since: string;
}

export interface IconsMetadata {
  $description: string;
  count: number;
  icons: IconEntry[];
}

/** `ChevronDownIcon` → `chevron-down`. */
function iconNameOf(exportName: string): string {
  return exportName
    .replace(/Icon$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function parseIconFile(file: string): IconEntry {
  const source = readFileSync(path.join(iconsDir, file), 'utf8');
  const exportMatch = source.match(/export function ([A-Z]\w*Icon)\(/);
  if (!exportMatch?.[1]) {
    throw new Error(
      `[generate-icons] ${file}: expected \`export function <Name>Icon(\``,
    );
  }
  const exportName = exportMatch[1];
  if (`${exportName}.tsx` !== file) {
    throw new Error(
      `[generate-icons] ${file}: export \`${exportName}\` must match the file name`,
    );
  }
  const keywordsMatch = source.match(/@keywords ([^\n]+)/);
  if (!keywordsMatch?.[1]) {
    throw new Error(`[generate-icons] ${file}: missing \`@keywords\` TSDoc tag`);
  }
  const keywords = keywordsMatch[1]
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'en'));
  return {
    name: iconNameOf(exportName),
    export: exportName,
    keywords,
    sizes: [...ICON_SIZES],
    since: ICON_SINCE,
  };
}

/** Fails if the hand-written barrel and the icon files on disk disagree. */
function checkBarrel(iconExports: string[]): void {
  const barrel = readFileSync(path.join(iconsDir, 'index.ts'), 'utf8');
  const barrelExports = [...barrel.matchAll(/export \{ (\w+) \} from/g)].map(
    (m) => m[1]!,
  );
  const missing = iconExports.filter((e) => !barrelExports.includes(e));
  const extra = barrelExports.filter((e) => !iconExports.includes(e));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `[generate-icons] src/icons/index.ts barrel out of sync — ` +
        `missing: [${missing.join(', ')}] extra: [${extra.join(', ')}]`,
    );
  }
}

export function buildIconsMetadata(): IconsMetadata {
  const files = readdirSync(iconsDir)
    .filter((f) => /^[A-Z]\w*Icon\.tsx$/.test(f))
    .sort((a, b) => a.localeCompare(b, 'en'));
  if (files.length === 0) {
    throw new Error('[generate-icons] no <Name>Icon.tsx files in src/icons');
  }
  const icons = files
    .map(parseIconFile)
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  checkBarrel(icons.map((i) => i.export));
  return {
    $description:
      'GENERATED closed-world icon registry for @ds/react/icons. ' +
      'Any icon not listed here does not exist. `export` is the named export ' +
      "from '@ds/react/icons'; every icon is a 24×24 outline SVG (stroke " +
      'currentColor), decorative by default (`aria-hidden`), with optional ' +
      '`title` (accessible name) and `size` mapping to the ' +
      '`--ds-size-icon-*` scale. ' +
      'Regenerate with: pnpm --filter @ds/react exec tsx scripts/generate-icons.ts',
    count: icons.length,
    icons,
  };
}

/* ------------------------------------------------------------- patterns -- */

export interface PatternEntry {
  id: string;
  title: string;
  components: string[];
  tokensUsed: string[];
  docFile: string;
  keywords: string[];
}

export interface PatternsIndex {
  $description: string;
  count: number;
  patterns: PatternEntry[];
}

/** Minimal frontmatter parser: `key: scalar` and `key: [a, b, c]` lines. */
function parseFrontmatter(file: string, source: string): Record<string, string | string[]> {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match?.[1]) {
    throw new Error(`[generate-icons] ${file}: missing frontmatter block`);
  }
  const out: Record<string, string | string[]> = {};
  for (const line of match[1].split('\n')) {
    if (line.trim() === '') continue;
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    const key = kv?.[1];
    const raw = kv?.[2];
    if (key === undefined || raw === undefined) {
      throw new Error(`[generate-icons] ${file}: unparseable frontmatter line: ${line}`);
    }
    if (raw.startsWith('[')) {
      if (!raw.endsWith(']')) {
        throw new Error(`[generate-icons] ${file}: unterminated array for \`${key}\``);
      }
      const inner = raw.slice(1, -1).trim();
      out[key] = inner === '' ? [] : inner.split(',').map((v) => v.trim());
    } else {
      out[key] = raw.trim();
    }
  }
  return out;
}

function stringList(file: string, fm: Record<string, string | string[]>, key: string): string[] {
  const value = fm[key];
  if (!Array.isArray(value)) {
    throw new Error(`[generate-icons] ${file}: frontmatter \`${key}\` must be an array`);
  }
  return value;
}

function scalar(file: string, fm: Record<string, string | string[]>, key: string): string {
  const value = fm[key];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`[generate-icons] ${file}: frontmatter \`${key}\` must be a non-empty string`);
  }
  return value;
}

/** Closed-world check: pattern citations must exist in the registries. */
function validatePattern(entry: PatternEntry): void {
  const componentsIndex = JSON.parse(
    readFileSync(path.join(registriesDir, 'components-index.json'), 'utf8'),
  ) as { components: Array<{ name: string }> };
  const knownComponents = new Set(componentsIndex.components.map((c) => c.name));
  const tokensIndex = JSON.parse(
    readFileSync(path.join(registriesDir, 'tokens-index.json'), 'utf8'),
  ) as { tokens: Array<{ cssVar: string }> };
  const knownTokens = new Set(tokensIndex.tokens.map((t) => t.cssVar));

  for (const component of entry.components) {
    if (!knownComponents.has(component)) {
      throw new Error(
        `[generate-icons] pattern ${entry.id}: component \`${component}\` is not in components-index.json`,
      );
    }
  }
  for (const token of entry.tokensUsed) {
    if (!knownTokens.has(token)) {
      throw new Error(
        `[generate-icons] pattern ${entry.id}: token \`${token}\` is not in tokens-index.json`,
      );
    }
  }
}

export function buildPatternsIndex(): PatternsIndex {
  const files = readdirSync(patternsDir)
    .filter((f) => f.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, 'en'));
  if (files.length === 0) {
    throw new Error('[generate-icons] no pattern docs in docs/patterns');
  }
  const patterns = files
    .map((file) => {
      const fm = parseFrontmatter(file, readFileSync(path.join(patternsDir, file), 'utf8'));
      const id = scalar(file, fm, 'id');
      if (`${id}.md` !== file) {
        throw new Error(
          `[generate-icons] ${file}: frontmatter id \`${id}\` must match the file name`,
        );
      }
      const entry: PatternEntry = {
        id,
        title: scalar(file, fm, 'title'),
        components: stringList(file, fm, 'components'),
        tokensUsed: stringList(file, fm, 'tokensUsed'),
        docFile: `docs/patterns/${file}`,
        keywords: stringList(file, fm, 'keywords').sort((a, b) => a.localeCompare(b, 'en')),
      };
      validatePattern(entry);
      return entry;
    })
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return {
    $description:
      'GENERATED closed-world pattern registry for @ds/react, compiled from ' +
      'docs/patterns/*.md frontmatter (docs are source, this JSON is output). ' +
      'Any composition pattern not listed here is not a sanctioned pattern. ' +
      '`components` name @ds/react registry components (components-index.json); ' +
      "`tokensUsed` are the --ds-* custom properties the pattern's own CSS " +
      'consumes (tokens-index.json); `docFile` holds when-to-use, the ' +
      'composition rule, a complete example, and the anti-pattern note. ' +
      'Regenerate with: pnpm --filter @ds/react exec tsx scripts/generate-icons.ts',
    count: patterns.length,
    patterns,
  };
}

/* ----------------------------------------------------------------- main -- */

export function emit(): void {
  const iconsMetadata = buildIconsMetadata();
  writeFileSync(
    path.join(registriesDir, 'icons-metadata.json'),
    JSON.stringify(iconsMetadata, null, 2) + '\n',
  );
  console.log(
    `[generate-icons] registries/icons-metadata.json — ${iconsMetadata.count} icon(s)`,
  );

  const patternsIndex = buildPatternsIndex();
  writeFileSync(
    path.join(registriesDir, 'patterns-index.json'),
    JSON.stringify(patternsIndex, null, 2) + '\n',
  );
  console.log(
    `[generate-icons] registries/patterns-index.json — ${patternsIndex.count} pattern(s)`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  emit();
}
