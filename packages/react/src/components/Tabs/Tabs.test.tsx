import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { Tab, TabList, TabPanel, Tabs, type TabsProps } from './Tabs';
import styles from './Tabs.module.css';

function renderTabs(
  tabsProps: Partial<Omit<TabsProps, 'children'>> = {},
  { disableUsage = false }: { disableUsage?: boolean } = {},
) {
  return render(
    <Tabs defaultSelectedKey="overview" {...tabsProps}>
      <TabList aria-label="Project sections">
        <Tab id="overview">Overview</Tab>
        <Tab id="usage" isDisabled={disableUsage}>
          Usage
        </Tab>
        <Tab id="settings">Settings</Tab>
      </TabList>
      <TabPanel id="overview">Overview panel content.</TabPanel>
      <TabPanel id="usage">Usage panel content.</TabPanel>
      <TabPanel id="settings">Settings panel content.</TabPanel>
    </Tabs>,
  );
}

describe('Tabs', () => {
  it('renders an accessible tablist with tabs and the selected tabpanel', () => {
    renderTabs();
    expect(
      screen.getByRole('tablist', { name: 'Project sections' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    // Only the selected panel is mounted.
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'Overview panel content.',
    );
  });

  it('wires tab and tabpanel together with ARIA attributes', () => {
    renderTabs();
    const tab = screen.getByRole('tab', { name: 'Overview' });
    const panel = screen.getByRole('tabpanel');
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(tab).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    expect(screen.getByRole('tab', { name: 'Usage' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('applies the base classes to all four parts', () => {
    const { container } = renderTabs();
    expect(container.querySelector(`.${styles.tabs}`)).not.toBeNull();
    expect(screen.getByRole('tablist')).toHaveClass(styles.tablist!);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveClass(
      styles.tab!,
    );
    expect(screen.getByRole('tabpanel')).toHaveClass(styles.tabpanel!);
  });

  it('appends caller-provided classNames after each part’s own class', () => {
    const { container } = render(
      <Tabs defaultSelectedKey="one" className="mine-tabs">
        <TabList aria-label="Sections" className="mine-tablist">
          <Tab id="one" className="mine-tab">
            One
          </Tab>
        </TabList>
        <TabPanel id="one" className="mine-tabpanel">
          Panel one
        </TabPanel>
      </Tabs>,
    );
    expect(container.querySelector(`.${styles.tabs}`)).toHaveClass(
      styles.tabs!,
      'mine-tabs',
    );
    expect(screen.getByRole('tablist')).toHaveClass(
      styles.tablist!,
      'mine-tablist',
    );
    expect(screen.getByRole('tab')).toHaveClass(styles.tab!, 'mine-tab');
    expect(screen.getByRole('tabpanel')).toHaveClass(
      styles.tabpanel!,
      'mine-tabpanel',
    );
  });

  it('forwards typed refs to the underlying DOM elements of all four parts', () => {
    const tabsRef = createRef<HTMLDivElement>();
    const tabListRef = createRef<HTMLDivElement>();
    const tabRef = createRef<HTMLDivElement>();
    const tabPanelRef = createRef<HTMLDivElement>();
    render(
      <Tabs defaultSelectedKey="one" ref={tabsRef}>
        <TabList aria-label="Sections" ref={tabListRef}>
          <Tab id="one" ref={tabRef}>
            One
          </Tab>
        </TabList>
        <TabPanel id="one" ref={tabPanelRef}>
          Panel one
        </TabPanel>
      </Tabs>,
    );
    expect(tabsRef.current).toBeInstanceOf(HTMLDivElement);
    expect(tabsRef.current).toHaveClass(styles.tabs!);
    expect(tabListRef.current).toBe(screen.getByRole('tablist'));
    expect(tabRef.current).toBe(screen.getByRole('tab', { name: 'One' }));
    expect(tabPanelRef.current).toBe(screen.getByRole('tabpanel'));
  });

  it('selects a tab on click, swaps the visible panel, and fires onSelectionChange', async () => {
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();
    renderTabs({ onSelectionChange });
    await user.click(screen.getByRole('tab', { name: 'Usage' }));
    expect(onSelectionChange).toHaveBeenCalledWith('usage');
    expect(screen.getByRole('tab', { name: 'Usage' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Usage' })).toHaveAttribute(
      'data-selected',
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'Usage panel content.',
    );
  });

  describe('keyboard navigation', () => {
    it('moves selection with arrow keys and updates the visible panel', async () => {
      const user = userEvent.setup();
      renderTabs();
      await user.click(screen.getByRole('tab', { name: 'Overview' }));
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: 'Usage' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tabpanel')).toHaveTextContent(
        'Usage panel content.',
      );
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tabpanel')).toHaveTextContent(
        'Overview panel content.',
      );
    });

    it('skips a disabled tab during arrow-key navigation', async () => {
      const user = userEvent.setup();
      renderTabs({}, { disableUsage: true });
      await user.click(screen.getByRole('tab', { name: 'Overview' }));
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tabpanel')).toHaveTextContent(
        'Settings panel content.',
      );
    });
  });

  describe('disabled', () => {
    it('a disabled tab exposes ARIA state and blocks selection', async () => {
      const onSelectionChange = vi.fn();
      const user = userEvent.setup();
      renderTabs({ onSelectionChange }, { disableUsage: true });
      const disabledTab = screen.getByRole('tab', { name: 'Usage' });
      expect(disabledTab).toHaveAttribute('aria-disabled', 'true');
      expect(disabledTab).toHaveAttribute('data-disabled');
      await user.click(disabledTab);
      expect(onSelectionChange).not.toHaveBeenCalled();
      expect(screen.getByRole('tabpanel')).toHaveTextContent(
        'Overview panel content.',
      );
    });

    it('isDisabled on Tabs disables every tab and blocks selection', async () => {
      const onSelectionChange = vi.fn();
      const user = userEvent.setup();
      renderTabs({ isDisabled: true, onSelectionChange });
      for (const tab of screen.getAllByRole('tab')) {
        expect(tab).toHaveAttribute('aria-disabled', 'true');
      }
      await user.click(screen.getByRole('tab', { name: 'Settings' }));
      expect(onSelectionChange).not.toHaveBeenCalled();
      expect(screen.getByRole('tabpanel')).toHaveTextContent(
        'Overview panel content.',
      );
    });
  });

  describe('accessibility', () => {
    it('has no axe violations (default)', async () => {
      const { container } = renderTabs();
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (disabled tab)', async () => {
      const { container } = renderTabs({}, { disableUsage: true });
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
