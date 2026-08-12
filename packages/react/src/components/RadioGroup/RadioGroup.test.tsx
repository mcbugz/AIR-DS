import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Radio, RadioGroup } from './RadioGroup';
import styles from './RadioGroup.module.css';

function renderGroup(props: Partial<Parameters<typeof RadioGroup>[0]> = {}) {
  return render(
    <RadioGroup label="Notification method" {...props}>
      <Radio value="email">Email</Radio>
      <Radio value="sms">SMS</Radio>
      <Radio value="push">Push</Radio>
    </RadioGroup>,
  );
}

describe('RadioGroup', () => {
  it('renders a radiogroup named by its label', () => {
    renderGroup();
    expect(
      screen.getByRole('radiogroup', { name: 'Notification method' }),
    ).toBeInTheDocument();
  });

  it('renders each Radio with its children as the accessible name', () => {
    renderGroup();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'SMS' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Push' })).toBeInTheDocument();
  });

  it('defaults to orientation="vertical"', () => {
    renderGroup();
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveClass(styles.radiogroup!, styles.vertical!);
    expect(group).toHaveAttribute('data-orientation', 'vertical');
  });

  it.each(['vertical', 'horizontal'] as const)(
    'applies orientation=%s class',
    (orientation) => {
      renderGroup({ orientation });
      const group = screen.getByRole('radiogroup');
      expect(group).toHaveClass(styles.radiogroup!, styles[orientation]!);
      expect(group).toHaveAttribute('data-orientation', orientation);
    },
  );

  it('appends caller-provided classNames after its own on group and radio', () => {
    render(
      <RadioGroup label="Notification method" className="mine">
        <Radio value="email" className="mine-radio">
          Email
        </Radio>
      </RadioGroup>,
    );
    expect(screen.getByRole('radiogroup')).toHaveClass(
      styles.radiogroup!,
      'mine',
    );
    const label = screen.getByRole('radio').closest('label');
    expect(label).toHaveClass(styles.radio!, 'mine-radio');
  });

  it('forwards typed refs: group <div>, radio <label>', () => {
    const groupRef = createRef<HTMLDivElement>();
    const radioRef = createRef<HTMLLabelElement>();
    render(
      <RadioGroup label="Notification method" ref={groupRef}>
        <Radio value="email" ref={radioRef}>
          Email
        </Radio>
      </RadioGroup>,
    );
    expect(groupRef.current).toBeInstanceOf(HTMLDivElement);
    expect(groupRef.current).toBe(screen.getByRole('radiogroup'));
    expect(radioRef.current).toBeInstanceOf(HTMLLabelElement);
    expect(radioRef.current).toBe(screen.getByRole('radio').closest('label'));
  });

  it('draws the control in CSS and hides it from assistive technology', () => {
    renderGroup();
    const label = screen.getByRole('radio', { name: 'Email' }).closest('label');
    const control = label?.querySelector(`.${styles.control}`);
    expect(control).not.toBeNull();
    expect(control).toHaveAttribute('aria-hidden', 'true');
  });

  it('associates the description with the group', () => {
    renderGroup({ description: 'Where should we send alerts?' });
    expect(screen.getByRole('radiogroup')).toHaveAccessibleDescription(
      'Where should we send alerts?',
    );
  });

  it('marks the group required via isRequired', () => {
    renderGroup({ isRequired: true });
    expect(screen.getByRole('radiogroup')).toHaveAttribute('data-required');
  });

  describe('selection', () => {
    it('selects on click and fires onChange with the radio value', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      renderGroup({ onChange });
      const sms = screen.getByRole('radio', { name: 'SMS' });
      await user.click(sms);
      expect(sms).toBeChecked();
      expect(onChange).toHaveBeenCalledExactlyOnceWith('sms');
    });

    it('moves selection with arrow keys (selection follows focus)', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      renderGroup({ onChange, defaultValue: 'email' });
      await user.tab();
      expect(screen.getByRole('radio', { name: 'Email' })).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      const sms = screen.getByRole('radio', { name: 'SMS' });
      expect(sms).toHaveFocus();
      expect(sms).toBeChecked();
      expect(onChange).toHaveBeenLastCalledWith('sms');
      await user.keyboard('{ArrowUp}');
      const email = screen.getByRole('radio', { name: 'Email' });
      expect(email).toHaveFocus();
      expect(email).toBeChecked();
      expect(onChange).toHaveBeenLastCalledWith('email');
    });
  });

  describe('disabled', () => {
    it('disables every radio and blocks onChange when the group is disabled', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      renderGroup({ isDisabled: true, onChange });
      expect(screen.getByRole('radiogroup')).toHaveAttribute('data-disabled');
      for (const radio of screen.getAllByRole('radio')) {
        expect(radio).toBeDisabled();
      }
      await user.click(screen.getByRole('radio', { name: 'Email' }));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('disables a single item without affecting its siblings', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <RadioGroup label="Notification method" onChange={onChange}>
          <Radio value="email">Email</Radio>
          <Radio value="sms" isDisabled>
            SMS
          </Radio>
        </RadioGroup>,
      );
      const sms = screen.getByRole('radio', { name: 'SMS' });
      expect(sms).toBeDisabled();
      expect(sms.closest('label')).toHaveAttribute('data-disabled');
      await user.click(sms);
      expect(onChange).not.toHaveBeenCalled();
      const email = screen.getByRole('radio', { name: 'Email' });
      expect(email).toBeEnabled();
      await user.click(email);
      expect(onChange).toHaveBeenCalledExactlyOnceWith('email');
    });
  });

  describe('invalid', () => {
    it('exposes the invalid state and the associated error message', () => {
      renderGroup({
        isInvalid: true,
        errorMessage: 'Choose a method to continue.',
      });
      const group = screen.getByRole('radiogroup');
      expect(group).toHaveAttribute('data-invalid');
      expect(group).toHaveAccessibleDescription('Choose a method to continue.');
      const label = screen
        .getByRole('radio', { name: 'Email' })
        .closest('label');
      expect(label).toHaveAttribute('data-invalid');
    });

    it('does not render the error message while the group is valid', () => {
      renderGroup({ errorMessage: 'Choose a method to continue.' });
      expect(
        screen.queryByText('Choose a method to continue.'),
      ).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has no axe violations (default)', async () => {
      const { container } = renderGroup();
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (description + invalid + selection)', async () => {
      const { container } = renderGroup({
        description: 'Where should we send alerts?',
        isInvalid: true,
        errorMessage: 'Choose a method to continue.',
        defaultValue: 'sms',
      });
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (disabled group)', async () => {
      const { container } = renderGroup({
        isDisabled: true,
        defaultValue: 'email',
      });
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
