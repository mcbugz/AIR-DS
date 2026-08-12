import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: {
    children: 'Button',
    onPress: fn(),
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --- one story per variant --------------------------------------------- */

export const Primary: Story = {
  args: { variant: 'primary', children: 'Save changes' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Cancel' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Dismiss' },
};

export const Danger: Story = {
  args: { variant: 'danger', children: 'Delete project' },
};

/* --- sizes showcase ------------------------------------------------------ */

export const Sizes: Story = {
  render: (args) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--ds-space-gap-md)',
      }}
    >
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
};

/* --- states -------------------------------------------------------------- */

export const Loading: Story = {
  args: { isLoading: true, children: 'Saving…' },
};

export const Disabled: Story = {
  args: { isDisabled: true, children: 'Unavailable' },
};

/** Danger has variant-specific disabled CSS, so it gets its own story. */
export const DisabledDanger: Story = {
  args: { variant: 'danger', isDisabled: true, children: 'Delete project' },
};

/* --- interaction contracts ----------------------------------------------- */

export const PressFiresOnPress: Story = {
  args: { children: 'Press me' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Press me' }));
    await expect(args.onPress).toHaveBeenCalledOnce();
  },
};

export const LoadingBlocksPress: Story = {
  args: { isLoading: true, children: 'Saving…' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Saving…' }));
    await expect(args.onPress).not.toHaveBeenCalled();
  },
};
