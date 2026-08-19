/**
 * ASSESSMENT.md renderer — executive-readable: grade, fabrication exposure,
 * pillar table, top-5 gaps with risk framing and the AIR-DS capability that
 * closes each, quick wins, then the full evidence appendix.
 */
import type { Assessment, PillarResult } from './types.ts';

const GRADE_FRAMING: Record<string, string> = {
  A: 'This codebase is AI-ready: agents operating here can discover what exists, are constrained to it, and their output is deterministically gated. The remaining items below are polish, not risk.',
  B: 'Strong foundations with specific, closable gaps. Agents can mostly discover the system, but at least one layer (context, enforcement, or contracts) still relies on convention instead of structure.',
  C: 'Partially AI-ready. Human engineers compensate for missing machine surface today; AI agents will not. Expect fabricated tokens/components and inconsistent output until the gaps below are closed.',
  D: 'Largely AI-unready. Agents working in this repo are guessing: little is enumerable, little is enforced. AI-generated UI here is currently ungoverned output.',
  F: 'Not AI-ready. There is no machine-readable contract for agents to follow and no deterministic gate to stop what they produce. Every AI-generated screen is an unreviewed liability.',
};

const ONBOARDING =
  'This directory contains no assessable design-system material yet. That is the cheapest possible moment to start AI-ready: adopting a token-driven, registry-backed, machine-readable system from day one costs a fraction of retrofitting it later. AIR-DS ships that starting point — tokens, typed components, compiled agent context, and a deterministic validation gauntlet — as one white-labelable package.';

function pct(n: number): string {
  return `${Math.round(n * 10) / 10}`;
}

function pillarRow(p: PillarResult): string {
  const practices = p.practices.map((n) => `#${n}`).join(' ');
  return `| ${p.name} | **${pct(p.score)}** / 100 | ${p.weight}% | ${practices} |`;
}

export function renderMarkdown(a: Assessment): string {
  const lines: string[] = [];
  const empty = a.filesScanned === 0;
  lines.push('# AI-Readiness Assessment');
  lines.push('');
  lines.push(
    `**Repo:** \`${a.scannedPath}\` · **Files scanned:** ${a.filesScanned} · **Tool:** ${a.tool} v${a.version} · **Date:** ${a.timestamp.slice(0, 10)}`,
  );
  lines.push('');
  lines.push(`## Grade: ${a.overall.grade} — ${pct(a.overall.score)} / 100`);
  lines.push('');
  lines.push(empty ? ONBOARDING : (GRADE_FRAMING[a.overall.grade] as string));
  lines.push('');

  if (!empty) {
    lines.push('## Fabrication exposure');
    lines.push('');
    const f = a.fabrication;
    if (f.ratio === null) {
      lines.push(
        'No token-relevant style code was found to sample. Exposure is unmeasurable — meaning nothing constrains what an AI agent hard-codes here.',
      );
    } else {
      const p = Math.round(f.ratio * 1000) / 10;
      lines.push(
        `**${p}% of style values are hard-coded** (${f.hardcoded} hard-coded values vs ${f.variableRefs} design-variable references across ${f.sampledFiles} sampled style files).`,
      );
      lines.push('');
      lines.push(
        f.ratio <= 0.05
          ? 'Styles flow through design variables almost everywhere — re-theming is a data change and agents have real token names to consume.'
          : f.ratio <= 0.3
            ? 'A meaningful share of styling bypasses the token layer. Each hard-coded value is invisible to theming and teaches agents that literals pass review.'
            : 'Styling is predominantly hard-coded. Nothing constrains an AI agent to your design language, and any re-brand is a codebase-wide audit.',
      );
      if (f.worstFiles.length > 0) {
        lines.push('');
        lines.push('Worst offenders:');
        for (const w of f.worstFiles) {
          lines.push(`- \`${w.path}\` — ${w.hardcoded} hard-coded vs ${w.variableRefs} variable refs`);
        }
      }
    }
    lines.push('');
  }

  lines.push('## Pillars');
  lines.push('');
  lines.push('| Pillar | Score | Weight | Brief §5 practices |');
  lines.push('|---|---|---|---|');
  for (const p of a.pillars) lines.push(pillarRow(p));
  lines.push('');

  if (a.gaps.length > 0) {
    lines.push(`## Top ${a.gaps.length} gaps`);
    lines.push('');
    a.gaps.forEach((g, i) => {
      lines.push(`### ${i + 1}. ${g.title}`);
      lines.push('');
      lines.push(`*Costing ${pct(g.lostPoints)} of 100 overall points.*`);
      lines.push('');
      lines.push(`**Risk:** ${g.risk}`);
      lines.push('');
      lines.push(`**Closed by:** ${g.closedBy}`);
      lines.push('');
    });
  }

  if (a.quickWins.length > 0) {
    lines.push('## Quick wins');
    lines.push('');
    for (const q of a.quickWins) {
      lines.push(`- **${q.title}** — ${q.action} *(recovers up to ${pct(q.lostPoints)} points)*`);
    }
    lines.push('');
  }

  lines.push('## Evidence appendix');
  lines.push('');
  for (const p of a.pillars) {
    lines.push(`### ${p.name} — ${pct(p.score)} / 100 (weight ${p.weight}%)`);
    lines.push('');
    lines.push('| Check | Earned | Weight | Evidence |');
    lines.push('|---|---|---|---|');
    for (const c of p.checks) {
      const ev = c.evidence
        .map((e) => (e.path === undefined ? e.detail : `${e.detail} (\`${e.path}\`)`))
        .join('; ')
        .replace(/\|/g, '\\|');
      lines.push(`| ${c.id} ${c.title} | ${pct(c.earned)} | ${c.weight} | ${ev} |`);
    }
    lines.push('');
  }

  lines.push('## Method');
  lines.push('');
  lines.push(
    'Deterministic static scan of the local path only: no network, no credentials, no LLM. ' +
      'Six pillars map to the ten practices of the AIR-DS project brief (§5); each pillar score is a weighted sum of file-evidence checks, and the overall score is the pillar-weighted total. ' +
      'Hard-coded-value verdicts reuse the exact allowed-literal ruleset of the AIR-DS validation gauntlet (@ds/validate), so this report and the merge gate cannot disagree. ' +
      'Generated output (dist/build), tests, fixtures, and demos are excluded from style sampling; token-definition files are excluded from the fabrication ratio (defining raw values is their job).',
  );
  lines.push('');
  return lines.join('\n');
}
