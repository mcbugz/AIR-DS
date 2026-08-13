import { createRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Button } from '../Button/Button';
import { Tooltip } from './Tooltip';
import styles from './Tooltip.module.css';

/* Tooltips portal to document.body, so queries go through `screen`. */

describe('Tooltip', () => {
  it('renders only the trigger while closed', () => {
    render(
      <Tooltip content="More info">
        <Button>Info</Button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'Info' })).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows a role=tooltip element with the content on keyboard focus', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="More info">
        <Button>Info</Button>
      </Tooltip>,
    );
    await user.tab();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('More info');
  });

  it('describes the trigger via aria-describedby while open', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="More info">
        <Button>Info</Button>
      </Tooltip>,
    );
    await user.tab();
    const tooltip = await screen.findByRole('tooltip');
    expect(screen.getByRole('button', { name: 'Info' })).toHaveAttribute(
      'aria-describedby',
      tooltip.id,
    );
  });

  it('hides the tooltip on blur', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="More info">
        <Button>Info</Button>
      </Tooltip>,
    );
    await user.tab();
    await screen.findByRole('tooltip');
    await user.tab();
    await waitFor(() =>
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument(),
    );
  });

  it('fires onOpenChange on focus and blur', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Tooltip content="More info" onOpenChange={onOpenChange}>
        <Button>Info</Button>
      </Tooltip>,
    );
    await user.tab();
    await screen.findByRole('tooltip');
    expect(onOpenChange).toHaveBeenCalledWith(true);
    await user.tab();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('applies its base class and appends a caller-provided className', async () => {
    render(
      <Tooltip content="More info" className="mine" defaultOpen>
        <Button>Info</Button>
      </Tooltip>,
    );
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveClass(styles.tooltip!, 'mine');
  });

  // react-aria positions the tooltip with an inline zIndex (100000), which
  // outranks any class declaration — the z token must travel as an inline
  // style to reach the rendered overlay. jsdom cannot resolve var() to a
  // computed value, so the contract asserted here is the style attribute
  // carrying the token reference.
  it('layers the open tooltip via the --ds-tooltip-z token (inline style)', async () => {
    render(
      <Tooltip content="More info" defaultOpen>
        <Button>Info</Button>
      </Tooltip>,
    );
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.getAttribute('style') ?? '').toContain(
      'var(--ds-tooltip-z)',
    );
  });

  // jsdom has no layout, so the resolved `data-placement` attribute never
  // appears; each placement value must still render an accessible tooltip.
  it.each(['top', 'bottom', 'left', 'right'] as const)(
    'renders an open tooltip with placement=%s',
    async (placement) => {
      render(
        <Tooltip content="More info" placement={placement} defaultOpen>
          <Button>Info</Button>
        </Tooltip>,
      );
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('More info');
      expect(tooltip).toHaveClass(styles.tooltip!);
    },
  );

  it('renders the overlay arrow inside the tooltip', async () => {
    render(
      <Tooltip content="More info" defaultOpen>
        <Button>Info</Button>
      </Tooltip>,
    );
    const tooltip = await screen.findByRole('tooltip');
    const arrow = tooltip.querySelector(`.${styles.arrow} svg`);
    expect(arrow).not.toBeNull();
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
  });

  it('forwards a typed ref to the tooltip element', async () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Tooltip content="More info" defaultOpen ref={ref}>
        <Button>Info</Button>
      </Tooltip>,
    );
    const tooltip = await screen.findByRole('tooltip');
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(tooltip);
  });

  describe('accessibility', () => {
    it('has no axe violations (closed)', async () => {
      const { baseElement } = render(
        <Tooltip content="More info">
          <Button>Info</Button>
        </Tooltip>,
      );
      expect(await axe(baseElement)).toHaveNoViolations();
    });

    it('has no axe violations (open)', async () => {
      const { baseElement } = render(
        <Tooltip content="More info" defaultOpen>
          <Button>Info</Button>
        </Tooltip>,
      );
      await screen.findByRole('tooltip');
      // `region` is a page-level landmark rule; the tooltip portals to
      // document.body by design, which no component can place in a landmark.
      expect(
        await axe(baseElement, {
          rules: { region: { enabled: false } },
        }),
      ).toHaveNoViolations();
    });
  });
});
