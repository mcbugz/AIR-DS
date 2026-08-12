import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, CardBody, CardFooter, CardHeader } from './Card';

const meta = {
  title: 'Components/Card',
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --- one story per elevation value -------------------------------------- */

export const Flat: Story = {
  args: {
    elevation: 'flat',
    children: <CardBody>A flat card is outlined by its border.</CardBody>,
  },
};

export const Raised: Story = {
  args: {
    elevation: 'raised',
    children: (
      <CardBody>A raised card is lifted by the card shadow.</CardBody>
    ),
  },
};

/* --- composition ----------------------------------------------------------
   CardHeader / CardBody / CardFooter are the ONLY sanctioned slots. */

export const FullComposition: Story = {
  args: { elevation: 'raised' },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--ds-text-size-lg)',
            color: 'var(--ds-color-text-primary)',
          }}
        >
          Team members
        </h3>
      </CardHeader>
      <CardBody>
        Invite collaborators to this workspace. Everyone gets read access;
        editors can publish.
      </CardBody>
      <CardFooter>
        <span
          style={{
            fontSize: 'var(--ds-text-size-sm)',
            color: 'var(--ds-color-text-secondary)',
          }}
        >
          3 of 5 seats used
        </span>
      </CardFooter>
    </Card>
  ),
};

export const BodyOnly: Story = {
  render: (args) => (
    <Card {...args}>
      <CardBody>
        A body-only card: one padded content region, no header or footer.
      </CardBody>
    </Card>
  ),
};
