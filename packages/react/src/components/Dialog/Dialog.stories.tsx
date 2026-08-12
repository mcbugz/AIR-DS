import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../Button';
import { Dialog } from './Dialog';

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  args: {
    title: 'Dialog title',
    onOpenChange: fn(),
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --- default (trigger + open via play) ----------------------------------- */

export const Default: Story = {
  args: {
    title: 'Rename project',
    trigger: <Button>Open dialog</Button>,
    children: ({ close }) => (
      <>
        <p style={{ margin: 0 }}>
          Give the project a new name. Collaborators see the change
          immediately.
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--ds-space-gap-md)',
          }}
        >
          <Button variant="secondary" onPress={close}>
            Cancel
          </Button>
          <Button onPress={close}>Rename</Button>
        </div>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));
    await expect(await body.findByRole('dialog')).toBeVisible();
  },
};

/* --- sizes showcase ------------------------------------------------------- */

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 'var(--ds-space-gap-md)' }}>
      <Dialog
        {...args}
        size="sm"
        title="Small dialog"
        trigger={<Button variant="secondary">Open sm</Button>}
      >
        <p style={{ margin: 0 }}>A compact confirmation-style dialog.</p>
      </Dialog>
      <Dialog
        {...args}
        size="md"
        title="Medium dialog"
        trigger={<Button variant="secondary">Open md</Button>}
      >
        <p style={{ margin: 0 }}>The default width for most dialogs.</p>
      </Dialog>
      <Dialog
        {...args}
        size="lg"
        title="Large dialog"
        trigger={<Button variant="secondary">Open lg</Button>}
      >
        <p style={{ margin: 0 }}>A wide dialog for richer content.</p>
      </Dialog>
    </div>
  ),
};

/* --- non-dismissable state (blocked interaction does NOT fire) ------------ */

export const NonDismissable: Story = {
  args: {
    title: 'Accept terms',
    isDismissable: false,
    trigger: <Button>Review terms</Button>,
    children: ({ close }) => (
      <>
        <p style={{ margin: 0 }}>
          You must explicitly accept the terms — Escape and backdrop clicks
          are disabled.
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--ds-space-gap-md)',
          }}
        >
          <Button onPress={close}>Accept</Button>
        </div>
      </>
    ),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Review terms' }));
    await body.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    // Blocked: the dialog stays open and no close event fires.
    await expect(body.getByRole('dialog')).toBeInTheDocument();
    await expect(args.onOpenChange).not.toHaveBeenCalledWith(false);
  },
};

/* --- interaction contract: open via trigger, focus inside, Esc closes ----- */

export const KeyboardInteraction: Story = {
  args: {
    title: 'Keyboard contract',
    trigger: <Button>Open dialog</Button>,
    children: <p style={{ margin: 0 }}>Focus is trapped in here.</p>,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));
    await expect(args.onOpenChange).toHaveBeenCalledWith(true);
    const dialog = await body.findByRole('dialog');
    // Focus lands inside the open dialog.
    await waitFor(() =>
      expect(dialog.contains(doc.activeElement)).toBe(true),
    );
    // Escape closes it.
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(body.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};
