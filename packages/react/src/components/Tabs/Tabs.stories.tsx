import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Tab, TabList, TabPanel, Tabs } from './Tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  args: {
    onSelectionChange: fn(),
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --- default -------------------------------------------------------------- */

export const Default: Story = {
  render: (args) => (
    <Tabs {...args} defaultSelectedKey="overview">
      <TabList aria-label="Project sections">
        <Tab id="overview">Overview</Tab>
        <Tab id="usage">Usage</Tab>
        <Tab id="settings">Settings</Tab>
      </TabList>
      <TabPanel id="overview">Overview panel content.</TabPanel>
      <TabPanel id="usage">Usage panel content.</TabPanel>
      <TabPanel id="settings">Settings panel content.</TabPanel>
    </Tabs>
  ),
};

/* --- states ---------------------------------------------------------------- */

export const DisabledTab: Story = {
  render: (args) => (
    <Tabs {...args} defaultSelectedKey="overview">
      <TabList aria-label="Project sections">
        <Tab id="overview">Overview</Tab>
        <Tab id="usage" isDisabled>
          Usage
        </Tab>
        <Tab id="settings">Settings</Tab>
      </TabList>
      <TabPanel id="overview">Overview panel content.</TabPanel>
      <TabPanel id="usage">Usage panel content.</TabPanel>
      <TabPanel id="settings">Settings panel content.</TabPanel>
    </Tabs>
  ),
};

/* --- many tabs -------------------------------------------------------------- */

export const ManyTabs: Story = {
  render: (args) => (
    <Tabs {...args} defaultSelectedKey="tab-1">
      <TabList aria-label="Report pages">
        {Array.from({ length: 9 }, (_, i) => (
          <Tab key={`tab-${i + 1}`} id={`tab-${i + 1}`}>
            Page {i + 1}
          </Tab>
        ))}
      </TabList>
      {Array.from({ length: 9 }, (_, i) => (
        <TabPanel key={`tab-${i + 1}`} id={`tab-${i + 1}`}>
          Content of page {i + 1}.
        </TabPanel>
      ))}
    </Tabs>
  ),
};

/* --- interaction contracts --------------------------------------------------- */

export const ClickAndArrowKeysSwitchPanels: Story = {
  render: (args) => (
    <Tabs {...args} defaultSelectedKey="overview">
      <TabList aria-label="Project sections">
        <Tab id="overview">Overview</Tab>
        <Tab id="usage">Usage</Tab>
        <Tab id="settings">Settings</Tab>
      </TabList>
      <TabPanel id="overview">Overview panel content.</TabPanel>
      <TabPanel id="usage">Usage panel content.</TabPanel>
      <TabPanel id="settings">Settings panel content.</TabPanel>
    </Tabs>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // Click selects the tab and swaps the visible panel.
    await userEvent.click(canvas.getByRole('tab', { name: 'Usage' }));
    await expect(args.onSelectionChange).toHaveBeenCalledWith('usage');
    await expect(canvas.getByRole('tab', { name: 'Usage' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent(
      'Usage panel content.',
    );

    // Arrow keys move selection (automatic activation) and the panel follows.
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Settings' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent(
      'Settings panel content.',
    );

    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent(
      'Usage panel content.',
    );
  },
};

export const DisabledTabBlocksSelection: Story = {
  render: (args) => (
    <Tabs {...args} defaultSelectedKey="overview">
      <TabList aria-label="Project sections">
        <Tab id="overview">Overview</Tab>
        <Tab id="usage" isDisabled>
          Usage
        </Tab>
        <Tab id="settings">Settings</Tab>
      </TabList>
      <TabPanel id="overview">Overview panel content.</TabPanel>
      <TabPanel id="usage">Usage panel content.</TabPanel>
      <TabPanel id="settings">Settings panel content.</TabPanel>
    </Tabs>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: 'Usage' }));
    await expect(args.onSelectionChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent(
      'Overview panel content.',
    );
  },
};
