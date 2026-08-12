import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { TextArea } from './TextArea';
import styles from './TextArea.module.css';

describe('TextArea', () => {
  it('renders a multi-line textbox with its accessible label', () => {
    render(<TextArea label="Message" />);
    const field = screen.getByRole('textbox', { name: 'Message' });
    expect(field.tagName).toBe('TEXTAREA');
  });

  it('associates the visible label with the textarea', () => {
    render(<TextArea label="Message" />);
    expect(screen.getByLabelText('Message')).toBe(screen.getByRole('textbox'));
  });

  it('applies the base classes and defaults to rows=3 without autoGrow', () => {
    render(<TextArea label="Message" />);
    const field = screen.getByRole('textbox');
    expect(field).toHaveAttribute('rows', '3');
    expect(field).toHaveClass(styles.input!);
    expect(field).not.toHaveClass(styles.autoGrow!);
    expect(field.parentElement).toHaveClass(styles.textarea!);
  });

  it('passes rows through to the textarea', () => {
    render(<TextArea label="Message" rows={6} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '6');
  });

  it('applies the autoGrow class when autoGrow is set', () => {
    render(<TextArea label="Message" autoGrow />);
    const field = screen.getByRole('textbox');
    expect(field).toHaveClass(styles.input!, styles.autoGrow!);
    // rows is kept as the fallback height for browsers without field-sizing.
    expect(field).toHaveAttribute('rows', '3');
  });

  it('appends a caller-provided className after its own', () => {
    render(<TextArea label="Message" className="mine" />);
    const wrapper = screen.getByRole('textbox').parentElement;
    expect(wrapper).toHaveClass(styles.textarea!, 'mine');
  });

  it('forwards a typed ref to the underlying <textarea>', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<TextArea label="Message" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    expect(ref.current).toBe(screen.getByRole('textbox'));
  });

  it('fires onChange with the full value while typing', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TextArea label="Message" onChange={onChange} />);
    await user.type(screen.getByRole('textbox'), 'Hi');
    expect(onChange).toHaveBeenLastCalledWith('Hi');
    expect(screen.getByRole('textbox')).toHaveValue('Hi');
  });

  it('links the description to the textarea via aria-describedby', () => {
    render(<TextArea label="Message" description="Visible to the whole team." />);
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(
      'Visible to the whole team.',
    );
  });

  describe('invalid', () => {
    it('shows the error message and marks the field invalid', () => {
      render(
        <TextArea label="Message" isInvalid errorMessage="Message is required." />,
      );
      const field = screen.getByRole('textbox');
      expect(field).toHaveAttribute('data-invalid');
      expect(screen.getByText('Message is required.')).toBeInTheDocument();
      expect(field).toHaveAccessibleDescription('Message is required.');
    });

    it('renders no error message while the field is valid', () => {
      render(<TextArea label="Message" errorMessage="Message is required." />);
      expect(screen.queryByText('Message is required.')).not.toBeInTheDocument();
      expect(screen.getByRole('textbox')).not.toHaveAttribute('data-invalid');
    });
  });

  describe('disabled', () => {
    it('disables the native textarea and blocks typing', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<TextArea label="Message" isDisabled onChange={onChange} />);
      const field = screen.getByRole('textbox');
      expect(field).toBeDisabled();
      expect(field).toHaveAttribute('data-disabled');
      await user.type(field, 'Hi');
      expect(onChange).not.toHaveBeenCalled();
      expect(field).toHaveValue('');
    });
  });

  describe('read-only', () => {
    it('exposes the read-only state and keeps the value unchanged', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <TextArea label="Message" isReadOnly defaultValue="Frozen" onChange={onChange} />,
      );
      const field = screen.getByRole('textbox');
      expect(field).toHaveAttribute('readonly');
      await user.type(field, 'Hi');
      expect(onChange).not.toHaveBeenCalled();
      expect(field).toHaveValue('Frozen');
    });
  });

  describe('accessibility', () => {
    it('has no axe violations (default)', async () => {
      const { container } = render(
        <TextArea label="Message" placeholder="Tell us more…" />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (invalid with description)', async () => {
      const { container } = render(
        <TextArea
          label="Message"
          description="Visible to the whole team."
          isInvalid
          errorMessage="Message is required."
        />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
