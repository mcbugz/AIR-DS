import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Switch } from './Switch';
import styles from './Switch.module.css';

/** The styled element is the RAC label; the role lives on the hidden input. */
function getLabel(): HTMLLabelElement {
  const label = screen.getByRole('switch').closest('label');
  if (!label) throw new Error('Switch label element not found');
  return label;
}

describe('Switch', () => {
  it('renders an accessible switch with its label', () => {
    render(<Switch>Enable notifications</Switch>);
    expect(
      screen.getByRole('switch', { name: 'Enable notifications' }),
    ).toBeInTheDocument();
  });

  it('applies the base class and draws a decorative track with a thumb', () => {
    render(<Switch>Enable notifications</Switch>);
    const label = getLabel();
    expect(label).toHaveClass(styles.switch!);
    const track = label.querySelector(`.${styles.track}`);
    expect(track).not.toBeNull();
    expect(track).toHaveAttribute('aria-hidden', 'true');
    expect(track!.querySelector(`.${styles.thumb}`)).not.toBeNull();
  });

  it('appends a caller-provided className after its own', () => {
    render(<Switch className="mine">Enable notifications</Switch>);
    expect(getLabel()).toHaveClass(styles.switch!, 'mine');
  });

  it('forwards a typed ref to the underlying <label>', () => {
    const ref = createRef<HTMLLabelElement>();
    render(<Switch ref={ref}>Enable notifications</Switch>);
    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
    expect(ref.current).toBe(getLabel());
  });

  it('toggles on click and reports the next state through onChange', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch onChange={onChange}>Enable notifications</Switch>);
    const switchInput = screen.getByRole('switch', {
      name: 'Enable notifications',
    });
    await user.click(switchInput);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(switchInput).toBeChecked();
    await user.click(switchInput);
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(switchInput).not.toBeChecked();
  });

  it('toggles with the Space key', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch onChange={onChange}>Enable notifications</Switch>);
    const switchInput = screen.getByRole('switch', {
      name: 'Enable notifications',
    });
    await user.tab();
    expect(switchInput).toHaveFocus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(switchInput).toBeChecked();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(switchInput).not.toBeChecked();
  });

  it('supports controlled selection via isSelected', () => {
    render(<Switch isSelected>Enable notifications</Switch>);
    expect(screen.getByRole('switch')).toBeChecked();
    expect(getLabel()).toHaveAttribute('data-selected');
  });

  describe('disabled', () => {
    // Both selection states: the on-state disabled CSS differs (accent fill
    // must be dropped), so disabled must hold across both.
    it.each([
      ['off', false],
      ['on', true],
    ] as const)(
      'while %s: disables the native input and blocks onChange',
      async (_name, defaultSelected) => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(
          <Switch isDisabled defaultSelected={defaultSelected} onChange={onChange}>
            Enable notifications
          </Switch>,
        );
        const switchInput = screen.getByRole('switch');
        expect(switchInput).toBeDisabled();
        expect(getLabel()).toHaveAttribute('data-disabled');
        await user.click(switchInput);
        expect(onChange).not.toHaveBeenCalled();
        if (defaultSelected) {
          expect(switchInput).toBeChecked();
        } else {
          expect(switchInput).not.toBeChecked();
        }
      },
    );
  });

  describe('accessibility', () => {
    it('has no axe violations (default)', async () => {
      const { container } = render(<Switch>Enable notifications</Switch>);
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (on)', async () => {
      const { container } = render(
        <Switch defaultSelected>Enable notifications</Switch>,
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (disabled)', async () => {
      const { container } = render(
        <Switch isDisabled>Enable notifications</Switch>,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
