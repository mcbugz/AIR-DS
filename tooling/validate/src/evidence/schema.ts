import type { DependencyInventory } from './dependencies.ts';
import type {
  ArtifactHashes,
  GitProvenance,
  ReproducibilityClaim,
  ToolchainProvenance,
} from './provenance.ts';
import type { ContrastEvidence, StoriesAxeEvidence, VitestAxeEvidence } from './wcag.ts';

/**
 * evidence.json — the machine layer of the compliance evidence pack (M6).
 * One schema, versioned. Bump MAJOR on breaking shape changes.
 */
export const EVIDENCE_SCHEMA_VERSION = '1.0.0';

export interface EvidenceGauntletSection {
  /** Always "fresh" — the gauntlet is executed during evidence generation, never copied. */
  executed: 'fresh';
  passed: boolean;
  steps: { step: string; status: string }[];
  fabrications: number;
  artifact: string;
}

export interface EvidenceEvalsSection {
  executed: 'fresh';
  ok: boolean;
  overall: number;
  critical: number;
  passed: number;
  total: number;
  artifact: string;
}

export interface EvidenceDoc {
  schemaVersion: string;
  generatedAt: string;
  tool: string;
  provenance: {
    git: GitProvenance;
    toolchain: ToolchainProvenance;
    artifacts: ArtifactHashes;
    reproducibility: ReproducibilityClaim[];
    registryCounts: { tokens: number; components: number };
    artifact: string;
  };
  gauntlet: EvidenceGauntletSection;
  evals: EvidenceEvalsSection;
  wcag: {
    contrast: ContrastEvidence & { artifact: string };
    storiesAxe: (Omit<StoriesAxeEvidence, 'resultsFile'> & { artifact: string }) | null;
    vitestAxe: VitestAxeEvidence & { artifact: string };
  };
  dependencies: DependencyInventory & { artifact: string };
}

type Check = { path: string; ok: boolean };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Structural validation of an evidence document. Deterministic, dependency-
 * free (no JSON-schema library): returns the list of failed paths, empty on
 * success. Used by the tests AND as a self-check at the end of generation.
 */
export function validateEvidenceDoc(doc: unknown): string[] {
  const errors: string[] = [];
  const need = (path: string, ok: boolean): void => {
    if (!ok) errors.push(path);
  };
  if (!isRecord(doc)) return ['(root): not an object'];

  need('schemaVersion', typeof doc['schemaVersion'] === 'string' && /^\d+\.\d+\.\d+$/.test(doc['schemaVersion'] as string));
  need('generatedAt', typeof doc['generatedAt'] === 'string' && !Number.isNaN(Date.parse(doc['generatedAt'] as string)));
  need('tool', typeof doc['tool'] === 'string');

  const prov = doc['provenance'];
  need('provenance', isRecord(prov));
  if (isRecord(prov)) {
    const gitChecks: Check[] = [
      { path: 'provenance.git.sha', ok: isRecord(prov['git']) && typeof (prov['git'] as Record<string, unknown>)['sha'] === 'string' },
      { path: 'provenance.git.dirty', ok: isRecord(prov['git']) && typeof (prov['git'] as Record<string, unknown>)['dirty'] === 'boolean' },
      { path: 'provenance.toolchain.node', ok: isRecord(prov['toolchain']) && typeof (prov['toolchain'] as Record<string, unknown>)['node'] === 'string' },
      { path: 'provenance.artifacts.registries', ok: isRecord(prov['artifacts']) && Array.isArray((prov['artifacts'] as Record<string, unknown>)['registries']) },
      { path: 'provenance.reproducibility', ok: Array.isArray(prov['reproducibility']) },
      { path: 'provenance.artifact', ok: typeof prov['artifact'] === 'string' },
    ];
    for (const c of gitChecks) need(c.path, c.ok);
    if (Array.isArray(prov['reproducibility'])) {
      for (const [i, claim] of (prov['reproducibility'] as unknown[]).entries()) {
        need(
          `provenance.reproducibility[${i}]`,
          isRecord(claim) &&
            typeof claim['claim'] === 'string' &&
            typeof claim['test'] === 'string' &&
            typeof claim['title'] === 'string' &&
            typeof claim['verified'] === 'boolean',
        );
      }
    }
  }

  const gauntlet = doc['gauntlet'];
  need('gauntlet', isRecord(gauntlet));
  if (isRecord(gauntlet)) {
    need('gauntlet.executed', gauntlet['executed'] === 'fresh');
    need('gauntlet.passed', gauntlet['passed'] === true); // a pack from a failing gauntlet must not exist
    need('gauntlet.steps', Array.isArray(gauntlet['steps']) && (gauntlet['steps'] as unknown[]).length > 0);
    need('gauntlet.fabrications', typeof gauntlet['fabrications'] === 'number');
    need('gauntlet.artifact', typeof gauntlet['artifact'] === 'string');
  }

  const evals = doc['evals'];
  need('evals', isRecord(evals));
  if (isRecord(evals)) {
    need('evals.executed', evals['executed'] === 'fresh');
    need('evals.ok', typeof evals['ok'] === 'boolean');
    need('evals.overall', typeof evals['overall'] === 'number');
    need('evals.critical', typeof evals['critical'] === 'number');
    need('evals.total', typeof evals['total'] === 'number');
    need('evals.artifact', typeof evals['artifact'] === 'string');
  }

  const wcag = doc['wcag'];
  need('wcag', isRecord(wcag));
  if (isRecord(wcag)) {
    const contrast = wcag['contrast'];
    need('wcag.contrast', isRecord(contrast));
    if (isRecord(contrast)) {
      need('wcag.contrast.standard', typeof contrast['standard'] === 'string');
      need('wcag.contrast.failures', typeof contrast['failures'] === 'number');
      need('wcag.contrast.pairs', Array.isArray(contrast['pairs']));
      need('wcag.contrast.artifact', typeof contrast['artifact'] === 'string');
    }
    const sa = wcag['storiesAxe'];
    need('wcag.storiesAxe', sa === null || isRecord(sa));
    if (isRecord(sa)) {
      need('wcag.storiesAxe.source', sa['source'] === 'fresh-run' || sa['source'] === 'committed');
      need('wcag.storiesAxe.stories', typeof sa['stories'] === 'number');
      need('wcag.storiesAxe.staleness', isRecord(sa['staleness']) && typeof (sa['staleness'] as Record<string, unknown>)['ageDays'] === 'number');
      need('wcag.storiesAxe.artifact', typeof sa['artifact'] === 'string');
    }
    const va = wcag['vitestAxe'];
    need('wcag.vitestAxe', isRecord(va));
    if (isRecord(va)) {
      need('wcag.vitestAxe.componentsTotal', typeof va['componentsTotal'] === 'number');
      need('wcag.vitestAxe.components', Array.isArray(va['components']));
      need('wcag.vitestAxe.artifact', typeof va['artifact'] === 'string');
    }
  }

  const deps = doc['dependencies'];
  need('dependencies', isRecord(deps));
  if (isRecord(deps)) {
    need('dependencies.lockfileVersion', typeof deps['lockfileVersion'] === 'string');
    need('dependencies.packages', Array.isArray(deps['packages']));
    need('dependencies.entries', Array.isArray(deps['entries']));
    need(
      'dependencies.licenses',
      isRecord(deps['licenses']) && typeof (deps['licenses'] as Record<string, unknown>)['unknown'] === 'number',
    );
    need('dependencies.artifact', typeof deps['artifact'] === 'string');
  }

  return errors;
}
