import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  args: {
    children: 'Badge',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --- one story per tone -------------------------------------------------- */

export const Neutral: Story = {
  args: { tone: 'neutral', children: 'Draft' },
};

export const Info: Story = {
  args: { tone: 'info', children: 'Beta' },
};

export const Success: Story = {
  args: { tone: 'success', children: 'Active' },
};

export const Warning: Story = {
  args: { tone: 'warning', children: 'Expiring soon' },
};

export const Danger: Story = {
  args: { tone: 'danger', children: 'Failed' },
};
