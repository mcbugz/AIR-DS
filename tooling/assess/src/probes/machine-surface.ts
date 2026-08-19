/**
 * Machine-surface probe (brief practices 3-6): llms.txt family, repo agent
 * files, MCP server, skills, editor rules. Presence + where.
 */
import type { RepoScan } from '../walk.ts';

export interface MachineSurfaceFindings {
  llmsTxt: string | null;
  llmsFull: string | null;
  llmsSlices: number;
  agentFiles: string[];
  rootAgentFile: boolean;
  mcp: string | null;
  skills: string | null;
  editorRules: string[];
}

const AGENT_FILE_RE = /^(AGENTS?\.md|CLAUDE\.md|GEMINI\.md|\.cursorrules|\.windsurfrules|copilot-instructions\.md)$/i;

export function probeMachineSurface(scan: RepoScan): MachineSurfaceFindings {
  const llms = scan.byBase(/^llms\.txt$/i)[0] ?? null;
  const llmsFull = scan.byBase(/^llms-full\.txt$/i)[0] ?? null;
  const llmsSlices = scan.byBase(/^llms-[a-z0-9-]+\.txt$/i).filter((f) => !/^llms-full\.txt$/i.test(f.base)).length;

  const agentFiles = scan.files.filter((f) => AGENT_FILE_RE.test(f.base));
  const rootAgentFile = agentFiles.some((f) => f.segs.length === 0);

  // MCP: project config, an MCP SDK dependency, or a package named *mcp*.
  let mcp: string | null = null;
  const mcpConfig = scan.files.find(
    (f) => /^\.?mcp\.json$/.test(f.base) && f.segs.length <= 2,
  );
  if (mcpConfig !== undefined) mcp = mcpConfig.rel;
  if (mcp === null) {
    for (const f of scan.byBase(/^package\.json$/)) {
      const text = scan.read(f);
      if (text === null) continue;
      if (text.includes('@modelcontextprotocol/')) {
        mcp = f.rel;
        break;
      }
      try {
        const name = (JSON.parse(text) as Record<string, unknown>)['name'];
        if (typeof name === 'string' && /(^|[/@-])mcp([/-]|$)/.test(name)) {
          mcp = f.rel;
          break;
        }
      } catch {
        /* unparseable package.json — skip */
      }
    }
  }

  // Skills: .well-known/skills, SKILL.md routers, or .claude/skills.
  let skills: string | null = null;
  const wellKnown = scan.files.find(
    (f) => f.segs.includes('.well-known') && f.segs.includes('skills'),
  );
  if (wellKnown !== undefined) skills = wellKnown.rel;
  if (skills === null) {
    const skillMd = scan.byBase(/^SKILL\.md$/i)[0];
    if (skillMd !== undefined) skills = skillMd.rel;
  }
  if (skills === null) {
    const claudeSkills = scan.files.find(
      (f) => f.segs.includes('.claude') && f.segs.includes('skills'),
    );
    if (claudeSkills !== undefined) skills = claudeSkills.rel;
  }

  // Editor rules: Cursor .mdc rules, .cursorrules, Copilot instructions, Windsurf.
  const editorRules: string[] = [];
  for (const f of scan.files) {
    const isCursorRule = f.ext === '.mdc' && f.segs.includes('.cursor');
    const isLegacyCursor = f.base === '.cursorrules';
    const isCopilot = /^copilot-instructions\.md$/i.test(f.base);
    const isWindsurf = f.base === '.windsurfrules';
    if (isCursorRule || isLegacyCursor || isCopilot || isWindsurf) editorRules.push(f.rel);
  }

  return {
    llmsTxt: llms?.rel ?? null,
    llmsFull: llmsFull?.rel ?? null,
    llmsSlices,
    agentFiles: agentFiles.map((f) => f.rel),
    rootAgentFile,
    mcp,
    skills,
    editorRules,
  };
}
