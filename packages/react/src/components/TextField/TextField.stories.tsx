import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TextField } from './TextField';

const meta = {
  title: 'Components/TextField',
  component: TextField,
  args: {
    label: 'Email',
    onChange: fn(),
  },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --- states -------------------------------------------------------------- */

export const Default: Story = {
  args: { placeholder: 'you@example.com' },
};

export const WithDescription: Story = {
  args: {
    label: 'Display name',
    description: 'Shown on your public profile.',
  },
};

export const Invalid: Story = {
  args: {
    isInvalid: true,
    errorMessage: 'Enter a valid email address.',
    defaultValue: 'not-an-email',
  },
};

export const Disabled: Story = {
  args: { isDisabled: true, defaultValue: 'read-only value' },
};

export const Required: Story = {
  args: { isRequired: true },
};

/* --- interaction contracts ----------------------------------------------- */

export const TypingUpdatesValue: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Email');
    await userEvent.type(input, 'ada@example.com');
    await expect(input).toHaveValue('ada@example.com');
    await expect(args.onChange).toHaveBeenLastCalledWith('ada@example.com');
  },
};

export const InvalidShowsErrorMessage: Story = {
  args: {
    isInvalid: true,
    errorMessage: 'Enter a valid email address.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Email');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(
      canvas.getByText('Enter a valid email address.'),
    ).toBeInTheDocument();
  },
};

export const DisabledBlocksTyping: Story = {
  args: { isDisabled: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Email');
    await expect(input).toBeDisabled();
    await userEvent.type(input, 'nope');
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
