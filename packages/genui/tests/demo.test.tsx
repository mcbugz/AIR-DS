/**
 * The shipped demo document (examples/genui-demo/settings.genui.json) is a
 * contract artifact: it must validate against the real registries, render a
 * working settings screen through the real components, and pass axe.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { validateDocument } from '../src/validate.js';
import { GenUIScreen } from '../src/GenUIScreen.js';
import { loadDemoDoc, registries } from './helpers.js';

const bindings = {
  'update-name': vi.fn(),
  'update-region': vi.fn(),
  'save-profile': vi.fn(),
  'toggle-notifications': vi.fn(),
  'toggle-digest': vi.fn(),
  'set-density': vi.fn(),
  'confirm-delete': vi.fn(),
};

describe('settings.genui.json', () => {
  it('validates clean against the real registries', () => {
    const result = validateDocument(loadDemoDoc(), registries);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.nodeCount).toBeGreaterThan(20);
  });

  it('renders the settings screen with the real components', () => {
    render(<GenUIScreen doc={loadDemoDoc()} registries={registries} bindings={bindings} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Workspace settings' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Settings sections' })).toBeInTheDocument();
    expect(screen.getByLabelText('Workspace name')).toHaveValue('Acme Inc');
    expect(screen.getByLabelText('Region')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Email notifications' })).toBeChecked();
    expect(screen.getByRole('radiogroup', { name: 'Density' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('the danger tab holds the static Alert and the Dialog trigger', async () => {
    const user = userEvent.setup();
    render(<GenUIScreen doc={loadDemoDoc()} registries={registries} bindings={bindings} />);
    await user.click(screen.getByRole('tab', { name: 'Danger zone' }));
    expect(await screen.findByText(/permanently removes all projects/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete workspace…' }));
    expect(await screen.findByRole('dialog', { name: 'Delete workspace' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(bindings['confirm-delete']).toHaveBeenCalled();
  });

  it('intent bindings fire from the rendered document', async () => {
    const user = userEvent.setup();
    render(<GenUIScreen doc={loadDemoDoc()} registries={registries} bindings={bindings} />);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(bindings['save-profile']).toHaveBeenCalled();
    await user.click(screen.getByRole('checkbox', { name: 'Weekly digest' }));
    expect(bindings['toggle-digest']).toHaveBeenCalledWith(true);
  });

  it('passes axe as a rendered composite', async () => {
    const { container } = render(
      <GenUIScreen doc={loadDemoDoc()} registries={registries} bindings={bindings} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  }, 30000);
});
