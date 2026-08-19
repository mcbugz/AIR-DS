/**
 * @ds/genui — the generative-UI runtime contract.
 *
 * Browser-safe entry point: the schema types, the deterministic validator,
 * and the fail-closed renderer. Registry LOADING from disk lives in the CLI
 * only (`ds-genui validate <file>`); hosts pass registries in as data.
 */

export {
  GENUI_VERSION,
  LIMITS,
  type ComponentNode,
  type LayoutNode,
  type TextNode,
  type GenUINode,
  type GenUIChild,
  type GenUIScreenDoc,
  type GenUIDocument,
  type GenUIError,
  type GenUIValidationResult,
  type GenUIBindings,
} from './schema.js';

export type {
  ComponentsIndex,
  ComponentEntry,
  PropEntry,
  TokensIndex,
  TokenEntry,
  GenUIRegistries,
} from './registryTypes.js';

export { validateDocument } from './validate.js';

export {
  GenUIScreen,
  GenUIValidationError,
  buildComponentMap,
  type GenUIScreenProps,
} from './GenUIScreen.js';

export { INTENT_EVENTS, type IntentTarget } from './intents.js';

export {
  deriveLayoutVocabulary,
  TEXT_ROLES,
  TEXT_ROLE_NAMES,
  LAYOUT_KINDS,
  ALIGN_VALUES,
  GRID_COLUMNS,
  type LayoutVocabulary,
  type TextRoleSpec,
} from './vocab.js';

export { buildSurfaces, buildSurface, GLOBAL_PROPS, type ComponentSurface } from './surface.js';
