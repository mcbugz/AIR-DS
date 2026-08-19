/**
 * <ds-button> — framework-free push button mirroring the @ds/react Button
 * API (variant / size / loading / disabled).
 *
 * Accessibility model: the shadow root wraps a NATIVE <button type="button">,
 * so keyboard activation (Enter/Space), focusability, and disabled semantics
 * are the platform's own — never hand-rolled (CLAUDE.md rule 7, translated to
 * a runtime with no React Aria). `loading` mirrors the React isLoading
 * contract: the control stays focusable but announces aria-busy +
 * aria-disabled and suppresses activation.
 *
 * Closed world: attribute vocabularies come from the manifest (the same
 * source registries/wc-index.json is generated from); unlisted values fall
 * back to the documented defaults instead of inventing new states.
 */

import { BUTTON_CSS } from "./button.css.ts";
import {
  BUTTON_DEFAULT_SIZE,
  BUTTON_DEFAULT_VARIANT,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  type ButtonSize,
  type ButtonVariant,
} from "./manifest.ts";
import { SharedSheet, tokenSheet } from "./styles.ts";

const buttonSheet = new SharedSheet("ds-button", BUTTON_CSS);

function parseEnum<T extends string>(raw: string | null, values: readonly T[], fallback: T): T {
  return raw !== null && (values as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export class DsButton extends HTMLElement {
  static readonly observedAttributes: readonly string[] = ["variant", "size", "loading", "disabled"];

  readonly #root: ShadowRoot;
  readonly #button: HTMLButtonElement;
  readonly #spinner: HTMLSpanElement;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open", delegatesFocus: true });

    this.#button = this.ownerDocument.createElement("button");
    this.#button.type = "button";
    this.#button.setAttribute("part", "button");

    this.#spinner = this.ownerDocument.createElement("span");
    this.#spinner.className = "spinner";
    this.#spinner.setAttribute("part", "spinner");
    this.#spinner.setAttribute("aria-hidden", "true");

    this.#button.appendChild(this.ownerDocument.createElement("slot"));
    this.#root.appendChild(this.#button);

    // Loading suppresses activation for BOTH pointer and keyboard input: the
    // native button synthesizes a click for Enter/Space, so one capture-phase
    // guard covers every activation path before any outside listener runs.
    this.#button.addEventListener(
      "click",
      (event) => {
        if (this.loading) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      { capture: true },
    );

    this.#sync();
  }

  connectedCallback(): void {
    tokenSheet.adoptInto(this.#root);
    buttonSheet.adoptInto(this.#root);
    this.#sync();
  }

  disconnectedCallback(): void {
    tokenSheet.releaseFrom(this.#root);
    buttonSheet.releaseFrom(this.#root);
  }

  attributeChangedCallback(): void {
    this.#sync();
  }

  /** Visual intent; unlisted attribute values read back as the default. */
  get variant(): ButtonVariant {
    return parseEnum(this.getAttribute("variant"), BUTTON_VARIANTS, BUTTON_DEFAULT_VARIANT);
  }

  set variant(value: ButtonVariant) {
    this.setAttribute("variant", value);
  }

  get size(): ButtonSize {
    return parseEnum(this.getAttribute("size"), BUTTON_SIZES, BUTTON_DEFAULT_SIZE);
  }

  set size(value: ButtonSize) {
    this.setAttribute("size", value);
  }

  get loading(): boolean {
    return this.hasAttribute("loading");
  }

  set loading(value: boolean) {
    this.toggleAttribute("loading", value);
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }

  set disabled(value: boolean) {
    this.toggleAttribute("disabled", value);
  }

  /** The inner native button (test/debug hook; styling goes via ::part). */
  get buttonElement(): HTMLButtonElement {
    return this.#button;
  }

  #sync(): void {
    const loading = this.loading;
    this.#button.className = [this.variant, this.size, loading ? "loading" : null]
      .filter((c): c is string => c !== null)
      .join(" ");

    this.#button.disabled = this.disabled;

    if (loading) {
      this.#button.setAttribute("aria-busy", "true");
      this.#button.setAttribute("aria-disabled", "true");
      if (this.#spinner.parentNode === null) this.#button.prepend(this.#spinner);
    } else {
      this.#button.removeAttribute("aria-busy");
      this.#button.removeAttribute("aria-disabled");
      this.#spinner.remove();
    }
  }
}

/** Idempotent registration; call with a custom registry for scoped setups. */
export function defineDsButton(registry: CustomElementRegistry = customElements): void {
  if (registry.get("ds-button") === undefined) {
    registry.define("ds-button", DsButton);
  }
}
