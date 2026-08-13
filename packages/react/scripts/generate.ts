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

/**
 * FB-3 `racProps` allowlist. Inherited react-aria-components props were
 * invisible to strict props-array readers, so every entry with a `racBase`
 * now also carries a `racProps` array. v1 is a HYBRID: the prop NAMES below
 * are curated (the commonly-needed inherited surface — controlled usage,
 * disabled/invalid/required state, form `name`, `placeholder`, primary
 * events), but the types/descriptions are EXTRACTED from the RAC type
 * declarations by docgen — so a prop a component `Omit`s away never appears,
 * and the type text is never hand-written. Extend the list when a new
 * controlled-usage surface ships.
 */
const RAC_COMMON_PROP_NAMES = new Set([
  // controlled/uncontrolled value surfaces
  'value',
  'defaultValue',
  'onChange',
  'isSelected',
  'defaultSelected',
  'selectedKey',
  'defaultSelectedKey',
  'onSelectionChange',
  'isOpen',
  'defaultOpen',
  'onOpenChange',
  // form participation + validation/interaction state
  'isDisabled',
  'isInvalid',
  'isRequired',
  'isReadOnly',
  'name',
  'placeholder',
  'autoFocus',
  // primary press event (Button family)
  'onPress',
  // bounded-value surface (ProgressBar/Slider family) — the registry's own
  // examples use these; omitting them made the closed world contradict itself
  // (contribution-flow acceptance finding A5)
  'minValue',
  'maxValue',
  'isIndeterminate',
]);

/**
 * Packages whose declarations count as the react-aria inherited surface.
 * Substring match on the declaration path: 'react-aria' also covers
 * 'react-aria-components' and '@react-aria'; 'react-stately' also covers
 * '@react-stately' (RAC re-exports state props from the bare react-stately
 * dist types, not only the scoped packages).
 */
const RAC_TYPE_SOURCES = ['react-aria', 'react-stately', '@react-types'];

function isRacTypeSource(fileName: string): boolean {
  return RAC_TYPE_SOURCES.some((pkg) => fileName.includes(pkg));
}

function isInheritedProp(prop: PropItem): boolean {
  return prop.parent != null && prop.parent.fileName.includes('node_modules');
}

const parser = withCustomConfig(path.join(pkgRoot, 'tsconfig.json'), {
  shouldExtractLiteralValuesFromEnum: true,
  shouldRemoveUndefinedFromOptional: true,
  savePropValueAsString: true,
  shouldIncludePropTagMap: true,
  propFilter: (prop) => {
    // Own props always pass. Inherited react-aria-components/DOM props would
    // flood the registry, so of those only the curated common subset passes
    // (emitted as `racProps`, FB-3); the component doc still names its RAC
    // base for the full surface.
    if (!isInheritedProp(prop)) return true;
    return (
      isRacTypeSource(prop.parent!.fileName) &&
      RAC_COMMON_PROP_NAMES.has(prop.name)
    );
  },
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

function toPropEntry(prop: PropItem) {
  return {
    name: prop.name,
    type: formatType(prop),
    required: prop.required,
    defaultValue: defaultValueOf(prop),
    description: prop.description.replace(/\n@default .*$/s, '').trim(),
  };
}

function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, 'en');
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
  // `@tokenPrefix <prefix>` TSDoc tag: the component-tier `--ds-<prefix>-*`
  // hook namespace this component consumes — its customer override surface.
  // Components sharing a prefix form one theming family (NR-008: never use
  // another family's hooks). null for hook-less components.
  const tokenPrefix =
    tags && typeof tags['tokenPrefix'] === 'string'
      ? tags['tokenPrefix'].trim()
      : null;
  // Repo-relative stories path. Sub-exports (e.g. CardHeader) live in the
  // parent's file, so they naturally point at the parent's stories.
  const dirName = path.basename(path.dirname(doc.filePath));
  const storyFile = `packages/react/src/components/${dirName}/${dirName}.stories.tsx`;
  if (!existsSync(path.resolve(pkgRoot, '..', '..', storyFile))) {
    console.warn(
      `[generate] ${doc.displayName}: expected stories at ${storyFile} — file missing`,
    );
  }
  const allProps = Object.values(doc.props);
  const props = allProps
    .filter((prop) => !isInheritedProp(prop))
    .map(toPropEntry)
    .sort(byName);
  // FB-3: the commonly-needed inherited RAC props, extracted from the RAC
  // type declarations (curated NAME allowlist, see RAC_COMMON_PROP_NAMES).
  const racProps = racBase
    ? allProps.filter(isInheritedProp).map(toPropEntry).sort(byName)
    : null;
  const racPropsNote = racBase
    ? `Commonly needed props inherited from the react-aria-components base; ` +
      `the full react-aria-components ${racBase}Props surface is also legal.`
    : null;
  return {
    name: doc.displayName,
    description,
    racBase,
    racPropsNote,
    racProps,
    tokenPrefix,
    storyFile,
    example,
    props,
  };
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
    'set, the props of that react-aria-components base component are ALSO ' +
    'legal on the component (own props overriding/narrowing them), and ' +
    '`racProps` lists the commonly needed inherited subset — controlled ' +
    'usage (value/onChange, isSelected, selectedKey/onSelectionChange), ' +
    'isDisabled/isInvalid/isRequired, form `name`, placeholder — with exact ' +
    'extracted types (see `racPropsNote`; a prop the component omits from ' +
    'its base never appears). ' +
    '`tokenPrefix` names the component-tier `--ds-<tokenPrefix>-*` token ' +
    'namespace that is the component\'s customer override surface; ' +
    'components sharing a prefix form one theming family (e.g. Button and ' +
    'IconButton share `button`) and NEVER consume another family\'s hooks ' +
    '(NR-008); null means the component has no component-tier hooks. ' +
    '`storyFile` is the repo-relative path to the component\'s Storybook ' +
    'stories — the ground-truth usage examples; sub-components point at ' +
    "their parent's stories. " +
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
