import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { Select } from './Select';

const fruits = [
  { id: 'apple', label: 'Apple' },
  { id: 'banana', label: 'Banana' },
  { id: 'cherry', label: 'Cherry' },
  { id: 'date', label: 'Date' },
];

const meta = {
  title: 'Components/Select',
  component: Select,
  args: {
    label: 'Favorite fruit',
    placeholder: 'Pick a fruit',
    items: fruits,
    onSelectionChange: fn(),
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --- states -------------------------------------------------------------- */

export const Default: Story = {};

export const Selected: Story = {
  args: { defaultSelectedKey: 'banana' },
};

export const Invalid: Story = {
  args: {
    isInvalid: true,
    errorMessage: 'Pick a fruit to continue.',
  },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};

export const DisabledOption: Story = {
  args: {
    items: [
      { id: 'apple', label: 'Apple' },
      { id: 'banana', label: 'Banana (out of season)', isDisabled: true },
      { id: 'cherry', label: 'Cherry' },
    ],
  },
};

export const WithDescription: Story = {
  args: { description: 'Shown on your public profile.' },
};

/* --- interaction contracts -----------------------------------------------
   The popover portals to document.body, so option queries go through
   `screen` rather than the canvas. */

export const OpenAndSelectUpdatesValue: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /Favorite fruit/ });
    await userEvent.click(trigger);
    const option = await screen.findByRole('option', { name: 'Cherry' });
    await userEvent.click(option);
    await expect(args.onSelectionChange).toHaveBeenCalledWith('cherry');
    await waitFor(() => expect(trigger).toHaveTextContent('Cherry'));
  },
};

export const DisabledBlocksOpen: Story = {
  args: { isDisabled: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /Favorite fruit/ });
    await userEvent.click(trigger);
    await expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await expect(args.onSelectionChange).not.toHaveBeenCalled();
  },
};
