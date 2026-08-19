// Fixture test file for the vitest-axe coverage scanner. Never executed —
// scanned as text by collectVitestAxeEvidence.
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { render } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders a label', () => {
    expect(render(<Button>Go</Button>)).toBeTruthy();
  });

  it('has no axe violations (default)', async () => {
    const { container } = render(<Button>Go</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations (loading)', async () => {
    const { container } = render(<Button isLoading>Go</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
