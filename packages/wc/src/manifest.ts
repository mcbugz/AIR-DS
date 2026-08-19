/**
 * @ds/wc source-of-truth manifest.
 *
 * HAND-WRITTEN source, GENERATED registry: registries/wc-index.json is
 * compiled FROM this file (scripts/generate-registry.ts), never the other way
 * around, and the components import their enumerated attribute values from
 * here — so the registry, the runtime validation, and the styles all share
 * one vocabulary (CLAUDE.md rule 1: build the compiler, don't hand-author
 * the artifact).
 */

export const BUTTON_VARIANTS = ["primary", "secondary", "ghost", "danger"] as const;
export const BUTTON_SIZES = ["sm", "md", "lg"] as const;

export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];
export type ButtonSize = (typeof BUTTON_SIZES)[number];

export const BUTTON_DEFAULT_VARIANT: ButtonVariant = "primary";
export const BUTTON_DEFAULT_SIZE: ButtonSize = "md";

export interface WcAttributeSpec {
  readonly name: string;
  /** "enum" attributes enumerate every legal value; "boolean" attributes are presence-based. */
  readonly type: "enum" | "boolean";
  readonly values: readonly string[] | null;
  /** Effective value when the attribute is absent or carries an unlisted value. */
  readonly default: string | null;
  readonly description: string;
}

export interface WcEventSpec {
  readonly name: string;
  readonly description: string;
}

export interface WcCssPartSpec {
  readonly name: string;
  readonly description: string;
}

export interface WcComponentSpec {
  readonly tag: string;
  readonly description: string;
  readonly attributes: readonly WcAttributeSpec[];
  readonly events: readonly WcEventSpec[];
  readonly cssParts: readonly WcCssPartSpec[];
}

export const WC_MANIFEST: readonly WcComponentSpec[] = [
  {
    tag: "ds-button",
    description:
      "Accessible push button as a framework-free custom element, mirroring the @ds/react Button API (variant/size/loading/disabled). Renders a native <button> inside an open shadow root (native keyboard activation and disabled semantics), styled exclusively by --ds-* tokens consumed from the Shadow-DOM token build (dist/wc/tokens.css) via adoptedStyleSheets with a <style> fallback. Unknown attribute values fall back to the documented defaults (closed world: the enumerated values are the only vocabulary).",
    attributes: [
      {
        name: "variant",
        type: "enum",
        values: BUTTON_VARIANTS,
        default: BUTTON_DEFAULT_VARIANT,
        description:
          "Visual intent. `primary` is the single main action of a view, `secondary` a supporting action, `ghost` a low-emphasis inline action, `danger` a destructive action. Unlisted values fall back to `primary`.",
      },
      {
        name: "size",
        type: "enum",
        values: BUTTON_SIZES,
        default: BUTTON_DEFAULT_SIZE,
        description:
          "Control size; maps to the --ds-button-height-* / --ds-button-padding-x-* scale. Unlisted values fall back to `md`.",
      },
      {
        name: "loading",
        type: "boolean",
        values: null,
        default: null,
        description:
          "Marks the button busy with an in-progress action: activation is suppressed, aria-busy and aria-disabled are set on the inner button (which stays focusable, matching the React isLoading behavior), and a CSS-only spinner is shown before the label. The label stays visible.",
      },
      {
        name: "disabled",
        type: "boolean",
        values: null,
        default: null,
        description:
          "Native disabled semantics: the inner <button> gets the `disabled` attribute (removed from tab order, no activation), and all variants converge on the canonical muted-sunken disabled recipe.",
      },
    ],
    events: [
      {
        name: "click",
        description:
          "Native activation event (pointer and keyboard — Enter/Space are handled by the inner native <button>). Never fires while `disabled` or `loading` is set.",
      },
    ],
    cssParts: [
      { name: "button", description: "The inner native <button>: restyle hook for host pages via ::part(button)." },
      { name: "spinner", description: "The loading spinner span (present only while `loading` is set)." },
    ],
  },
];
