/**
 * <ds-button> stylesheet — the @ds/react Button recipe re-targeted at Shadow
 * DOM. Token-only CSS (CLAUDE.md rule 2): every color/font/size/space/radius/
 * shadow/motion value is var(--ds-*); allowed literals are 0, 100%, auto,
 * none, currentColor, and layout keywords. The token-audit test greps this
 * string against registries/tokens-index.json.
 *
 * One deliberate divergence from the React recipe: interaction states use the
 * native :hover/:active/:focus-visible/:disabled pseudo-classes. The react
 * package bans those in favor of RAC data attributes because React Aria owns
 * the state machine there; in a framework-free custom element the platform
 * pseudo-classes ARE the state machine.
 *
 * The token VALUES arrive through the cascade: either adopt the Shadow-DOM
 * token build (dist/wc/tokens.css, scoped :host) via provideTokenStyles(), or
 * link any brand's tokens.css at document level — custom properties inherit
 * across shadow boundaries.
 */

export const BUTTON_CSS: string = /* css */ `
:host {
  display: inline-flex;
}

:host([hidden]) {
  display: none;
}

button {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ds-button-gap);
  border: none;
  margin: 0;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  text-decoration: none;
  font-family: var(--ds-font-family-sans);
  font-weight: var(--ds-button-font-weight);
  line-height: var(--ds-text-leading-tight);
  border-radius: var(--ds-button-radius);
  transition:
    background-color var(--ds-motion-duration-fast) var(--ds-motion-easing-standard),
    border-color var(--ds-motion-duration-fast) var(--ds-motion-easing-standard),
    color var(--ds-motion-duration-fast) var(--ds-motion-easing-standard),
    box-shadow var(--ds-motion-duration-fast) var(--ds-motion-easing-standard);
}

button:focus-visible {
  outline: var(--ds-border-width-2) solid var(--ds-color-border-focus);
  outline-offset: var(--ds-border-width-1);
  box-shadow: var(--ds-shadow-focus-ring);
}

button:disabled {
  cursor: not-allowed;
}

button.loading {
  cursor: progress;
}

/* --- sizes ------------------------------------------------------------ */

button.sm {
  block-size: var(--ds-button-height-sm);
  padding-block: 0;
  padding-inline: var(--ds-button-padding-x-sm);
  font-size: var(--ds-text-size-sm);
}

button.md {
  block-size: var(--ds-button-height-md);
  padding-block: 0;
  padding-inline: var(--ds-button-padding-x-md);
  font-size: var(--ds-text-size-md);
}

button.lg {
  block-size: var(--ds-button-height-lg);
  padding-block: 0;
  padding-inline: var(--ds-button-padding-x-lg);
  font-size: var(--ds-text-size-lg);
}

/* --- variants ---------------------------------------------------------- */

button.primary {
  background-color: var(--ds-button-surface-primary-default);
  color: var(--ds-button-text-primary);
}

button.primary:hover:enabled:not(.loading),
button.primary:active:enabled:not(.loading) {
  background-color: var(--ds-button-surface-primary-hover);
}

button.secondary {
  background-color: var(--ds-button-surface-secondary-default);
  color: var(--ds-button-text-secondary);
  border: var(--ds-border-width-1) solid var(--ds-button-border-secondary);
}

button.secondary:hover:enabled:not(.loading),
button.secondary:active:enabled:not(.loading) {
  background-color: var(--ds-button-surface-secondary-hover);
  border-color: var(--ds-color-border-strong);
}

button.ghost {
  background: none;
  color: var(--ds-button-text-ghost);
}

button.ghost:hover:enabled:not(.loading),
button.ghost:active:enabled:not(.loading) {
  background-color: var(--ds-button-surface-ghost-hover);
}

button.danger {
  background-color: var(--ds-button-surface-danger-default);
  color: var(--ds-button-text-danger);
}

button.danger:hover:enabled:not(.loading),
button.danger:active:enabled:not(.loading) {
  background-color: var(--ds-button-surface-danger-hover);
}

/* --- disabled (canonical recipe) -----------------------------------------
   All variants converge on the muted sunken treatment so disabled contrast
   is AA-checkable once, per theme, not per variant. */

button.primary:disabled,
button.secondary:disabled,
button.danger:disabled {
  background-color: var(--ds-color-surface-sunken);
  color: var(--ds-color-text-muted);
}

button.secondary:disabled {
  border-color: var(--ds-color-border-muted);
}

button.ghost:disabled {
  color: var(--ds-color-text-muted);
}

/* --- loading spinner (CSS-only) ----------------------------------------- */

.spinner {
  flex: none;
  inline-size: var(--ds-size-icon-sm);
  block-size: var(--ds-size-icon-sm);
  border-radius: var(--ds-radius-full);
  border: var(--ds-border-width-2) dotted currentColor;
  animation: ds-button-spin var(--ds-motion-duration-slow) linear infinite;
}

@keyframes ds-button-spin {
  to {
    rotate: 1turn;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
`;
