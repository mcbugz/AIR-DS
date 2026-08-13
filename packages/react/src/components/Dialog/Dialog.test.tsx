import { createRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button as RACButton } from 'react-aria-components';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Dialog } from './Dialog';
import styles from './Dialog.module.css';

describe('Dialog', () => {
  it('renders an accessible dialog named by its title', () => {
    render(
      <Dialog title="Settings" defaultOpen>
        <p>Body</p>
      </Dialog>,
    );
    expect(
      screen.getByRole('dialog', { name: 'Settings' }),
    ).toBeInTheDocument();
  });

  it('wires aria-labelledby to the rendered title heading', () => {
    render(
      <Dialog title="Settings" defaultOpen>
        <p>Body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    const heading = screen.getByRole('heading', { name: 'Settings' });
    expect(heading).toHaveClass(styles.title!);
    expect(heading).toHaveAttribute('id');
    expect(dialog).toHaveAttribute('aria-labelledby', heading.getAttribute('id'));
  });

  // F10: with no focusable children, React Aria focuses the panel itself on
  // mount — keyboard users must then get the canonical focus ring, keyed off
  // the data-focus-visible attribute (NR-009), set via useFocusRing in
  // Dialog.tsx because RAC's Dialog does not emit it natively.
  it('shows the focus-visible styling hook when the panel itself is focused (no focusable children)', async () => {
    render(
      <Dialog title="Notice" defaultOpen>
        Plain text only — nothing focusable inside.
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog).toHaveFocus());
    expect(dialog).toHaveAttribute('data-focus-visible');
    expect(dialog).toHaveClass(styles.dialog!);
  });

  it('drops the panel focus-visible hook when focus moves to a child control', async () => {
    const user = userEvent.setup();
    render(
      <Dialog title="Confirm" defaultOpen>
        <RACButton>OK</RACButton>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    // React Aria focuses the panel itself on mount (no child is focused yet).
    await waitFor(() => expect(dialog).toHaveFocus());
    await user.tab();
    expect(screen.getByRole('button', { name: 'OK' })).toHaveFocus();
    expect(dialog).not.toHaveAttribute('data-focus-visible');
  });

  it('defaults to size="md"', () => {
    render(
      <Dialog title="Settings" defaultOpen>
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveClass(styles.dialog!, styles.md!);
  });

  it.each(['sm', 'md', 'lg'] as const)('applies size=%s class', (size) => {
    render(
      <Dialog title="Settings" size={size} defaultOpen>
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveClass(styles.dialog!, styles[size]!);
  });

  it('appends a caller-provided className after its own', () => {
    render(
      <Dialog title="Settings" className="mine" defaultOpen>
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveClass(styles.dialog!, 'mine');
  });

  it('forwards a typed ref to the underlying dialog element', () => {
    const ref = createRef<HTMLElement>();
    render(
      <Dialog title="Settings" ref={ref} defaultOpen>
        <p>Body</p>
      </Dialog>,
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(screen.getByRole('dialog'));
  });

  it('opens via the trigger and fires onOpenChange(true)', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog
        title="Settings"
        trigger={<RACButton>Open settings</RACButton>}
        onOpenChange={onOpenChange}
      >
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('closes on Escape and fires onOpenChange(false)', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog
        title="Settings"
        trigger={<RACButton>Open settings</RACButton>}
        onOpenChange={onOpenChange}
      >
        <p>Body</p>
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('closes on backdrop interaction when dismissable', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog title="Settings" defaultOpen onOpenChange={onOpenChange}>
        <p>Body</p>
      </Dialog>,
    );
    await screen.findByRole('dialog');
    const backdrop = document.querySelector(`.${styles.backdrop}`)!;
    await user.click(backdrop as HTMLElement);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('supports controlled isOpen/onOpenChange', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <Dialog title="Settings" isOpen onOpenChange={onOpenChange}>
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    // Controlled: the dialog stays until the owner flips isOpen.
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    rerender(
      <Dialog title="Settings" isOpen={false} onOpenChange={onOpenChange}>
        <p>Body</p>
      </Dialog>,
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  describe('isDismissable={false}', () => {
    it('blocks Escape and does not fire onOpenChange', async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(
        <Dialog
          title="Accept terms"
          isDismissable={false}
          defaultOpen
          onOpenChange={onOpenChange}
        >
          <p>Body</p>
        </Dialog>,
      );
      await user.keyboard('{Escape}');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('blocks backdrop interaction and does not fire onOpenChange', async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(
        <Dialog
          title="Accept terms"
          isDismissable={false}
          defaultOpen
          onOpenChange={onOpenChange}
        >
          <p>Body</p>
        </Dialog>,
      );
      const backdrop = document.querySelector(`.${styles.backdrop}`)!;
      await user.click(backdrop as HTMLElement);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('still closes via the children render-prop close callback', async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(
        <Dialog
          title="Accept terms"
          isDismissable={false}
          defaultOpen
          onOpenChange={onOpenChange}
        >
          {({ close }) => (
            <RACButton onPress={close}>Accept</RACButton>
          )}
        </Dialog>,
      );
      await user.click(screen.getByRole('button', { name: 'Accept' }));
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });
  });

  describe('focus management (from RAC)', () => {
    it('moves focus inside the dialog when it opens', async () => {
      const user = userEvent.setup();
      render(
        <Dialog title="Settings" trigger={<RACButton>Open settings</RACButton>}>
          <p>Body</p>
        </Dialog>,
      );
      await user.click(screen.getByRole('button', { name: 'Open settings' }));
      const dialog = await screen.findByRole('dialog');
      await waitFor(() =>
        expect(dialog.contains(document.activeElement)).toBe(true),
      );
    });

    it('contains Tab focus within the open dialog', async () => {
      const user = userEvent.setup();
      render(
        <Dialog title="Settings" defaultOpen>
          <RACButton>First</RACButton>
          <RACButton>Second</RACButton>
        </Dialog>,
      );
      const dialog = screen.getByRole('dialog');
      await waitFor(() =>
        expect(dialog.contains(document.activeElement)).toBe(true),
      );
      // Tab past every tabbable: focus must wrap inside the dialog.
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  describe('accessibility', () => {
    it('has no axe violations (open dialog)', async () => {
      render(
        <Dialog title="Settings" defaultOpen>
          <p>Body</p>
        </Dialog>,
      );
      const backdrop = document.querySelector(`.${styles.backdrop}`)!;
      expect(await axe(backdrop as HTMLElement)).toHaveNoViolations();
    });

    it('has no axe violations (open non-dismissable dialog with actions)', async () => {
      render(
        <Dialog title="Accept terms" isDismissable={false} defaultOpen>
          {({ close }) => (
            <RACButton onPress={close}>Accept</RACButton>
          )}
        </Dialog>,
      );
      const backdrop = document.querySelector(`.${styles.backdrop}`)!;
      expect(await axe(backdrop as HTMLElement)).toHaveNoViolations();
    });
  });
});
