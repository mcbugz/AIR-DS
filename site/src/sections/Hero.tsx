import { useSyncExternalStore } from 'react';
import { Button } from '@ds/react';
import { getBrand, setBrand, subscribeBrand } from '../brand';

/**
 * Hero: the wordmark, the claim, and the hero control — a live brand
 * switcher built from real ds Buttons. Pressing one swaps the tokens.css
 * <link> href; the entire page re-themes instantly because every style on
 * it resolves through var(--ds-*) tokens.
 */
export function Hero() {
  const brand = useSyncExternalStore(subscribeBrand, getBrand, getBrand);

  return (
    <header className="hero">
      <div className="hero-inner">
        <h1 className="hero-wordmark">
          <img
            src="./air-ds-banner.svg"
            alt="AIR-DS — the AI-ready, white-label design system"
            width="640"
            height="196"
          />
        </h1>
        <p className="hero-tagline">A design system agents cannot hallucinate against.</p>
        <p className="hero-lede">
          Every legal token and component is enumerated in generated registries. Anything not in a
          registry is provably fabricated — and unmergeable, not merely flagged.
        </p>
        <div className="hero-switcher">
          <span className="hero-switcher-label" id="brand-switcher-label">
            Re-theme this page
          </span>
          <div className="hero-switcher-buttons" role="group" aria-labelledby="brand-switcher-label">
            <Button
              variant={brand === 'default' ? 'primary' : 'secondary'}
              onPress={() => setBrand('default')}
              aria-pressed={brand === 'default'}
            >
              Default
            </Button>
            <Button
              variant={brand === 'acme' ? 'primary' : 'secondary'}
              onPress={() => setBrand('acme')}
              aria-pressed={brand === 'acme'}
            >
              Acme
            </Button>
          </div>
          <span className="hero-switcher-caption">
            That is the whole white-label model: same compiled bundle, one theme file per customer
            (<code>brands/&lt;name&gt;.json</code>) — swapped here as a single stylesheet link. Zero
            component changes.
          </span>
        </div>
      </div>
    </header>
  );
}
