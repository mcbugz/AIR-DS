/**
 * Deterministic keyword/fuzzy search over the loaded registries.
 * Pure lexical scoring — token overlap with prefix bonuses. No LLM anywhere
 * (CLAUDE.md rule 9 / ADR-005).
 */

import type { Registry } from './registry.js';

export type SearchKind = 'component' | 'token' | 'prop';

export interface SearchHit {
  kind: SearchKind;
  name: string;
  score: number;
  snippet: string;
}

interface IndexEntry {
  kind: SearchKind;
  name: string;
  nameTokens: string[];
  textTokens: string[];
  snippet: string;
}

function tokenize(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase boundaries
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function clip(text: string, max = 180): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

export function buildSearchIndex(registry: Registry): IndexEntry[] {
  const entries: IndexEntry[] = [];

  for (const c of registry.components.components) {
    entries.push({
      kind: 'component',
      name: c.name,
      nameTokens: tokenize(c.name),
      textTokens: tokenize(`${c.name} ${c.description} ${c.racBase ?? ''}`),
      snippet: clip(c.description),
    });
    for (const p of c.props) {
      entries.push({
        kind: 'prop',
        name: `${c.name}.${p.name}`,
        nameTokens: tokenize(`${c.name} ${p.name}`),
        textTokens: tokenize(`${c.name} ${p.name} ${p.type} ${p.description}`),
        snippet: clip(`${p.type}${p.description ? ` — ${p.description}` : ''}`),
      });
    }
  }

  for (const t of registry.tokens.tokens) {
    entries.push({
      kind: 'token',
      name: t.cssVar,
      nameTokens: tokenize(`${t.name} ${t.cssVar}`),
      textTokens: tokenize(`${t.name} ${t.cssVar} ${t.tier} ${t.type} ${t.description}`),
      snippet: clip(`${t.description} (resolved: ${t.value})`),
    });
  }

  return entries;
}

function scoreEntry(entry: IndexEntry, terms: string[]): number {
  let score = 0;
  for (const term of terms) {
    let best = 0;
    for (const nt of entry.nameTokens) {
      if (nt === term) best = Math.max(best, 5);
      else if (nt.startsWith(term)) best = Math.max(best, 3);
    }
    if (best < 5) {
      for (const tt of entry.textTokens) {
        if (tt === term) best = Math.max(best, 2);
        else if (tt.startsWith(term)) best = Math.max(best, 1);
      }
    }
    score += best;
  }
  return score;
}

export function searchDocs(index: IndexEntry[], query: string, limit = 20): SearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  return index
    .map((entry) => ({
      kind: entry.kind,
      name: entry.name,
      score: scoreEntry(entry, terms),
      snippet: entry.snippet,
    }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}
