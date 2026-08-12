import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Alert } from './Alert';

const meta = {
  title: 'Components/Alert',
  component: Alert,
  args: {
    children: 'Something happened that you should know about.',
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --- one story per tone -------------------------------------------------- */

export const Info: Story = {
  args: {
    tone: 'info',
    children: 'A new version of this document is available.',
  },
};

export const Success: Story = {
  args: {
    tone: 'success',
    children: 'Your changes were saved.',
  },
};

export const Warning: Story = {
  args: {
    tone: 'warning',
    children: 'Your session expires in five minutes.',
  },
};

export const Danger: Story = {
  args: {
    tone: 'danger',
    children: 'Payment failed — check your card details.',
  },
};

/* --- states -------------------------------------------------------------- */

export const WithTitle: Story = {
  args: {
    tone: 'success',
    title: 'Deployed',
    children: 'Build 42 is live on production.',
  },
};

/**
 * FB-2: `isLive={false}` keeps the danger styling but drops the live-region
 * role, for permanent/static contexts (a danger-zone explainer that is part
 * of the page, not a notification) — assistive technology does not
 * re-announce it on every load.
 */
export const StaticDangerZone: Story = {
  args: {
    tone: 'danger',
    isLive: false,
    title: 'Danger zone',
    children:
      'Deleting this workspace permanently removes all projects and members.',
  },
};

export const Dismissible: Story = {
  args: {
    tone: 'info',
    title: 'Heads up',
    children: 'You can hide this message.',
    onDismiss: fn(),
  },
};

/* --- interaction contracts ----------------------------------------------- */

export const DismissFiresOnDismiss: Story = {
  args: {
    tone: 'warning',
    children: 'Dismiss me.',
    onDismiss: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }));
    await expect(args.onDismiss).toHaveBeenCalledOnce();
  },
};
