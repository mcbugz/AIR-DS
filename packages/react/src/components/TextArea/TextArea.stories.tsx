import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TextArea } from './TextArea';

const meta = {
  title: 'Components/TextArea',
  component: TextArea,
  args: {
    label: 'Message',
    onChange: fn(),
  },
} satisfies Meta<typeof TextArea>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --- default -------------------------------------------------------------- */

export const Default: Story = {
  args: { placeholder: 'Tell us more…' },
};

export const WithDescription: Story = {
  args: {
    label: 'Notes',
    description: 'Visible to the whole team.',
    rows: 5,
  },
};

/* --- states --------------------------------------------------------------- */

export const Invalid: Story = {
  args: {
    label: 'Feedback',
    isInvalid: true,
    errorMessage: 'Feedback is required.',
  },
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
    defaultValue: 'This field is currently unavailable.',
  },
};

/** Grows with content via CSS field-sizing; manual resize is disabled. */
export const AutoGrow: Story = {
  args: {
    autoGrow: true,
    defaultValue: 'Type more lines here\nand the field grows\nwith the content.',
  },
};

/* --- interaction contracts ------------------------------------------------ */

export const TypingFiresOnChange: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: 'Message' });
    await userEvent.type(field, 'Hello');
    await expect(args.onChange).toHaveBeenCalled();
    await expect(field).toHaveValue('Hello');
  },
};

export const DisabledBlocksTyping: Story = {
  args: { isDisabled: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: 'Message' });
    await userEvent.type(field, 'Hello');
    await expect(args.onChange).not.toHaveBeenCalled();
    await expect(field).toHaveValue('');
  },
};
