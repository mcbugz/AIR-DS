import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Switch } from './Switch';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  args: {
    children: 'Enable notifications',
    onChange: fn(),
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --- states -------------------------------------------------------------- */

export const Off: Story = {};

export const On: Story = {
  args: { defaultSelected: true },
};

export const Disabled: Story = {
  args: { isDisabled: true, children: 'Unavailable setting' },
};

/** Disabled has its own CSS for the on-state track/thumb, so it gets its own story. */
export const DisabledOn: Story = {
  args: { isDisabled: true, defaultSelected: true, children: 'Locked on' },
};

/* --- interaction contracts ----------------------------------------------- */

export const ToggleFiresOnChange: Story = {
  args: { children: 'Toggle me' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const switchInput = canvas.getByRole('switch', { name: 'Toggle me' });
    await userEvent.click(switchInput);
    await expect(args.onChange).toHaveBeenCalledOnce();
    await expect(args.onChange).toHaveBeenCalledWith(true);
    await expect(switchInput).toBeChecked();
    await userEvent.click(switchInput);
    await expect(args.onChange).toHaveBeenCalledWith(false);
    await expect(switchInput).not.toBeChecked();
  },
};

export const DisabledBlocksToggle: Story = {
  args: { isDisabled: true, children: 'Unavailable setting' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const switchInput = canvas.getByRole('switch', {
      name: 'Unavailable setting',
    });
    await userEvent.click(switchInput);
    await expect(args.onChange).not.toHaveBeenCalled();
    await expect(switchInput).not.toBeChecked();
  },
};
