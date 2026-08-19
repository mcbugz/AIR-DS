/** Typical 2023 setup: brand values live inside the build tool config. */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          900: '#1e3a8a',
        },
        danger: '#dc2626',
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
};
