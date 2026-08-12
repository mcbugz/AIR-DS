import type { NegativeRule, RuleCatalog } from './types.ts';

/**
 * Parse docs/specs/negative-rules.md — the machine-parseable living catalog.
 * One `## NR-### Title` section per rule with `- **Wrong:**` / `- **Right:**`
 * / optional `- **Why:**` bullets; the shipped preamble lives in a
 * `> Preamble …: "…"` blockquote.
 */
export function parseNegativeRules(md: string): RuleCatalog {
  const preambleMatch = md.match(/^>\s*Preamble[^"]*"([\s\S]*?)"\s*$/m);
  if (!preambleMatch || !preambleMatch[1]) {
    throw new Error('negative-rules.md: could not find the shipped preamble blockquote');
  }
  const preamble = preambleMatch[1].replace(/\s+/g, ' ').trim();

  const rules: NegativeRule[] = [];
  const sections = md.split(/^## +/m).slice(1);
  for (const section of sections) {
    const lines = section.split('\n');
    const heading = (lines[0] ?? '').trim();
    const headMatch = heading.match(/^(NR-\d+)\s+(.*)$/);
    if (!headMatch || !headMatch[1] || !headMatch[2]) continue;
    const id = headMatch[1];
    const title = headMatch[2].trim();

    const fields: Record<string, string> = {};
    let current: string | null = null;
    for (const line of lines.slice(1)) {
      const bullet = line.match(/^- \*\*(Wrong|Right|Why):\*\*\s*(.*)$/);
      if (bullet && bullet[1] !== undefined && bullet[2] !== undefined) {
        current = bullet[1].toLowerCase();
        fields[current] = bullet[2].trim();
      } else if (current && line.trim() !== '' && !line.startsWith('##')) {
        fields[current] = `${fields[current]} ${line.trim()}`.trim();
      } else if (line.trim() === '') {
        current = null;
      }
    }
    const wrong = fields['wrong'];
    const right = fields['right'];
    if (!wrong || !right) {
      throw new Error(`negative-rules.md: rule ${id} is missing a Wrong or Right bullet`);
    }
    rules.push({ id, title, wrong, right, why: fields['why'] ?? null });
  }
  if (rules.length === 0) throw new Error('negative-rules.md: no NR-* rules parsed');
  rules.sort((a, b) => a.id.localeCompare(b.id));
  return { preamble, rules };
}
