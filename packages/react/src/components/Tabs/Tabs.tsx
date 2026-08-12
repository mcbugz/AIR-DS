import type { RefAttributes } from 'react';
import {
  Tab as RACTab,
  TabList as RACTabList,
  TabPanel as RACTabPanel,
  Tabs as RACTabs,
  type TabListProps as RACTabListProps,
  type TabPanelProps as RACTabPanelProps,
  type TabProps as RACTabProps,
  type TabsProps as RACTabsProps,
} from 'react-aria-components';
import styles from './Tabs.module.css';

export interface TabsProps
  extends Omit<RACTabsProps, 'className' | 'style' | 'orientation'>,
    RefAttributes<HTMLDivElement> {
  /**
   * Additional CSS class appended after the component's own classes.
   * Narrowed from the react-aria-components render-prop form to a plain
   * string; inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

/**
 * Container for a set of tabs, built on react-aria-components `Tabs`.
 * Compose `TabList` (holding `Tab` triggers) with one `TabPanel` per tab;
 * matching `id`s wire each trigger to its panel. Selection state, keyboard
 * navigation (arrow keys, Home/End), and ARIA `tablist`/`tab`/`tabpanel`
 * wiring all come from React Aria; visual states are driven purely by RAC
 * data attributes (`data-selected`, `data-hovered`, `data-focus-visible`,
 * `data-disabled`) and `--ds-*` tokens. Horizontal only in v1.
 *
 * @racBase Tabs
 * @tokenPrefix tabs
 * @example
 * ```tsx
 * <Tabs defaultSelectedKey="overview">
 *   <TabList aria-label="Project sections">
 *     <Tab id="overview">Overview</Tab>
 *     <Tab id="settings">Settings</Tab>
 *   </TabList>
 *   <TabPanel id="overview">Overview content</TabPanel>
 *   <TabPanel id="settings">Settings content</TabPanel>
 * </Tabs>
 * ```
 */
export function Tabs({ className, ...props }: TabsProps) {
  const ownClassName = [styles.tabs, className].filter(Boolean).join(' ');

  return <RACTabs {...props} className={ownClassName} />;
}

export interface TabListProps
  extends Omit<RACTabListProps<object>, 'className' | 'style'>,
    RefAttributes<HTMLDivElement> {
  /**
   * Additional CSS class appended after the component's own classes.
   * Narrowed from the react-aria-components render-prop form to a plain
   * string; inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

/**
 * The row of tab triggers inside `Tabs`, built on react-aria-components
 * `TabList`. Renders `role="tablist"` and manages roving-tabindex focus for
 * its `Tab` children. Give it an `aria-label` when there is no visible
 * heading labelling the tab set.
 *
 * @racBase TabList
 * @tokenPrefix tabs
 * @example
 * ```tsx
 * <TabList aria-label="Account settings">
 *   <Tab id="profile">Profile</Tab>
 *   <Tab id="security">Security</Tab>
 * </TabList>
 * ```
 */
export function TabList({ className, ...props }: TabListProps) {
  const ownClassName = [styles.tablist, className].filter(Boolean).join(' ');

  return <RACTabList {...props} className={ownClassName} />;
}

export interface TabProps
  extends Omit<RACTabProps, 'className' | 'style'>,
    RefAttributes<HTMLDivElement> {
  /**
   * Additional CSS class appended after the component's own classes.
   * Narrowed from the react-aria-components render-prop form to a plain
   * string; inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

/**
 * A single tab trigger inside `TabList`, built on react-aria-components
 * `Tab`. The `id` links it to the `TabPanel` with the same `id`. The
 * selected tab shows an accent indicator line and emphasized text;
 * `isDisabled` removes it from selection and keyboard navigation.
 *
 * @racBase Tab
 * @tokenPrefix tabs
 * @example
 * ```tsx
 * <Tab id="billing">Billing</Tab>
 * <Tab id="danger" isDisabled>Danger zone</Tab>
 * ```
 */
export function Tab({ className, ...props }: TabProps) {
  const ownClassName = [styles.tab, className].filter(Boolean).join(' ');

  return <RACTab {...props} className={ownClassName} />;
}

export interface TabPanelProps
  extends Omit<RACTabPanelProps, 'className' | 'style'>,
    RefAttributes<HTMLDivElement> {
  /**
   * Additional CSS class appended after the component's own classes.
   * Narrowed from the react-aria-components render-prop form to a plain
   * string; inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

/**
 * The content region for one tab, built on react-aria-components
 * `TabPanel`. The `id` links it to the `Tab` with the same `id`; only the
 * selected panel is mounted (pass `shouldForceMount` to keep it in the DOM).
 * React Aria labels the panel from its tab and makes it focusable when it
 * contains no focusable content.
 *
 * @racBase TabPanel
 * @tokenPrefix tabs
 * @example
 * ```tsx
 * <TabPanel id="billing">
 *   <p>Billing details…</p>
 * </TabPanel>
 * ```
 */
export function TabPanel({ className, ...props }: TabPanelProps) {
  const ownClassName = [styles.tabpanel, className].filter(Boolean).join(' ');

  return <RACTabPanel {...props} className={ownClassName} />;
}
