/**
 * Shadow-DOM stylesheet plumbing.
 *
 * Primary path: constructable stylesheets — one shared CSSStyleSheet per
 * concern (the brand token build, each component's recipe) adopted into every
 * component shadow root via adoptedStyleSheets. `replaceSync` on the shared
 * sheet restyles every adopter at once, which is exactly the white-label
 * mechanism: swapping the brand is one sheet swap, zero component changes.
 *
 * Fallback path (documented, tested): engines without constructable
 * stylesheets get a plain <style> element per shadow root, kept in sync
 * through the same SharedSheet handle.
 */

export function supportsConstructableSheets(): boolean {
  try {
    return (
      typeof CSSStyleSheet !== "undefined" &&
      typeof CSSStyleSheet.prototype.replaceSync === "function" &&
      typeof ShadowRoot !== "undefined" &&
      "adoptedStyleSheets" in ShadowRoot.prototype
    );
  } catch {
    return false;
  }
}

export class SharedSheet {
  /** data-* marker on fallback <style> elements, and a debugging label. */
  readonly marker: string;
  #text: string;
  #sheet: CSSStyleSheet | null = null;
  readonly #roots = new Set<ShadowRoot>();

  constructor(marker: string, text = "") {
    this.marker = marker;
    this.#text = text;
  }

  get text(): string {
    return this.#text;
  }

  /** Replace the CSS. Every adopted shadow root restyles immediately. */
  setText(text: string): void {
    this.#text = text;
    if (this.#ensureSheet() !== null) {
      (this.#sheet as CSSStyleSheet).replaceSync(text);
      return;
    }
    for (const root of this.#roots) this.#syncFallbackStyle(root);
  }

  /** Adopt into a shadow root (adoptedStyleSheets, or the <style> fallback). */
  adoptInto(root: ShadowRoot): void {
    this.#roots.add(root);
    const sheet = this.#ensureSheet();
    if (sheet !== null) {
      if (!root.adoptedStyleSheets.includes(sheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      }
      return;
    }
    this.#syncFallbackStyle(root);
  }

  /** Release a shadow root (component disconnected). */
  releaseFrom(root: ShadowRoot): void {
    this.#roots.delete(root);
    if (this.#sheet !== null) {
      root.adoptedStyleSheets = root.adoptedStyleSheets.filter((s) => s !== this.#sheet);
      return;
    }
    root.querySelector(`style[data-ds-sheet="${this.marker}"]`)?.remove();
  }

  #ensureSheet(): CSSStyleSheet | null {
    if (this.#sheet !== null) return this.#sheet;
    if (!supportsConstructableSheets()) return null;
    this.#sheet = new CSSStyleSheet();
    this.#sheet.replaceSync(this.#text);
    return this.#sheet;
  }

  #syncFallbackStyle(root: ShadowRoot): void {
    let el = root.querySelector<HTMLStyleElement>(`style[data-ds-sheet="${this.marker}"]`);
    if (el === null) {
      el = root.ownerDocument.createElement("style");
      el.setAttribute("data-ds-sheet", this.marker);
      // Prepend so component rules appended later stay after token defs.
      root.prepend(el);
    }
    el.textContent = this.#text;
  }
}

/**
 * The shared brand-token sheet. Feed it the Shadow-DOM token build
 * (packages/tokens/dist/wc/tokens.css — `:host, :root` scoped) and every
 * @ds/wc component adopts it inside its shadow root. Calling it again with a
 * different brand's build restyles every component instance live — the same
 * stylesheet-swap trick as the web build, one shadow boundary deeper.
 *
 * Optional: when the host page links a tokens.css at document level instead,
 * the custom properties inherit across the shadow boundary and this sheet can
 * stay empty.
 */
export const tokenSheet: SharedSheet = new SharedSheet("ds-tokens");

export function provideTokenStyles(cssText: string): void {
  tokenSheet.setText(cssText);
}
