/**
 * AIR-DS MCP server assembly. Six tools, all deterministic, all answering
 * from the registries loaded at startup (theme-aware: a per-customer build
 * pointed at its own registry dir answers with that brand's resolved values).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { loadRegistry, nearestNames, tokenCategories, type Registry } from './registry.js';
import { loadNegativeRules, type NegativeRuleCatalog } from './negativeRules.js';
import { buildSearchIndex, searchDocs } from './search.js';
import { validateUsage } from './validate.js';
import { buildChecklist, CHECKLIST_SCOPES, type ChecklistScope } from './checklist.js';
import { buildThemingGuide } from './theming.js';

export interface ServerOptions {
  registryDir?: string;
  rulesFile?: string;
}

export interface DsMcpServer {
  server: McpServer;
  registry: Registry;
  catalog: NegativeRuleCatalog;
}

function jsonResult(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export function createDsMcpServer(options: ServerOptions = {}): DsMcpServer {
  const registry = loadRegistry(options.registryDir);
  const catalog = loadNegativeRules(registry.registryDir, options.rulesFile);
  const searchIndex = buildSearchIndex(registry);

  const server = new McpServer({
    name: 'ds-mcp',
    version: '0.1.0',
  });

  server.registerTool(
    'search_docs',
    {
      title: 'Search design-system docs',
      description:
        'Keyword search over component descriptions, prop names/descriptions, and token names/descriptions of the loaded design system. Returns ranked hits with kind (component | token | prop) and a compact snippet. Deterministic lexical scoring — results enumerate the closed world; anything not returned by the registry tools does not exist.',
      inputSchema: {
        query: z.string().min(1).describe('Search terms, e.g. "danger button hover" or "focus ring"'),
        limit: z.number().int().min(1).max(50).optional().describe('Max hits to return (default 20)'),
      },
    },
    ({ query, limit }) => jsonResult({ query, hits: searchDocs(searchIndex, query, limit ?? 20) }),
  );

  server.registerTool(
    'get_component',
    {
      title: 'Get component contract',
      description:
        "Full machine contract for one registered component: description, react-aria-components base, exact props with literal-union types/defaults, a canonical usage example, and the Storybook story file. Closed world: unknown names error with the list of valid names — never a fuzzy silent match.",
      inputSchema: {
        name: z.string().min(1).describe('Exact component name, e.g. "Button"'),
      },
    },
    ({ name }) => {
      const component = registry.componentByName.get(name);
      if (!component) {
        const valid = registry.components.components.map((c) => c.name);
        return errorResult(
          `Unknown component '${name}'. This design system is closed-world: a component not in the registry does not exist. Did you mean: ${nearestNames(name, valid).join(', ')}? Valid components: ${valid.join(', ')}.`,
        );
      }
      return jsonResult({
        name: component.name,
        description: component.description,
        racBase: component.racBase,
        racBaseNote: component.racBase
          ? `Built on react-aria-components ${component.racBase}: the RAC ${component.racBase} props (e.g. onPress, isDisabled, autoFocus) are ALSO legal on this component, with the props listed here overriding/narrowing them.`
          : 'Static component (no react-aria-components base): only the props listed here plus standard DOM attributes for its element are legal.',
        props: component.props,
        example: component.example,
        storyFile: registry.storyFiles.get(component.name) ?? null,
      });
    },
  );

  server.registerTool(
    'list_tokens',
    {
      title: 'List design tokens',
      description:
        'Enumerate the public design tokens for the ACTIVE brand, with CSS variable name, tier (semantic | component), type, description, and the resolved value. Optionally filter by category (first segment of the token name, e.g. color, space, button) and/or tier. This is the complete closed world: any --ds-* variable not returned is fabricated.',
      inputSchema: {
        category: z.string().optional().describe('Token category, e.g. "color", "space", "button"'),
        tier: z.enum(['semantic', 'component']).optional().describe('Token tier filter'),
      },
    },
    ({ category, tier }) => {
      const categories = tokenCategories(registry);
      if (category !== undefined && !categories.includes(category)) {
        return errorResult(
          `Unknown token category '${category}'. Valid categories: ${categories.join(', ')}.`,
        );
      }
      const tokens = registry.tokens.tokens.filter(
        (t) =>
          (category === undefined || t.name.split('.')[0] === category) &&
          (tier === undefined || t.tier === tier),
      );
      return jsonResult({
        brand: registry.tokens.brand,
        categories,
        count: tokens.length,
        tokens,
      });
    },
  );

  server.registerTool(
    'validate_usage',
    {
      title: 'Validate design-system usage',
      description:
        'Deterministic validation of a code snippet (and optional CSS) against the registries and the negative-rule catalog: fabricated tokens, unregistered/deep-path imports, hallucinated primitives (Box/Stack/Heading/Text), raw color/size literals, space-tokens-as-sizes, cross-component hook borrowing, pseudo-class state selectors, and more. Returns { valid, violations: [{ rule, message, fix }] }. No LLM — every check is a registry lookup or lexical rule.',
      inputSchema: {
        code: z.string().describe('TSX/JS snippet (imports + JSX) to validate'),
        css: z.string().optional().describe('Companion CSS (e.g. the CSS Module source) to validate'),
      },
    },
    ({ code, css }) => jsonResult(validateUsage(registry, catalog, css === undefined ? { code } : { code, css })),
  );

  server.registerTool(
    'audit_checklist',
    {
      title: 'Pre-PR audit checklist',
      description:
        'The deterministic self-check checklist compiled from the negative-rule catalog and the contributing canon: token discipline, registry existence, a11y musts, story/test contract. Run through every item before opening a PR; the validation gauntlet enforces the same rules mechanically.',
      inputSchema: {
        scope: z
          .enum(CHECKLIST_SCOPES as [ChecklistScope, ...ChecklistScope[]])
          .optional()
          .describe('Filter to one category (default "all")'),
      },
    },
    ({ scope }) => jsonResult(buildChecklist(registry, catalog, scope ?? 'all')),
  );

  server.registerTool(
    'get_theming_guide',
    {
      title: 'Theming guide',
      description:
        "The three-tier theming model (brand / semantic / component), the ACTIVE brand's key resolved values, the contrast-report status, and exactly what may and may not be overridden. Values reflect the registries this server was started against.",
      inputSchema: {},
    },
    () => jsonResult(buildThemingGuide(registry)),
  );

  return { server, registry, catalog };
}
