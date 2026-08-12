import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { TextField } from './TextField';
import styles from './TextField.module.css';

describe('TextField', () => {
  it('renders an input associated with its visible label', () => {
    render(<TextField label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByRole('textbox', { name: 'Email' })).toBe(input);
  });

  it('applies the base, label, and input classes', () => {
    const { container } = render(<TextField label="Email" />);
    expect(container.firstChild).toHaveClass(styles.textfield!);
    expect(screen.getByText('Email')).toHaveClass(styles.label!);
    expect(screen.getByLabelText('Email')).toHaveClass(styles.input!);
  });

  it('appends a caller-provided className after its own', () => {
    const { container } = render(<TextField label="Email" className="mine" />);
    expect(container.firstChild).toHaveClass(styles.textfield!, 'mine');
  });

  it('forwards a typed ref to the underlying <input>', () => {
    const ref = createRef<HTMLInputElement>();
    render(<TextField label="Email" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(screen.getByLabelText('Email'));
  });

  it('updates its value and fires onChange while typing', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TextField label="Email" onChange={onChange} />);
    const input = screen.getByLabelText('Email');
    await user.type(input, 'ada@example.com');
    expect(input).toHaveValue('ada@example.com');
    expect(onChange).toHaveBeenLastCalledWith('ada@example.com');
  });

  describe('description', () => {
    it('links the description to the input via aria-describedby', () => {
      render(
        <TextField label="Email" description="We never share your email." />,
      );
      const description = screen.getByText('We never share your email.');
      expect(description).toHaveClass(styles.description!);
      expect(screen.getByLabelText('Email')).toHaveAttribute(
        'aria-describedby',
        expect.stringContaining(description.id),
      );
    });

    it('renders no description element when the prop is omitted', () => {
      const { container } = render(<TextField label="Email" />);
      expect(container.querySelector(`.${styles.description}`)).toBeNull();
    });
  });

  describe('invalid', () => {
    it('shows the error message and marks the input invalid', () => {
      render(
        <TextField
          label="Email"
          isInvalid
          errorMessage="Enter a valid email address."
        />,
      );
      const input = screen.getByLabelText('Email');
      const error = screen.getByText('Enter a valid email address.');
      expect(error).toHaveClass(styles.error!);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('data-invalid');
      expect(input).toHaveAttribute(
        'aria-describedby',
        expect.stringContaining(error.id),
      );
    });

    it('hides the error message while the field is valid', () => {
      render(
        <TextField label="Email" errorMessage="Enter a valid email address." />,
      );
      expect(
        screen.queryByText('Enter a valid email address.'),
      ).not.toBeInTheDocument();
    });
  });

  describe('disabled', () => {
    it('disables the native input and blocks typing', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<TextField label="Email" isDisabled onChange={onChange} />);
      const input = screen.getByLabelText('Email');
      expect(input).toBeDisabled();
      expect(input).toHaveAttribute('data-disabled');
      await user.type(input, 'nope');
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('required', () => {
    it('marks the native input required', () => {
      render(<TextField label="Email" isRequired />);
      expect(screen.getByLabelText('Email')).toBeRequired();
    });
  });

  describe('accessibility', () => {
    it('has no axe violations (default)', async () => {
      const { container } = render(
        <TextField label="Email" description="We never share your email." />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (invalid)', async () => {
      const { container } = render(
        <TextField
          label="Email"
          isInvalid
          errorMessage="Enter a valid email address."
        />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
