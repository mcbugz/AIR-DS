import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Checkbox } from './Checkbox';
import styles from './Checkbox.module.css';

/** The styled element is the RAC label; the role lives on the hidden input. */
function getLabel(): HTMLLabelElement {
  const label = screen.getByRole('checkbox').closest('label');
  if (!label) throw new Error('Checkbox label element not found');
  return label;
}

describe('Checkbox', () => {
  it('renders an accessible checkbox with its label', () => {
    render(<Checkbox>Accept terms</Checkbox>);
    expect(
      screen.getByRole('checkbox', { name: 'Accept terms' }),
    ).toBeInTheDocument();
  });

  it('applies the base class and draws a decorative box with an SVG mark', () => {
    render(<Checkbox>Accept terms</Checkbox>);
    const label = getLabel();
    expect(label).toHaveClass(styles.checkbox!);
    const box = label.querySelector(`.${styles.box}`);
    expect(box).not.toBeNull();
    expect(box).toHaveAttribute('aria-hidden', 'true');
    expect(box!.querySelector(`svg.${styles.mark}`)).not.toBeNull();
  });

  it('appends a caller-provided className after its own', () => {
    render(<Checkbox className="mine">Accept terms</Checkbox>);
    expect(getLabel()).toHaveClass(styles.checkbox!, 'mine');
  });

  it('forwards a typed ref to the underlying <label>', () => {
    const ref = createRef<HTMLLabelElement>();
    render(<Checkbox ref={ref}>Accept terms</Checkbox>);
    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
    expect(ref.current).toBe(getLabel());
  });

  it('toggles on click and reports the next state through onChange', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox onChange={onChange}>Accept terms</Checkbox>);
    const checkbox = screen.getByRole('checkbox', { name: 'Accept terms' });
    await user.click(checkbox);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(checkbox).not.toBeChecked();
  });

  it('toggles with the Space key', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox onChange={onChange}>Accept terms</Checkbox>);
    const checkbox = screen.getByRole('checkbox', { name: 'Accept terms' });
    await user.tab();
    expect(checkbox).toHaveFocus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(checkbox).toBeChecked();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(checkbox).not.toBeChecked();
  });

  it('supports controlled selection via isSelected', () => {
    render(<Checkbox isSelected>Accept terms</Checkbox>);
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(getLabel()).toHaveAttribute('data-selected');
  });

  describe('indeterminate', () => {
    it('exposes the mixed state to assistive technology', () => {
      render(<Checkbox isIndeterminate>Select all</Checkbox>);
      const checkbox = screen.getByRole('checkbox', { name: 'Select all' });
      expect(checkbox).toBePartiallyChecked();
      expect(getLabel()).toHaveAttribute('data-indeterminate');
    });
  });

  describe('disabled', () => {
    it('disables the native input and blocks onChange', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <Checkbox isDisabled onChange={onChange}>
          Accept terms
        </Checkbox>,
      );
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
      expect(getLabel()).toHaveAttribute('data-disabled');
      await user.click(checkbox);
      expect(onChange).not.toHaveBeenCalled();
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('invalid / required', () => {
    it('exposes the invalid state', () => {
      render(<Checkbox isInvalid>Accept terms</Checkbox>);
      expect(getLabel()).toHaveAttribute('data-invalid');
      expect(screen.getByRole('checkbox')).toBeInvalid();
    });

    it('marks the input as required', () => {
      render(<Checkbox isRequired>Accept terms</Checkbox>);
      expect(screen.getByRole('checkbox')).toBeRequired();
    });
  });

  describe('accessibility', () => {
    it('has no axe violations (default)', async () => {
      const { container } = render(<Checkbox>Accept terms</Checkbox>);
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (checked + invalid)', async () => {
      const { container } = render(
        <Checkbox isSelected isInvalid>
          Accept terms
        </Checkbox>,
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (indeterminate)', async () => {
      const { container } = render(
        <Checkbox isIndeterminate>Select all</Checkbox>,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
