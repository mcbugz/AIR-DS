/**
 * Legacy Tailwind config — still consumed by the marketing pages.
 * Values drifted from styles/atlas.css over the years; `brand.700`
 * matches --atlas-blue-dark but `accent` exists nowhere in the CSS.
 */
module.exports = {
  content: ['./src/**/*.{ts,tsx,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1a56db',
          600: '#1a56db',
          700: '#1e429f',
        },
        accent: '#7c3aed',
        danger: '#b91c1c',
      },
      spacing: {
        18: '4.5rem',
      },
      borderRadius: {
        card: '6px',
      },
    },
  },
  plugins: [],
};
