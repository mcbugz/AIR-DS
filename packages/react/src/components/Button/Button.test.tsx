import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Button } from './Button';
import styles from './Button.module.css';

describe('Button', () => {
  it('renders an accessible button with its label', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('defaults to variant="primary" and size="md"', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass(styles.button!, styles.primary!, styles.md!);
  });

  it.each([
    ['primary', 'sm'],
    ['secondary', 'md'],
    ['ghost', 'lg'],
    ['danger', 'md'],
  ] as const)('applies variant=%s / size=%s classes', (variant, size) => {
    render(
      <Button variant={variant} size={size}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass(styles[variant]!, styles[size]!);
  });

  it('appends a caller-provided className after its own', () => {
    render(<Button className="mine">Save</Button>);
    expect(screen.getByRole('button')).toHaveClass(styles.button!, 'mine');
  });

  it('forwards a typed ref to the underlying <button>', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Save</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toBe(screen.getByRole('button'));
  });

  it('fires onPress when pressed', async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(<Button onPress={onPress}>Save</Button>);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  describe('isLoading', () => {
    it('announces the busy state and keeps the label accessible', () => {
      render(<Button isLoading>Saving…</Button>);
      const button = screen.getByRole('button', { name: 'Saving…' });
      // RAC pending semantics: aria-disabled (still focusable), data-pending.
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('data-pending');
    });

    it('shows a decorative CSS-only spinner', () => {
      render(<Button isLoading>Saving…</Button>);
      const spinner = screen
        .getByRole('button')
        .querySelector(`.${styles.spinner}`);
      expect(spinner).not.toBeNull();
      expect(spinner).toHaveAttribute('aria-hidden', 'true');
    });

    it('blocks interaction while loading', async () => {
      const onPress = vi.fn();
      const user = userEvent.setup();
      render(
        <Button isLoading onPress={onPress}>
          Saving…
        </Button>,
      );
      await user.click(screen.getByRole('button', { name: 'Saving…' }));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('disabled', () => {
    // Every variant: disabled must hold across variant-specific CSS
    // (danger has its own disabled treatment).
    it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
      'variant=%s disables the native button and blocks onPress',
      async (variant) => {
        const onPress = vi.fn();
        const user = userEvent.setup();
        render(
          <Button variant={variant} isDisabled onPress={onPress}>
            Save
          </Button>,
        );
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('data-disabled');
        expect(button).toHaveClass(styles[variant]!);
        await user.click(button);
        expect(onPress).not.toHaveBeenCalled();
      },
    );
  });

  describe('accessibility', () => {
    it('has no axe violations (default)', async () => {
      const { container } = render(<Button>Save</Button>);
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (loading)', async () => {
      const { container } = render(<Button isLoading>Saving…</Button>);
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
