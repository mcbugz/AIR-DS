/**
 * Live brand switching — the white-label model in one function.
 *
 * The page links exactly one compiled tokens.css at a time; swapping that
 * <link> href is the ENTIRE re-theme (ADR-006). A tiny external store keeps
 * the React switcher in sync, and `window.__setBrand` exposes the same
 * function for scripted verification (site/screenshot.mjs).
 */
export type Brand = 'default' | 'acme';

let current: Brand = 'default';
const listeners = new Set<() => void>();

export function getBrand(): Brand {
  return current;
}

export function setBrand(brand: Brand): void {
  const link = document.getElementById('ds-tokens') as HTMLLinkElement | null;
  if (link) link.setAttribute('href', `./tokens-${brand}.css`);
  current = brand;
  for (const fn of listeners) fn();
}

export function subscribeBrand(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

declare global {
  interface Window {
    __setBrand: (brand: Brand) => void;
  }
}

export function exposeBrandSwitch(): void {
  window.__setBrand = setBrand;
}
