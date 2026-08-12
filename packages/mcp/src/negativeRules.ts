/**
 * Runtime parser for `docs/specs/negative-rules.md` — the living wrong→right
 * hallucination catalog. Parsed at startup (never copied into code) so the
 * validator's messages stay in sync with the catalog; the vitest suite parses
 * the same file to prove it.
 *
 * Resolution: `--rules-file` flag → DS_NEGATIVE_RULES env →
 * `<repoRoot>/docs/specs/negative-rules.md` (repoRoot = registryDir/..).
 * Shipped per-customer builds may place the file alongside the registries as
 * `<registryDir>/negative-rules.md`.
 */

import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

export interface NegativeRule {
  id: string; // "NR-001"
  title: string; // "Layout primitives do not exist"
  wrong: string; // raw markdown of the Wrong bullet
  right: string; // raw markdown of the Right bullet
  why: string | null;
  /** backtick code spans extracted from the Wrong / Right bullets */
  wrongSnippets: string[];
  rightSnippets: string[];
}

export interface NegativeRuleCatalog {
  sourceFile: string | null;
  preamble: string | null;
  rules: Map<string, NegativeRule>;
}

function codeSpans(markdown: string): string[] {
  const spans: string[] = [];
  const re = /`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) spans.push(m[1] as string);
  return spans;
}

export function parseNegativeRules(markdown: string, sourceFile: string | null): NegativeRuleCatalog {
  const rules = new Map<string, NegativeRule>();
  const preambleMatch = /^>\s*(.+)$/m.exec(markdown);
  const sections = markdown.split(/^## /m).slice(1);
  for (const section of sections) {
    const header = /^(NR-\d+)\s+(.+)$/m.exec(section);
    if (!header) continue;
    const wrong = /\*\*Wrong:\*\*\s*([^\n]+)/.exec(section)?.[1]?.trim() ?? '';
    const right = /\*\*Right:\*\*\s*([^\n]+)/.exec(section)?.[1]?.trim() ?? '';
    const why = /\*\*Why:\*\*\s*([^\n]+)/.exec(section)?.[1]?.trim() ?? null;
    rules.set(header[1] as string, {
      id: header[1] as string,
      title: (header[2] as string).trim(),
      wrong,
      right,
      why,
      wrongSnippets: codeSpans(wrong),
      rightSnippets: codeSpans(right),
    });
  }
  return { sourceFile, preamble: preambleMatch?.[1]?.trim() ?? null, rules };
}

export function resolveNegativeRulesFile(registryDir: string, explicit?: string): string | null {
  const candidates = [
    explicit,
    process.env['DS_NEGATIVE_RULES'],
    path.join(registryDir, 'negative-rules.md'),
    path.resolve(registryDir, '..', 'docs', 'specs', 'negative-rules.md'),
  ].filter((c): c is string => Boolean(c));
  for (const candidate of candidates) {
    const abs = path.resolve(candidate);
    if (existsSync(abs)) return abs;
  }
  return null;
}

export function loadNegativeRules(registryDir: string, explicit?: string): NegativeRuleCatalog {
  const file = resolveNegativeRulesFile(registryDir, explicit);
  if (!file) return { sourceFile: null, preamble: null, rules: new Map() };
  return parseNegativeRules(readFileSync(file, 'utf8'), file);
}

/** Compose the shipped violation message for a rule id (falls back when the catalog file is absent). */
export function ruleMessage(catalog: NegativeRuleCatalog, id: string, fallback: string): string {
  const rule = catalog.rules.get(id);
  if (!rule) return `${id}: ${fallback}`;
  return `${rule.id} ${rule.title} — wrong: ${rule.wrong} → right: ${rule.right}`;
}

/** The Right-hand guidance for a rule, used as the `fix` field. */
export function ruleFix(catalog: NegativeRuleCatalog, id: string, fallback: string): string {
  return catalog.rules.get(id)?.right ?? fallback;
}
