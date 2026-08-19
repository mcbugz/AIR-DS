import { Hero } from './sections/Hero';
import { Stats } from './sections/Stats';
import { Gallery } from './sections/Gallery';
import { ReferencePanel } from './sections/ReferencePanel';
import { HowItWorks } from './sections/HowItWorks';
import { GetStarted } from './sections/GetStarted';
import { Footer } from './sections/Footer';

/**
 * The AIR-DS demo site is itself a dogfood demo: every interactive element
 * is a registry component from @ds/react, every style value in site.css is
 * a var(--ds-*) token, and the brand switcher re-themes this very page by
 * swapping one compiled tokens.css <link>.
 */
export function App() {
  return (
    <div className="site">
      <Hero />
      <main>
        <Stats />
        <Gallery />
        <ReferencePanel />
        <HowItWorks />
        <GetStarted />
      </main>
      <Footer />
    </div>
  );
}
