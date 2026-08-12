/**
 * @ds/react generator — the machine-contract compiler for the component layer.
 *
 * Run with: pnpm --filter @ds/react generate
 *
 * Scans `src/components/<Name>/` directories and regenerates:
 *   1. `src/index.ts` — the package barrel (GENERATED, never hand-edited)
 *   2. `<repo>/registries/components-index.json` — the closed-world registry:
 *      every component export with TSDoc description, example, and exact prop
 *      shapes (literal-union text preserved) via react-docgen-typescript.
 *
 * Output is deterministic: components and props are sorted by name.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  withCustomConfig,
  type ComponentDoc,
  type PropItem,
} from 'react-docgen-typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const componentsDir = path.join(pkgRoot, 'src', 'components');
const registriesDir = path.resolve(pkgRoot, '..', '..', 'registries');

/* --- discover component directories -------------------------------------- */

const componentNames = readdirSync(componentsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => {
    const hasEntry = existsSync(path.join(componentsDir, name, 'index.ts'));
    const hasImpl = existsSync(path.join(componentsDir, name, `${name}.tsx`));
    if (!hasEntry || !hasImpl) {
      console.warn(
        `[generate] skipping src/components/${name}: expected ${name}.tsx and index.ts`,
      );
    }
    return hasEntry && hasImpl;
  })
  .sort((a, b) => a.localeCompare(b, 'en'));

if (componentNames.length === 0) {
  console.error('[generate] no components found under src/components — aborting');
  process.exit(1);
}

/* --- 1. barrel ------------------------------------------------------------ */

const barrel = [
  '// GENERATED FILE — do not edit by hand.',
  '// Regenerate with: pnpm --filter @ds/react generate',
  '',
  '// Token custom properties ship with the package entry so consumers get',
  '// the default brand automatically (brand tier overrides at runtime).',
  "import '@ds/tokens/css';",
  '',
  ...componentNames.map((name) => `export * from './components/${name}';`),
  '',
].join('\n');

writeFileSync(path.join(pkgRoot, 'src', 'index.ts'), barrel);
console.log(`[generate] src/index.ts — ${componentNames.length} component(s)`);

/* --- 2. registry via react-docgen-typescript ------------------------------- */

const parser = withCustomConfig(path.join(pkgRoot, 'tsconfig.json'), {
  shouldExtractLiteralValuesFromEnum: true,
  shouldRemoveUndefinedFromOptional: true,
  savePropValueAsString: true,
  shouldIncludePropTagMap: true,
  propFilter: (prop) =>
    // Own props only: inherited react-aria-components/DOM props would flood
    // the registry. The component doc names its RAC base instead.
    !prop.parent || !prop.parent.fileName.includes('node_modules'),
});

/** Exact type text: reconstruct literal unions, otherwise raw ?? name. */
function formatType(prop: PropItem): string {
  const { type } = prop;
  if (type.name === 'enum' && Array.isArray(type.value)) {
    return (type.value as Array<{ value: string }>)
      .map((v) => v.value)
      .join(' | ');
  }
  return type.raw ?? type.name;
}

/** `@default` tag wins (docgen cannot see destructuring defaults). */
function defaultValueOf(prop: PropItem): string | null {
  const tags = (prop as PropItem & { tags?: Record<string, string> }).tags;
  if (tags && typeof tags['default'] === 'string') return tags['default'];
  if (prop.defaultValue && prop.defaultValue.value != null) {
    return String(prop.defaultValue.value);
  }
  return null;
}

/** Strip the code fence from an `@example` TSDoc block. */
function unfence(block: string): string {
  return block
    .replace(/^\s*```(?:tsx?)?\n?/, '')
    .replace(/```\s*$/, '')
    .trim();
}

function toRegistryEntry(doc: ComponentDoc) {
  const description = doc.description.trim();
  const tags = (doc as ComponentDoc & { tags?: Record<string, string> }).tags;
  const example =
    tags && typeof tags['example'] === 'string' ? unfence(tags['example']) : null;
  // `@racBase <Name>` TSDoc tag: names the react-aria-components base whose
  // props are also legal on this component. null for static components.
  const racBase =
    tags && typeof tags['racBase'] === 'string' ? tags['racBase'].trim() : null;
  const props = Object.values(doc.props)
    .map((prop) => ({
      name: prop.name,
      type: formatType(prop),
      required: prop.required,
      defaultValue: defaultValueOf(prop),
      description: prop.description
        .replace(/\n@default .*$/s, '')
        .trim(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return { name: doc.displayName, description, racBase, example, props };
}

const files = componentNames.map((name) =>
  path.join(componentsDir, name, `${name}.tsx`),
);
const docs = parser.parse(files);

const components = docs
  .map(toRegistryEntry)
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

const missing = componentNames.filter(
  (name) => !components.some((c) => c.name === name),
);
if (missing.length > 0) {
  console.error(
    `[generate] docgen produced no entry for: ${missing.join(', ')} — ` +
      'is the component exported as a named function with TSDoc?',
  );
  process.exit(1);
}

const registry = {
  $description:
    'GENERATED closed-world component registry for @ds/react. ' +
    'Any component not listed here does not exist. ' +
    "Each entry's `props` lists the component's OWN props; when `racBase` is " +
    'set, the props of that react-aria-components base component (e.g. ' +
    'onPress, isDisabled, autoFocus) are ALSO legal on the component, with ' +
    'the own props overriding/narrowing them. ' +
    'Regenerate with: pnpm --filter @ds/react generate',
  package: '@ds/react',
  components,
};

mkdirSync(registriesDir, { recursive: true });
writeFileSync(
  path.join(registriesDir, 'components-index.json'),
  JSON.stringify(registry, null, 2) + '\n',
);
console.log(
  `[generate] registries/components-index.json — ${components.length} component(s)`,
);
