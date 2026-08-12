/**
 * Ambient declarations for CSS imports.
 *
 * These keep `tsc --noEmit` and vitest independent of the @ds/tokens build:
 * the tokens CSS is a side-effect import resolved at bundle time only.
 */

declare module '*.module.css' {
  const classes: { readonly [className: string]: string };
  export default classes;
}

declare module '*.css';

declare module '@ds/tokens/css';
