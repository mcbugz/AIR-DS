/**
 * <ds-button> behavior: attribute -> state mapping, activation semantics,
 * disabled/loading contracts, and the stylesheet plumbing (adoptedStyleSheets
 * plus the constructable-stylesheet fallback).
 *
 * Keyboard activation note: the element renders a NATIVE <button>, so
 * Enter/Space activation is the platform's own behavior (happy-dom does not
 * synthesize keyboard clicks, real browsers do). The tests therefore assert
 * the structural guarantee — a real HTMLButtonElement in the activation path
 * — and that the loading/disabled guards sit on the click event itself, which
 * is the funnel BOTH pointer and keyboard activation pass through.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { DsButton, defineDsButton, provideTokenStyles, tokenSheet, SharedSheet } from "../src/index.ts";
import { BUTTON_SIZES, BUTTON_VARIANTS } from "../src/manifest.ts";

defineDsButton();

function mount(html: string): DsButton {
  document.body.innerHTML = html;
  const el = document.body.querySelector("ds-button");
  if (!(el instanceof DsButton)) throw new Error("ds-button did not upgrade");
  return el;
}

function inner(el: DsButton): HTMLButtonElement {
  const b = el.shadowRoot?.querySelector("button");
  if (b === null || b === undefined) throw new Error("no inner button");
  return b;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("registration", () => {
  it("defines ds-button exactly once (idempotent)", () => {
    expect(customElements.get("ds-button")).toBe(DsButton);
    expect(() => defineDsButton()).not.toThrow();
  });
});

describe("attribute -> state mapping", () => {
  it("defaults to variant=primary size=md", () => {
    const el = mount("<ds-button>Save</ds-button>");
    expect(el.variant).toBe("primary");
    expect(el.size).toBe("md");
    expect(inner(el).className).toBe("primary md");
  });

  it("maps every manifest-enumerated variant and size to the inner classes", () => {
    for (const variant of BUTTON_VARIANTS) {
      for (const size of BUTTON_SIZES) {
        const el = mount(`<ds-button variant="${variant}" size="${size}">x</ds-button>`);
        expect(inner(el).className).toBe(`${variant} ${size}`);
        expect(el.variant).toBe(variant);
        expect(el.size).toBe(size);
      }
    }
  });

  it("closed world: unlisted attribute values fall back to the defaults", () => {
    const el = mount('<ds-button variant="tertiary" size="xl">x</ds-button>');
    expect(el.variant).toBe("primary");
    expect(el.size).toBe("md");
    expect(inner(el).className).toBe("primary md");
  });

  it("reflects property writes back to attributes and re-syncs", () => {
    const el = mount("<ds-button>x</ds-button>");
    el.variant = "danger";
    el.size = "lg";
    expect(el.getAttribute("variant")).toBe("danger");
    expect(el.getAttribute("size")).toBe("lg");
    expect(inner(el).className).toBe("danger lg");
    el.loading = true;
    expect(el.hasAttribute("loading")).toBe(true);
    el.disabled = true;
    expect(el.hasAttribute("disabled")).toBe(true);
  });

  it("responds to attribute mutation after mount", () => {
    const el = mount("<ds-button>x</ds-button>");
    el.setAttribute("variant", "ghost");
    expect(inner(el).className).toBe("ghost md");
    el.removeAttribute("variant");
    expect(inner(el).className).toBe("primary md");
  });
});

describe("activation semantics (native <button> is the keyboard guarantee)", () => {
  it("renders a native <button type=button> with part=button in the activation path", () => {
    const el = mount("<ds-button>x</ds-button>");
    const b = inner(el);
    expect(b).toBeInstanceOf(HTMLButtonElement);
    expect(b.type).toBe("button");
    expect(b.getAttribute("part")).toBe("button");
  });

  it("clicks (pointer or keyboard-synthesized) reach host listeners", () => {
    const el = mount("<ds-button>x</ds-button>");
    let clicks = 0;
    el.addEventListener("click", () => {
      clicks += 1;
    });
    inner(el).click();
    expect(clicks).toBe(1);
  });

  it("projects its label through a slot inside the button", () => {
    const el = mount("<ds-button>Save changes</ds-button>");
    expect(inner(el).querySelector("slot")).not.toBeNull();
    expect(el.textContent).toContain("Save changes");
  });
});

describe("disabled semantics", () => {
  it("mirrors the disabled attribute onto the native button", () => {
    const el = mount("<ds-button disabled>x</ds-button>");
    expect(inner(el).disabled).toBe(true);
    el.removeAttribute("disabled");
    expect(inner(el).disabled).toBe(false);
  });

  it("suppresses activation entirely while disabled", () => {
    const el = mount("<ds-button disabled>x</ds-button>");
    let clicks = 0;
    el.addEventListener("click", () => {
      clicks += 1;
    });
    inner(el).click();
    expect(clicks).toBe(0);
  });
});

describe("loading semantics (mirrors React isLoading)", () => {
  it("sets aria-busy + aria-disabled but keeps native disabled off (stays focusable)", () => {
    const el = mount("<ds-button loading>x</ds-button>");
    const b = inner(el);
    expect(b.getAttribute("aria-busy")).toBe("true");
    expect(b.getAttribute("aria-disabled")).toBe("true");
    expect(b.disabled).toBe(false);
  });

  it("shows a decorative spinner only while loading", () => {
    const el = mount("<ds-button loading>x</ds-button>");
    const spinner = inner(el).querySelector('[part="spinner"]');
    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute("aria-hidden")).toBe("true");
    el.loading = false;
    expect(inner(el).querySelector('[part="spinner"]')).toBeNull();
    expect(inner(el).getAttribute("aria-busy")).toBeNull();
  });

  it("suppresses the click funnel (covers pointer AND keyboard activation)", () => {
    const el = mount("<ds-button loading>x</ds-button>");
    let clicks = 0;
    el.addEventListener("click", () => {
      clicks += 1;
    });
    inner(el).click();
    expect(clicks).toBe(0);
    el.loading = false;
    inner(el).click();
    expect(clicks).toBe(1);
  });
});

describe("stylesheet plumbing", () => {
  it("adopts the component sheet and the shared token sheet via adoptedStyleSheets", () => {
    const el = mount("<ds-button>x</ds-button>");
    const root = el.shadowRoot;
    expect(root).not.toBeNull();
    // token sheet + component sheet
    expect(root?.adoptedStyleSheets.length).toBe(2);
  });

  it("provideTokenStyles feeds the shared brand sheet every instance adopts", () => {
    provideTokenStyles(":host, :root { --ds-color-accent-default: #123456; }");
    expect(tokenSheet.text).toContain("--ds-color-accent-default");
    const el = mount("<ds-button>x</ds-button>");
    expect(el.shadowRoot?.adoptedStyleSheets.length).toBe(2);
  });

  it("falls back to a <style> element when constructable sheets are unavailable", () => {
    const sheet = new SharedSheet("ds-test-fallback", ".x { color: var(--ds-color-text-primary); }");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });

    const original = CSSStyleSheet.prototype.replaceSync;
    // Simulate an engine without constructable stylesheets.
    (CSSStyleSheet.prototype as { replaceSync?: unknown }).replaceSync = undefined;
    try {
      sheet.adoptInto(root);
      const style = root.querySelector('style[data-ds-sheet="ds-test-fallback"]');
      expect(style).not.toBeNull();
      expect(style?.textContent).toContain("--ds-color-text-primary");
      sheet.setText(".x { color: var(--ds-color-text-muted); }");
      expect(root.querySelector('style[data-ds-sheet="ds-test-fallback"]')?.textContent).toContain(
        "--ds-color-text-muted",
      );
      sheet.releaseFrom(root);
      expect(root.querySelector('style[data-ds-sheet="ds-test-fallback"]')).toBeNull();
    } finally {
      CSSStyleSheet.prototype.replaceSync = original;
    }
  });

  it("releases adopted sheets on disconnect", () => {
    const el = mount("<ds-button>x</ds-button>");
    const root = el.shadowRoot;
    el.remove();
    expect(root?.adoptedStyleSheets.length).toBe(0);
  });
});
