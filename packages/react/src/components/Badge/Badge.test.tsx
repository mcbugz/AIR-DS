import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { Badge } from './Badge';
import styles from './Badge.module.css';

describe('Badge', () => {
  it('renders its label in a <span>', () => {
    render(<Badge>Active</Badge>);
    const badge = screen.getByText('Active');
    expect(badge).toBeInTheDocument();
    expect(badge.tagName).toBe('SPAN');
  });

  it('defaults to tone="neutral"', () => {
    render(<Badge>Draft</Badge>);
    expect(screen.getByText('Draft')).toHaveClass(
      styles.badge!,
      styles.neutral!,
    );
  });

  it.each(['neutral', 'info', 'success', 'warning', 'danger'] as const)(
    'applies tone=%s class',
    (tone) => {
      render(<Badge tone={tone}>Status</Badge>);
      expect(screen.getByText('Status')).toHaveClass(
        styles.badge!,
        styles[tone]!,
      );
    },
  );

  it('appends a caller-provided className after its own', () => {
    render(<Badge className="mine">Draft</Badge>);
    expect(screen.getByText('Draft')).toHaveClass(styles.badge!, 'mine');
  });

  it('forwards a typed ref to the underlying <span>', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Badge ref={ref}>Draft</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
    expect(ref.current).toBe(screen.getByText('Draft'));
  });

  it('is static: not focusable and exposes no tabindex', () => {
    render(<Badge>Draft</Badge>);
    const badge = screen.getByText('Draft');
    expect(badge).not.toHaveAttribute('tabindex');
    badge.focus();
    expect(badge).not.toHaveFocus();
  });

  describe('accessibility', () => {
    it('has no axe violations (default)', async () => {
      const { container } = render(<Badge>Draft</Badge>);
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (non-default tone)', async () => {
      const { container } = render(<Badge tone="danger">Failed</Badge>);
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
