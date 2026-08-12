import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Alert } from './Alert';
import styles from './Alert.module.css';

describe('Alert', () => {
  it('renders its message with the polite status role by default', () => {
    render(<Alert>Saved as draft.</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('Saved as draft.');
  });

  it('defaults to tone="info"', () => {
    render(<Alert>Saved as draft.</Alert>);
    expect(screen.getByRole('status')).toHaveClass(
      styles.alert!,
      styles.info!,
    );
  });

  // Role mapping is the ARIA contract: interruptive tones announce
  // immediately (role="alert"), calm tones politely (role="status").
  it.each([
    ['info', 'status'],
    ['success', 'status'],
    ['warning', 'alert'],
    ['danger', 'alert'],
  ] as const)('tone=%s renders role=%s', (tone, role) => {
    render(<Alert tone={tone}>Message</Alert>);
    expect(screen.getByRole(role)).toBeInTheDocument();
  });

  it.each(['info', 'success', 'warning', 'danger'] as const)(
    'applies tone=%s class',
    (tone) => {
      render(<Alert tone={tone}>Message</Alert>);
      const alert = screen.getByRole(
        tone === 'danger' || tone === 'warning' ? 'alert' : 'status',
      );
      expect(alert).toHaveClass(styles.alert!, styles[tone]!);
    },
  );

  it('appends a caller-provided className after its own', () => {
    render(<Alert className="mine">Message</Alert>);
    expect(screen.getByRole('status')).toHaveClass(styles.alert!, 'mine');
  });

  it('forwards a typed ref to the underlying <div>', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Alert ref={ref}>Message</Alert>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(screen.getByRole('status'));
  });

  it('renders the title as visible text, not a tooltip attribute', () => {
    render(<Alert title="Deployed">Build 42 is live.</Alert>);
    const alert = screen.getByRole('status');
    expect(alert).toHaveTextContent('Deployed');
    expect(alert).not.toHaveAttribute('title');
  });

  it('renders a decorative tone icon hidden from assistive technology', () => {
    render(<Alert>Message</Alert>);
    const icon = screen
      .getByRole('status')
      .querySelector(`.${styles.icon} > svg`);
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  describe('dismiss', () => {
    it('renders no dismiss control without onDismiss', () => {
      render(<Alert>Message</Alert>);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders an accessible dismiss control and fires onDismiss', async () => {
      const onDismiss = vi.fn();
      const user = userEvent.setup();
      render(<Alert onDismiss={onDismiss}>Message</Alert>);
      const dismiss = screen.getByRole('button', { name: 'Dismiss' });
      await user.click(dismiss);
      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it('fires onDismiss from the keyboard', async () => {
      const onDismiss = vi.fn();
      const user = userEvent.setup();
      render(<Alert onDismiss={onDismiss}>Message</Alert>);
      await user.tab();
      expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(onDismiss).toHaveBeenCalledOnce();
    });
  });

  describe('accessibility', () => {
    // Per-tone axe run covers each role mapping in its full anatomy
    // (icon + title + dismiss control).
    it.each(['info', 'success', 'warning', 'danger'] as const)(
      'has no axe violations (tone=%s, dismissible with title)',
      async (tone) => {
        const { container } = render(
          <Alert tone={tone} title="Heads up" onDismiss={vi.fn()}>
            Message
          </Alert>,
        );
        expect(await axe(container)).toHaveNoViolations();
      },
    );

    it('has no axe violations (default, message only)', async () => {
      const { container } = render(<Alert>Message</Alert>);
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
