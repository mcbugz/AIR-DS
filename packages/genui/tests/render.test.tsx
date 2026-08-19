/**
 * Renderer proof: validated documents render through the REAL @ds/react
 * components (RTL assertions per component category), intents bind only
 * through the host, unbound intents disable with a dev warning, and the
 * renderer fails closed on every gap.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GenUIScreen, GenUIValidationError, buildComponentMap } from '../src/GenUIScreen.js';
import type { GenUIDocument } from '../src/schema.js';
import type { ComponentsIndex } from '../src/registryTypes.js';
import { docOf, registries } from './helpers.js';

function renderDoc(doc: GenUIDocument, bindings: Record<string, (...args: never[]) => void> = {}) {
  return render(<GenUIScreen doc={doc} registries={registries} bindings={bindings} />);
}

describe('static components (Alert, Badge, Card family)', () => {
  it('renders an Alert with its tone role and a Badge label', () => {
    renderDoc(
      docOf(
        { component: 'Alert', props: { tone: 'danger', title: 'Failed' }, children: ['Payment failed.'] },
        { component: 'Badge', props: { tone: 'success' }, children: ['Active'] },
      ),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Payment failed.');
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders the Card composition slots', () => {
    renderDoc(
      docOf({
        component: 'Card',
        props: { elevation: 'raised' },
        children: [
          { component: 'CardHeader', children: [{ text: 'Plan', role: 'heading3' }] },
          { component: 'CardBody', children: ['Everything in Starter.'] },
          { component: 'CardFooter', children: [{ component: 'Button', children: ['Upgrade'] }] },
        ],
      }),
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByText('Everything in Starter.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upgrade' })).toBeInTheDocument();
  });
});

describe('layout and text nodes (the NR-001 / NR-002 answers)', () => {
  it('renders stack/row/grid with token-var styles only', () => {
    const { container } = renderDoc(
      docOf({
        layout: 'stack',
        gap: 'lg',
        inset: 'md',
        children: [
          { layout: 'row', gap: 'sm', children: ['a'] },
          { layout: 'grid', columns: 3, gap: 'none', children: ['b'] },
        ],
      }),
    );
    const [stack, row, grid] = Array.from(container.querySelectorAll('div[style]'));
    expect(stack).toHaveStyle({ display: 'flex', flexDirection: 'column' });
    expect(stack?.getAttribute('style')).toContain('var(--ds-space-gap-lg)');
    expect(stack?.getAttribute('style')).toContain('var(--ds-space-inset-md)');
    expect(row).toHaveStyle({ display: 'flex', flexDirection: 'row' });
    expect(grid).toHaveStyle({ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' });
  });

  it('maps text roles to semantic HTML with --ds-text-* tokens', () => {
    renderDoc(
      docOf(
        { text: 'Section', role: 'heading2' },
        { text: 'Subsection', role: 'heading3' },
        { text: 'Body copy.' },
        { text: 'Fine print', role: 'caption' },
      ),
    );
    const h2 = screen.getByRole('heading', { level: 2, name: 'Section' });
    expect(h2.tagName).toBe('H2');
    expect(h2.getAttribute('style')).toContain('var(--ds-text-size-xl)');
    expect(screen.getByRole('heading', { level: 3, name: 'Subsection' }).tagName).toBe('H3');
    expect(screen.getByText('Body copy.').tagName).toBe('P');
    expect(screen.getByText('Fine print').getAttribute('style')).toContain(
      'var(--ds-color-text-secondary)',
    );
  });

  it('renders the screen title as the page h1', () => {
    render(
      <GenUIScreen
        doc={{ version: '1.0', screen: { title: 'Settings', nodes: [] } }}
        registries={registries}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });
});

describe('intents — the only route to behavior', () => {
  it('bound intent fires the host binding on press', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    renderDoc(docOf({ component: 'Button', props: { intent: 'save' }, children: ['Save'] }), {
      save,
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('form-field intents receive the changed value', async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    const pick = vi.fn();
    renderDoc(
      docOf(
        { component: 'Switch', props: { intent: 'toggle' }, children: ['Notifications'] },
        {
          component: 'RadioGroup',
          props: { label: 'Density', intent: 'set-density' },
          children: [
            { component: 'Radio', props: { value: 'compact' }, children: ['Compact'] },
            { component: 'Radio', props: { value: 'cozy' }, children: ['Cozy'] },
          ],
        },
      ),
      { toggle, 'set-density': pick },
    );
    await user.click(screen.getByRole('switch', { name: 'Notifications' }));
    expect(toggle).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole('radio', { name: 'Cozy' }));
    expect(pick).toHaveBeenCalledWith('cozy');
  });

  it('unbound intent renders the control DISABLED with a dev warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      renderDoc(docOf({ component: 'Button', props: { intent: 'ghost-intent' }, children: ['Go'] }));
      expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('ghost-intent'));
    } finally {
      warn.mockRestore();
    }
  });
});

describe('overlays via declarative props (Dialog, Tooltip)', () => {
  it('Dialog: slot "trigger" child opens the modal', async () => {
    const user = userEvent.setup();
    renderDoc(
      docOf({
        component: 'Dialog',
        props: { title: 'Delete workspace' },
        children: [
          { component: 'Button', props: { variant: 'danger' }, slot: 'trigger', children: ['Delete…'] },
          { text: 'This action cannot be undone.', role: 'body' },
        ],
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete…' }));
    expect(await screen.findByRole('dialog', { name: 'Delete workspace' })).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('Dialog: defaultOpen renders open without any code in the document', () => {
    renderDoc(
      docOf({
        component: 'Dialog',
        props: { title: 'Notice', defaultOpen: true },
        children: [{ text: 'Body' }],
      }),
    );
    expect(screen.getByRole('dialog', { name: 'Notice' })).toBeInTheDocument();
  });

  it('Tooltip: single component child is the focusable trigger', async () => {
    const user = userEvent.setup();
    renderDoc(
      docOf({
        component: 'Tooltip',
        props: { content: 'Saves your changes' },
        children: [{ component: 'Button', children: ['Save'] }],
      }),
    );
    await user.tab(); // keyboard focus shows the tooltip immediately
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveTextContent('Saves your changes'),
    );
  });
});

describe('form fields and tabs', () => {
  it('TextField/TextArea/Select/Checkbox render accessibly labeled', () => {
    renderDoc(
      docOf(
        { component: 'TextField', props: { label: 'Email', placeholder: 'you@example.com' } },
        { component: 'TextArea', props: { label: 'Notes', rows: 4 } },
        {
          component: 'Select',
          props: { label: 'Region', items: [{ id: 'eu', label: 'Europe' }] },
        },
        { component: 'Checkbox', children: ['Accept terms'] },
      ),
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
    expect(screen.getByLabelText('Region')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Accept terms' })).toBeInTheDocument();
  });

  it('Tabs wire triggers to panels by id', async () => {
    const user = userEvent.setup();
    renderDoc(
      docOf({
        component: 'Tabs',
        props: { defaultSelectedKey: 'a' },
        children: [
          {
            component: 'TabList',
            props: { 'aria-label': 'Sections' },
            children: [
              { component: 'Tab', props: { id: 'a' }, children: ['First'] },
              { component: 'Tab', props: { id: 'b' }, children: ['Second'] },
            ],
          },
          { component: 'TabPanel', props: { id: 'a' }, children: ['Panel A'] },
          { component: 'TabPanel', props: { id: 'b' }, children: ['Panel B'] },
        ],
      }),
    );
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.getByText('Panel A')).toBeInTheDocument();
    expect(screen.queryByText('Panel B')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Second' }));
    expect(await screen.findByText('Panel B')).toBeInTheDocument();
  });
});

describe('fail closed', () => {
  it('throws GenUIValidationError on an invalid document — never best-effort renders', () => {
    expect(() =>
      render(
        <GenUIScreen
          doc={docOf({ component: 'Buton', children: ['x'] })}
          registries={registries}
        />,
      ),
    ).toThrow(GenUIValidationError);
  });

  it('buildComponentMap throws when the registry promises a component the barrel lacks', () => {
    const forged: ComponentsIndex = {
      ...registries.components,
      components: [
        ...registries.components.components,
        {
          name: 'Carousel',
          description: 'forged entry',
          racBase: null,
          racPropsNote: null,
          racProps: null,
          tokenPrefix: null,
          example: '',
          props: [],
        },
      ],
    };
    expect(() => buildComponentMap(forged)).toThrow(/Carousel/);
  });

  it('covers every registry component with a real barrel export', () => {
    const map = buildComponentMap(registries.components);
    expect(map.size).toBe(registries.components.components.length);
  });
});
