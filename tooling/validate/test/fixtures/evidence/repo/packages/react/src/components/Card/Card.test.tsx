// Fixture test file WITHOUT axe assertions — the coverage scanner must count
// this component as uncovered (honest counting).
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    expect(render(<Card>Body</Card>)).toBeTruthy();
  });
});
