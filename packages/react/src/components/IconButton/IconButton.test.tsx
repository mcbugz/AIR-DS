import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { IconButton } from './IconButton';
import styles from './IconButton.module.css';

/** Inline test icon — the system ships no icon set; any SVG node works. */
function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

describe('IconButton', () => {
  it('renders an accessible button named by aria-label', () => {
    render(
      <IconButton aria-label="Add item">
        <PlusIcon />
      </IconButton>,
    );
    expect(
      screen.getByRole('button', { name: 'Add item' }),
    ).toBeInTheDocument();
  });

  it('requires aria-label at the type level', () => {
    render(
      // @ts-expect-error — aria-label is required; omitting it must not compile.
      <IconButton>
        <PlusIcon />
      </IconButton>,
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders the icon as decorative (aria-hidden)', () => {
    render(
      <IconButton aria-label="Add item">
        <PlusIcon />
      </IconButton>,
    );
    const icon = screen
      .getByRole('button')
      .querySelector(`.${styles.icon}`);
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon!.querySelector('svg')).not.toBeNull();
  });

  it('defaults to variant="ghost" and size="md"', () => {
    render(
      <IconButton aria-label="Add item">
        <PlusIcon />
      </IconButton>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass(styles.iconbutton!, styles.ghost!, styles.md!);
  });

  it.each([
    ['primary', 'sm'],
    ['secondary', 'md'],
    ['ghost', 'lg'],
    ['danger', 'md'],
  ] as const)('applies variant=%s / size=%s classes', (variant, size) => {
    render(
      <IconButton aria-label="Add item" variant={variant} size={size}>
        <PlusIcon />
      </IconButton>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass(styles[variant]!, styles[size]!);
  });

  it('appends a caller-provided className after its own', () => {
    render(
      <IconButton aria-label="Add item" className="mine">
        <PlusIcon />
      </IconButton>,
    );
    expect(screen.getByRole('button')).toHaveClass(styles.iconbutton!, 'mine');
  });

  it('forwards a typed ref to the underlying <button>', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <IconButton aria-label="Add item" ref={ref}>
        <PlusIcon />
      </IconButton>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toBe(screen.getByRole('button'));
  });

  it('fires onPress when pressed', async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(
      <IconButton aria-label="Add item" onPress={onPress}>
        <PlusIcon />
      </IconButton>,
    );
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  describe('disabled', () => {
    // Every variant: disabled must hold across variant-specific CSS
    // (secondary and danger have their own disabled treatments).
    it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
      'variant=%s disables the native button and blocks onPress',
      async (variant) => {
        const onPress = vi.fn();
        const user = userEvent.setup();
        render(
          <IconButton
            aria-label="Add item"
            variant={variant}
            isDisabled
            onPress={onPress}
          >
            <PlusIcon />
          </IconButton>,
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
      const { container } = render(
        <IconButton aria-label="Add item">
          <PlusIcon />
        </IconButton>,
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (disabled)', async () => {
      const { container } = render(
        <IconButton aria-label="Add item" isDisabled>
          <PlusIcon />
        </IconButton>,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
