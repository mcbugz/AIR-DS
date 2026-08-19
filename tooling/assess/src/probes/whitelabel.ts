/**
 * White-label probe: is brand expression isolated in a swappable data tier?
 * Looks for a brands/themes directory of token/theme data files — the
 * "customer = one data file, not a fork" architecture.
 */
import type { RepoScan } from '../walk.ts';

export interface WhiteLabelFindings {
  /** Brand/theme data files found under a brands|themes|theming dir. */
  brandFiles: string[];
  brandDirs: string[];
}

const BRAND_DIR_RE = /^(brands?|themes?|theming|skins?)$/i;
const BRAND_DATA_EXT = new Set(['.json', '.json5', '.yaml', '.yml', '.tokens']);

export function probeWhiteLabel(scan: RepoScan): WhiteLabelFindings {
  const brandFiles: string[] = [];
  const brandDirs = new Set<string>();
  for (const f of scan.files) {
    const idx = f.segs.findIndex((s) => BRAND_DIR_RE.test(s));
    if (idx === -1) continue;
    if (f.segs.includes('node_modules')) continue;
    if (!BRAND_DATA_EXT.has(f.ext) && !f.base.endsWith('.tokens.json')) continue;
    brandFiles.push(f.rel);
    brandDirs.add(f.segs.slice(0, idx + 1).join('/'));
  }
  return { brandFiles, brandDirs: [...brandDirs] };
}
