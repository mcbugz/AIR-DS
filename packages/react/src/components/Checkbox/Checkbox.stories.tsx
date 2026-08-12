import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Checkbox } from './Checkbox';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  args: {
    children: 'Accept terms',
    onChange: fn(),
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --- states -------------------------------------------------------------- */

export const Default: Story = {};

export const Checked: Story = {
  args: { defaultSelected: true },
};

export const Indeterminate: Story = {
  args: { isIndeterminate: true, children: 'Select all' },
};

export const Disabled: Story = {
  args: { isDisabled: true, children: 'Unavailable option' },
};

/** Disabled has its own CSS for the selected fill, so it gets its own story. */
export const DisabledChecked: Story = {
  args: { isDisabled: true, defaultSelected: true, children: 'Locked in' },
};

export const Invalid: Story = {
  args: { isInvalid: true, isRequired: true, children: 'I agree to the policy' },
};

/** Invalid + selected has its own danger-fill CSS, so it gets its own story. */
export const InvalidChecked: Story = {
  args: { isInvalid: true, defaultSelected: true, children: 'I agree to the policy' },
};

/* --- interaction contracts ----------------------------------------------- */

export const ToggleFiresOnChange: Story = {
  args: { children: 'Toggle me' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox', { name: 'Toggle me' });
    await userEvent.click(checkbox);
    await expect(args.onChange).toHaveBeenCalledOnce();
    await expect(args.onChange).toHaveBeenCalledWith(true);
    await expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    await expect(args.onChange).toHaveBeenCalledWith(false);
    await expect(checkbox).not.toBeChecked();
  },
};

export const DisabledBlocksToggle: Story = {
  args: { isDisabled: true, children: 'Unavailable option' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox', { name: 'Unavailable option' });
    await userEvent.click(checkbox);
    await expect(args.onChange).not.toHaveBeenCalled();
    await expect(checkbox).not.toBeChecked();
  },
};
