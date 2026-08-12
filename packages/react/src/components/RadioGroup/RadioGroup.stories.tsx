import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Radio, RadioGroup } from './RadioGroup';

const meta = {
  title: 'Components/RadioGroup',
  component: RadioGroup,
  args: {
    label: 'Notification method',
    onChange: fn(),
    children: (
      <>
        <Radio value="email">Email</Radio>
        <Radio value="sms">SMS</Radio>
        <Radio value="push">Push notification</Radio>
      </>
    ),
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --- one story per orientation value ------------------------------------ */

export const Vertical: Story = {
  args: { orientation: 'vertical' },
};

export const Horizontal: Story = {
  args: { orientation: 'horizontal' },
};

/* --- description ---------------------------------------------------------- */

export const WithDescription: Story = {
  args: {
    description: 'Where should we send account alerts?',
    defaultValue: 'email',
  },
};

/* --- states --------------------------------------------------------------- */

/** Whole group disabled; the selected item shows the muted selected fill. */
export const Disabled: Story = {
  args: { isDisabled: true, defaultValue: 'email' },
};

/** A single disabled option inside an otherwise enabled group. */
export const DisabledItem: Story = {
  args: {
    children: (
      <>
        <Radio value="email">Email</Radio>
        <Radio value="sms" isDisabled>
          SMS
        </Radio>
        <Radio value="push">Push notification</Radio>
      </>
    ),
  },
};

/** Invalid selection: danger controls plus the associated error message. */
export const Invalid: Story = {
  args: {
    isInvalid: true,
    errorMessage: 'Choose a notification method to continue.',
    defaultValue: 'sms',
  },
};

/* --- interaction contracts ------------------------------------------------ */

export const SelectionAndArrowKeys: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // Pointer selection fires onChange with the radio's value.
    const email = canvas.getByRole('radio', { name: 'Email' });
    await userEvent.click(email);
    await expect(email).toBeChecked();
    await expect(args.onChange).toHaveBeenCalledWith('email');
    // Arrow keys move focus AND selection (selection follows focus).
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('radio', { name: 'SMS' })).toBeChecked();
    await expect(args.onChange).toHaveBeenCalledWith('sms');
    await userEvent.keyboard('{ArrowUp}');
    await expect(email).toBeChecked();
  },
};

export const DisabledBlocksSelection: Story = {
  args: { isDisabled: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: 'Email' }));
    await expect(canvas.getByRole('radio', { name: 'Email' })).not.toBeChecked();
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
