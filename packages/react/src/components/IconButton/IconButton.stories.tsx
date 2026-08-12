import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { IconButton } from './IconButton';

/** Inline demo icon — the system ships no icon set; any SVG node works. */
function PlusIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

const meta = {
  title: 'Components/IconButton',
  component: IconButton,
  args: {
    'aria-label': 'Add item',
    children: <PlusIcon />,
    onPress: fn(),
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --- one story per variant --------------------------------------------- */

export const Ghost: Story = {
  args: { variant: 'ghost', 'aria-label': 'Add item' },
};

export const Primary: Story = {
  args: { variant: 'primary', 'aria-label': 'Add item' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', 'aria-label': 'Add item' },
};

export const Danger: Story = {
  args: { variant: 'danger', 'aria-label': 'Remove item' },
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
      <IconButton {...args} size="sm" aria-label="Add item (small)" />
      <IconButton {...args} size="md" aria-label="Add item (medium)" />
      <IconButton {...args} size="lg" aria-label="Add item (large)" />
    </div>
  ),
};

/* --- states -------------------------------------------------------------- */

export const Disabled: Story = {
  args: { isDisabled: true, 'aria-label': 'Add item' },
};

/** Primary shares the filled disabled recipe; render it explicitly. */
export const DisabledPrimary: Story = {
  args: { variant: 'primary', isDisabled: true, 'aria-label': 'Add item' },
};

/** Secondary has variant-specific disabled CSS (border), so it gets its own story. */
export const DisabledSecondary: Story = {
  args: { variant: 'secondary', isDisabled: true, 'aria-label': 'Add item' },
};

/** Danger has variant-specific disabled CSS, so it gets its own story. */
export const DisabledDanger: Story = {
  args: { variant: 'danger', isDisabled: true, 'aria-label': 'Remove item' },
};

/* --- interaction contracts ----------------------------------------------- */

export const PressFiresOnPress: Story = {
  args: { 'aria-label': 'Add item' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add item' }));
    await expect(args.onPress).toHaveBeenCalledOnce();
  },
};

export const DisabledBlocksPress: Story = {
  args: { isDisabled: true, 'aria-label': 'Add item' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add item' }));
    await expect(args.onPress).not.toHaveBeenCalled();
  },
};
