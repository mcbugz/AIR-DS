/**
 * @ds/wc — AIR-DS web components.
 *
 * Importing this entry registers the elements (idempotently) when a DOM is
 * present; Node-side consumers (the registry generator) import ./manifest.ts
 * directly and never touch the DOM-dependent modules.
 */

export { DsButton, defineDsButton } from "./ds-button.ts";
export { provideTokenStyles, supportsConstructableSheets, tokenSheet, SharedSheet } from "./styles.ts";
export {
  WC_MANIFEST,
  BUTTON_VARIANTS,
  BUTTON_SIZES,
  BUTTON_DEFAULT_VARIANT,
  BUTTON_DEFAULT_SIZE,
  type ButtonVariant,
  type ButtonSize,
  type WcComponentSpec,
  type WcAttributeSpec,
  type WcEventSpec,
  type WcCssPartSpec,
} from "./manifest.ts";

import { defineDsButton } from "./ds-button.ts";

if (typeof customElements !== "undefined") {
  defineDsButton();
}
