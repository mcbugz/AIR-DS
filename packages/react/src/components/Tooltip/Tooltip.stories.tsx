import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../Button';
import { Tooltip } from './Tooltip';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  args: {
    content: 'Tooltip text',
    children: <Button variant="secondary">Hover or focus me</Button>,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --- default ------------------------------------------------------------- */

export const Default: Story = {
  args: {
    content: 'Save your changes',
    children: <Button variant="secondary">Save</Button>,
  },
};

/* --- placements showcase -------------------------------------------------- */

export const Placements: Story = {
  render: (args) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--ds-space-gap-lg)',
        padding: 'var(--ds-space-10)',
      }}
    >
      {(['top', 'bottom', 'left', 'right'] as const).map((placement) => (
        <Tooltip
          {...args}
          key={placement}
          placement={placement}
          content={placement}
          defaultOpen
        >
          <Button variant="secondary">{placement}</Button>
        </Tooltip>
      ))}
    </div>
  ),
};

/* --- icon-button trigger --------------------------------------------------
   The canonical tooltip use case: an icon-only control whose meaning the
   tooltip spells out. The trigger stays independently accessible via its
   own aria-label. */

export const OnIconButtonTrigger: Story = {
  args: {
    content: 'Delete project',
    children: (
      <Button variant="ghost" aria-label="Delete project">
        <svg
          width={16}
          height={16}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path d="M2.5 4.5h11M6.5 2h3M4 4.5 4.8 14h6.4l.8-9.5M6.5 7.5v4M9.5 7.5v4" />
        </svg>
      </Button>
    ),
  },
};

/* --- interaction contract -------------------------------------------------
   Keyboard focus shows the tooltip immediately (no warmup delay); blurring
   hides it again. */

export const FocusShowsTooltip: Story = {
  args: {
    content: 'Shown on focus',
    children: <Button variant="secondary">Focus me</Button>,
  },
  play: async ({ args, canvasElement }) => {
    // Tooltips portal to the document body, not the story canvas.
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.tab();
    const tooltip = await body.findByRole('tooltip');
    await expect(tooltip).toHaveTextContent('Shown on focus');
    await expect(args.onOpenChange).toHaveBeenCalledWith(true);

    await userEvent.tab();
    await waitFor(() =>
      expect(body.queryByRole('tooltip')).not.toBeInTheDocument(),
    );
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};
