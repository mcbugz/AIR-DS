import { createRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Select } from './Select';
import styles from './Select.module.css';

const fruits = [
  { id: 'apple', label: 'Apple' },
  { id: 'banana', label: 'Banana' },
  { id: 'cherry', label: 'Cherry' },
];

function renderSelect(props: Partial<Parameters<typeof Select>[0]> = {}) {
  return render(
    <Select
      label="Favorite fruit"
      placeholder="Pick a fruit"
      items={fruits}
      {...props}
    />,
  );
}

describe('Select', () => {
  it('renders a labeled trigger showing the placeholder', () => {
    renderSelect();
    const trigger = screen.getByRole('button', { name: /Favorite fruit/ });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Pick a fruit');
  });

  it('applies the base class to the field wrapper', () => {
    renderSelect();
    const wrapper = screen.getByRole('button', {
      name: /Favorite fruit/,
    }).parentElement;
    expect(wrapper).toHaveClass(styles.select!);
  });

  it('appends a caller-provided className after its own', () => {
    renderSelect({ className: 'mine' });
    const wrapper = screen.getByRole('button', {
      name: /Favorite fruit/,
    }).parentElement;
    expect(wrapper).toHaveClass(styles.select!, 'mine');
  });

  it('forwards a typed ref to the underlying field wrapper <div>', () => {
    const ref = createRef<HTMLDivElement>();
    renderSelect({ ref });
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveClass(styles.select!);
  });

  it('associates the visible label with the trigger via aria-labelledby', () => {
    renderSelect();
    const trigger = screen.getByRole('button', { name: /Favorite fruit/ });
    const labelledBy = trigger.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const labelText = labelledBy!
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent)
      .join(' ');
    expect(labelText).toContain('Favorite fruit');
  });

  it('links the description to the trigger via aria-describedby', () => {
    renderSelect({ description: 'Shown on your profile.' });
    const trigger = screen.getByRole('button', { name: /Favorite fruit/ });
    const describedBy = trigger.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const describedText = describedBy!
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent)
      .join(' ');
    expect(describedText).toContain('Shown on your profile.');
  });

  it('renders the controlled selection in the trigger', () => {
    renderSelect({ selectedKey: 'banana' });
    expect(
      screen.getByRole('button', { name: /Favorite fruit/ }),
    ).toHaveTextContent('Banana');
  });

  it('opens on click and selects an option with the pointer', async () => {
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();
    renderSelect({ onSelectionChange });
    const trigger = screen.getByRole('button', { name: /Favorite fruit/ });

    await user.click(trigger);
    const listbox = await screen.findByRole('listbox');
    expect(listbox).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);

    await user.click(screen.getByRole('option', { name: 'Cherry' }));
    expect(onSelectionChange).toHaveBeenCalledWith('cherry');
    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveTextContent('Cherry');
  });

  // react-aria positions the popover with an inline zIndex (100000), which
  // outranks any class declaration — the z token must travel as an inline
  // style to reach the rendered overlay. jsdom cannot resolve var() to a
  // computed value, so the contract asserted here is the style attribute
  // carrying the token reference.
  it('layers the open popover via the --ds-z-dropdown token (inline style)', async () => {
    const user = userEvent.setup();
    renderSelect();
    await user.click(screen.getByRole('button', { name: /Favorite fruit/ }));
    const listbox = await screen.findByRole('listbox');
    const popover = listbox.closest(`.${styles.popover}`);
    expect(popover).not.toBeNull();
    expect(popover?.getAttribute('style') ?? '').toContain(
      'var(--ds-z-dropdown)',
    );
  });

  it('supports the full keyboard path: open, navigate, select', async () => {
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();
    renderSelect({ onSelectionChange });
    const trigger = screen.getByRole('button', { name: /Favorite fruit/ });

    await user.tab();
    expect(trigger).toHaveFocus();

    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');

    // Opening via keyboard focuses the first option; one ArrowDown → Banana.
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelectionChange).toHaveBeenCalledWith('banana');
    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveTextContent('Banana');
    // Focus restoration to the trigger happens after the popover unmounts.
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  describe('invalid', () => {
    it('exposes data-invalid and shows the linked error message', () => {
      const { container } = renderSelect({
        isInvalid: true,
        errorMessage: 'Pick a fruit to continue.',
      });
      expect(container.querySelector(`.${styles.select!}`)).toHaveAttribute('data-invalid');
      const error = screen.getByText('Pick a fruit to continue.');
      expect(error).toBeInTheDocument();

      const trigger = screen.getByRole('button', { name: /Favorite fruit/ });
      const describedBy = trigger.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const describedText = describedBy!
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent)
        .join(' ');
      expect(describedText).toContain('Pick a fruit to continue.');
    });

    it('hides the error message while valid', () => {
      renderSelect({ errorMessage: 'Pick a fruit to continue.' });
      expect(
        screen.queryByText('Pick a fruit to continue.'),
      ).not.toBeInTheDocument();
    });
  });

  describe('disabled', () => {
    it('disables the trigger and blocks opening', async () => {
      const onSelectionChange = vi.fn();
      const user = userEvent.setup();
      const { container } = renderSelect({ isDisabled: true, onSelectionChange });
      const trigger = screen.getByRole('button', { name: /Favorite fruit/ });

      expect(trigger).toBeDisabled();
      expect(container.querySelector(`.${styles.select!}`)).toHaveAttribute('data-disabled');
      await user.click(trigger);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(onSelectionChange).not.toHaveBeenCalled();
    });
  });

  describe('disabled option', () => {
    it('exposes aria-disabled and blocks selecting that option', async () => {
      const onSelectionChange = vi.fn();
      const user = userEvent.setup();
      renderSelect({
        items: [
          { id: 'apple', label: 'Apple' },
          { id: 'banana', label: 'Banana', isDisabled: true },
        ],
        onSelectionChange,
      });

      await user.click(screen.getByRole('button', { name: /Favorite fruit/ }));
      const disabledOption = await screen.findByRole('option', {
        name: 'Banana',
      });
      expect(disabledOption).toHaveAttribute('aria-disabled', 'true');
      expect(disabledOption).toHaveAttribute('data-disabled');

      await user.click(disabledOption);
      expect(onSelectionChange).not.toHaveBeenCalled();
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has no axe violations (default)', async () => {
      const { container } = renderSelect({
        description: 'Shown on your profile.',
      });
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (invalid)', async () => {
      const { container } = renderSelect({
        isInvalid: true,
        errorMessage: 'Pick a fruit to continue.',
      });
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
