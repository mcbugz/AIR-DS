import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Dialog,
  IconButton,
  Radio,
  RadioGroup,
  Select,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  Tooltip,
} from '@ds/react';
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CloseIcon,
  DangerIcon,
  EditIcon,
  ExternalLinkIcon,
  EyeIcon,
  InfoIcon,
  MenuIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SuccessIcon,
  TrashIcon,
  UserIcon,
  WarningIcon,
} from '@ds/react/icons';

const ICONS = [
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CloseIcon,
  DangerIcon,
  EditIcon,
  ExternalLinkIcon,
  EyeIcon,
  InfoIcon,
  MenuIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SuccessIcon,
  TrashIcon,
  UserIcon,
  WarningIcon,
];

/**
 * Live component gallery — every element below is the real @ds/react
 * component, fully interactive, styled only by whichever brand's tokens.css
 * the hero switcher currently links.
 */
export function Gallery() {
  const [name, setName] = useState('');
  const [role, setRole] = useState<string | number | null>('designer');
  const [notify, setNotify] = useState(true);
  const [terms, setTerms] = useState(false);
  const [plan, setPlan] = useState('team');

  return (
    <section className="section" aria-labelledby="gallery-title">
      <div className="section-inner">
        <p className="eyebrow">Live gallery</p>
        <h2 id="gallery-title" className="section-title">
          Real components, really rendered
        </h2>
        <p className="section-lede">
          Nothing on this page is a screenshot. These are the shipped <code>@ds/react</code>{' '}
          components — react-aria-components underneath, token-only CSS Modules on top — bundled
          straight from <code>packages/react/dist</code>.
        </p>

        <div className="gallery-grid">
          <Card elevation="raised">
            <CardHeader>
              <h3 className="card-title">Buttons</h3>
            </CardHeader>
            <CardBody>
              <div className="demo-rows">
                <div className="demo-row">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                </div>
                <div className="demo-row">
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                  <Button isLoading>Loading</Button>
                  <Button isDisabled>Disabled</Button>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card elevation="raised">
            <CardHeader>
              <h3 className="card-title">Form controls</h3>
            </CardHeader>
            <CardBody>
              <div className="demo-form">
                <TextField
                  label="Workspace name"
                  description="Every field ships its own label, description, and error wiring."
                  placeholder="Acme Inc."
                  value={name}
                  onChange={setName}
                />
                <Select
                  label="Role"
                  items={[
                    { id: 'designer', label: 'Designer' },
                    { id: 'engineer', label: 'Engineer' },
                    { id: 'agent', label: 'AI agent' },
                  ]}
                  selectedKey={role}
                  onSelectionChange={setRole}
                />
                <RadioGroup label="Plan" value={plan} onChange={setPlan}>
                  <Radio value="solo">Solo</Radio>
                  <Radio value="team">Team</Radio>
                  <Radio value="enterprise">Enterprise</Radio>
                </RadioGroup>
                <div className="demo-row">
                  <Switch isSelected={notify} onChange={setNotify}>
                    Notifications
                  </Switch>
                  <Checkbox isSelected={terms} onChange={setTerms}>
                    Accept terms
                  </Checkbox>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card elevation="raised">
            <CardHeader>
              <h3 className="card-title">Tabs</h3>
            </CardHeader>
            <CardBody>
              <Tabs defaultSelectedKey="tokens">
                <TabList aria-label="System layers">
                  <Tab id="tokens">Tokens</Tab>
                  <Tab id="components">Components</Tab>
                  <Tab id="registries">Registries</Tab>
                </TabList>
                <TabPanel id="tokens">
                  <p className="demo-text">
                    232 public tokens in three tiers. The brand tier is the only theming surface.
                  </p>
                </TabPanel>
                <TabPanel id="components">
                  <p className="demo-text">
                    14 components + 25 icons with typed literal-union props — invalid combinations
                    fail at compile time.
                  </p>
                </TabPanel>
                <TabPanel id="registries">
                  <p className="demo-text">
                    Generated closed-world contracts. Anything not enumerated is provably
                    fabricated.
                  </p>
                </TabPanel>
              </Tabs>
            </CardBody>
          </Card>

          <Card elevation="raised">
            <CardHeader>
              <h3 className="card-title">Badges</h3>
            </CardHeader>
            <CardBody>
              <div className="demo-row">
                <Badge tone="neutral">Neutral</Badge>
                <Badge tone="info">Info</Badge>
                <Badge tone="success">Success</Badge>
                <Badge tone="warning">Warning</Badge>
                <Badge tone="danger">Danger</Badge>
              </div>
            </CardBody>
          </Card>

          <Card elevation="raised">
            <CardHeader>
              <h3 className="card-title">Alerts</h3>
            </CardHeader>
            <CardBody>
              <div className="demo-rows">
                <Alert tone="info" title="Info">
                  Registries regenerate on every build.
                </Alert>
                <Alert tone="success" title="Success">
                  Gauntlet green: 662 tests, 0 axe violations.
                </Alert>
                <Alert tone="warning" title="Warning">
                  Hand-written agent docs detected — build the compiler instead.
                </Alert>
                <Alert tone="danger" title="Danger">
                  Token not in registry: the merge is blocked, not flagged.
                </Alert>
              </div>
            </CardBody>
          </Card>

          <Card elevation="raised">
            <CardHeader>
              <h3 className="card-title">Overlays</h3>
            </CardHeader>
            <CardBody>
              <div className="demo-rows">
                <div className="demo-row">
                  <Dialog
                    title="A real dialog"
                    size="sm"
                    trigger={<Button variant="secondary">Open dialog</Button>}
                  >
                    {({ close }) => (
                      <div className="demo-dialog-body">
                        <p className="demo-text">
                          Focus trapping, escape handling, and ARIA come from react-aria-components
                          — accessibility ships inside the component, never hand-rolled.
                        </p>
                        <div className="demo-row-end">
                          <Button onPress={close}>Got it</Button>
                        </div>
                      </div>
                    )}
                  </Dialog>
                </div>
                <div className="demo-row" aria-label="Icon buttons with tooltips">
                  <Tooltip content="Search" delay={400}>
                    <IconButton aria-label="Search" variant="secondary">
                      <SearchIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content="Edit" delay={400}>
                    <IconButton aria-label="Edit" variant="secondary">
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content="Settings" delay={400}>
                    <IconButton aria-label="Settings" variant="ghost">
                      <SettingsIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content="Delete" delay={400}>
                    <IconButton aria-label="Delete" variant="danger">
                      <TrashIcon />
                    </IconButton>
                  </Tooltip>
                </div>
                <p className="demo-caption">Hover an icon button — tooltips are components too.</p>
              </div>
            </CardBody>
          </Card>

          <Card elevation="raised" className="gallery-wide">
            <CardHeader>
              <h3 className="card-title">Icons — the whole closed set</h3>
            </CardHeader>
            <CardBody>
              <div className="icon-strip">
                {ICONS.map((Icon, i) => (
                  <Icon key={i} size="lg" />
                ))}
              </div>
              <p className="demo-caption">
                25 icons, enumerated in <code>registries/icons-metadata.json</code>. A 26th cannot
                be imported, because it cannot exist.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </section>
  );
}
