import '@ds/tokens/css';
import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
  parameters: {
    a11y: {
      // Fail stories on axe violations — stories are contract artifacts.
      test: 'error',
    },
  },
};

export default preview;
