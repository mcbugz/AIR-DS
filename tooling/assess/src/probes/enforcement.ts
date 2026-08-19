/**
 * Enforcement probe (brief practices 7-9): CI gates, token/style linting,
 * a11y testing, eval files, and plain test coverage. Deterministic checks a
 * merge actually flows through — "instruction hopes the model complies;
 * structure checks."
 */
import type { RepoScan } from '../walk.ts';

export interface EnforcementFindings {
  ciConfigs: string[];
  /** Stylelint config/dependency. */
  styleLint: string | null;
  /** A custom validator package scanning custom properties (gauntlet-style). */
  customValidator: string | null;
  a11yTooling: string | null;
  evalFiles: string[];
  testFiles: number;
  /** Root/workspace package script names that gate quality (validate/gauntlet/evals/benchmark). */
  qualityScripts: string[];
}

export function probeEnforcement(scan: RepoScan): EnforcementFindings {
  const ciConfigs = scan.files
    .filter(
      (f) =>
        ((f.ext === '.yml' || f.ext === '.yaml') &&
          f.segs.includes('.github') &&
          f.segs.includes('workflows')) ||
        f.base === '.gitlab-ci.yml' ||
        f.base === 'azure-pipelines.yml' ||
        f.base === 'Jenkinsfile' ||
        (f.base === 'config.yml' && f.segs.includes('.circleci')),
    )
    .map((f) => f.rel);

  let styleLint: string | null = null;
  const stylelintCfg = scan.byBase(/^(\.stylelintrc(\..+)?|stylelint\.config\.[cm]?js)$/)[0];
  if (stylelintCfg !== undefined) styleLint = stylelintCfg.rel;

  let a11yTooling: string | null = null;
  const A11Y_DEP_RE = /(axe-core|jest-axe|vitest-axe|@axe-core\/|pa11y|addon-a11y|@storybook\/addon-a11y)/;
  for (const f of scan.byBase(/^package\.json$/)) {
    const text = scan.read(f);
    if (text === null) continue;
    if (styleLint === null && /"stylelint"\s*:/.test(text)) styleLint = f.rel;
    if (a11yTooling === null && A11Y_DEP_RE.test(text)) a11yTooling = f.rel;
  }

  // Custom validator: a package whose name/description says validate/lint/
  // gauntlet AND whose sources actually scan custom properties.
  let customValidator: string | null = null;
  outer: for (const f of scan.byBase(/^package\.json$/)) {
    const parsed = scan.json(f);
    if (parsed === null || typeof parsed !== 'object') continue;
    const pkg = parsed as Record<string, unknown>;
    const label = `${String(pkg['name'] ?? '')} ${String(pkg['description'] ?? '')}`;
    if (!/(validat|lint|gauntlet)/i.test(label)) continue;
    const pkgDir = f.segs.join('/');
    for (const src of scan.files) {
      if (!src.rel.startsWith(pkgDir === '' ? '' : `${pkgDir}/`)) continue;
      if (src.ext !== '.ts' && src.ext !== '.js') continue;
      const text = scan.read(src);
      if (text !== null && text.includes('var(--') && /violation|rule/i.test(text)) {
        customValidator = f.rel;
        break outer;
      }
    }
  }

  const evalFiles = scan.files
    .filter(
      (f) =>
        /^evals?\.json$/.test(f.base) ||
        /\.evals?\.(json|ya?ml)$/.test(f.base) ||
        /^promptfooconfig\.(json|ya?ml)$/.test(f.base) ||
        (f.ext === '.json' && f.segs.includes('evals')),
    )
    .map((f) => f.rel);

  const testFiles = scan.files.filter(
    (f) =>
      /\.(test|spec)\.[cm]?[jt]sx?$/.test(f.base) ||
      (f.segs.includes('__tests__') && /\.[cm]?[jt]sx?$/.test(f.ext)),
  ).length;

  const qualityScripts: string[] = [];
  for (const f of scan.byBase(/^package\.json$/)) {
    if (f.segs.length > 2) continue;
    const parsed = scan.json(f);
    if (parsed === null || typeof parsed !== 'object') continue;
    const scripts = (parsed as Record<string, unknown>)['scripts'];
    if (scripts === null || typeof scripts !== 'object') continue;
    for (const name of Object.keys(scripts as Record<string, unknown>)) {
      if (/^(validate|gauntlet|evals?|benchmark)(:|$)/.test(name)) {
        qualityScripts.push(`${f.rel} → "${name}"`);
      }
    }
  }

  return { ciConfigs, styleLint, customValidator, a11yTooling, evalFiles, testFiles, qualityScripts };
}
