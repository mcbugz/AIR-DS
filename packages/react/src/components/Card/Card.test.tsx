import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { Card, CardBody, CardFooter, CardHeader } from './Card';
import styles from './Card.module.css';

describe('Card', () => {
  it('renders its children in a presentational <div> with no role', () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.tagName).toBe('DIV');
    expect(card).not.toHaveAttribute('role');
    expect(card).toHaveTextContent('Content');
  });

  it('defaults to elevation="flat"', () => {
    render(<Card data-testid="card">Content</Card>);
    expect(screen.getByTestId('card')).toHaveClass(styles.card!, styles.flat!);
  });

  it.each(['flat', 'raised'] as const)(
    'applies elevation=%s class',
    (elevation) => {
      render(
        <Card data-testid="card" elevation={elevation}>
          Content
        </Card>,
      );
      const card = screen.getByTestId('card');
      expect(card).toHaveClass(styles.card!, styles[elevation]!);
    },
  );

  it('appends a caller-provided className after its own', () => {
    render(
      <Card data-testid="card" className="mine">
        Content
      </Card>,
    );
    expect(screen.getByTestId('card')).toHaveClass(styles.card!, 'mine');
  });

  it('forwards a typed ref to the underlying <div>', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Card data-testid="card" ref={ref}>
        Content
      </Card>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(screen.getByTestId('card'));
  });

  describe('slots', () => {
    it.each([
      ['CardHeader', CardHeader, 'cardheader'],
      ['CardBody', CardBody, 'cardbody'],
      ['CardFooter', CardFooter, 'cardfooter'],
    ] as const)(
      '%s renders a <div> with its base class and children',
      (_name, Slot, baseClass) => {
        render(<Slot data-testid="slot">Slot content</Slot>);
        const slot = screen.getByTestId('slot');
        expect(slot.tagName).toBe('DIV');
        expect(slot).toHaveClass(styles[baseClass]!);
        expect(slot).toHaveTextContent('Slot content');
      },
    );

    it.each([
      ['CardHeader', CardHeader, 'cardheader'],
      ['CardBody', CardBody, 'cardbody'],
      ['CardFooter', CardFooter, 'cardfooter'],
    ] as const)(
      '%s appends a caller-provided className after its own',
      (_name, Slot, baseClass) => {
        render(
          <Slot data-testid="slot" className="mine">
            Slot content
          </Slot>,
        );
        expect(screen.getByTestId('slot')).toHaveClass(
          styles[baseClass]!,
          'mine',
        );
      },
    );

    it.each([
      ['CardHeader', CardHeader],
      ['CardBody', CardBody],
      ['CardFooter', CardFooter],
    ] as const)('%s forwards a typed ref to its <div>', (_name, Slot) => {
      const ref = createRef<HTMLDivElement>();
      render(
        <Slot data-testid="slot" ref={ref}>
          Slot content
        </Slot>,
      );
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toBe(screen.getByTestId('slot'));
    });

    it('renders the full header/body/footer composition inside Card', () => {
      render(
        <Card data-testid="card">
          <CardHeader>Header</CardHeader>
          <CardBody>Body</CardBody>
          <CardFooter>Footer</CardFooter>
        </Card>,
      );
      const card = screen.getByTestId('card');
      const [header, body, footer] = Array.from(card.children);
      expect(header).toHaveClass(styles.cardheader!);
      expect(header).toHaveTextContent('Header');
      expect(body).toHaveClass(styles.cardbody!);
      expect(body).toHaveTextContent('Body');
      expect(footer).toHaveClass(styles.cardfooter!);
      expect(footer).toHaveTextContent('Footer');
    });
  });

  describe('accessibility', () => {
    it('has no axe violations (default, body only)', async () => {
      const { container } = render(
        <Card>
          <CardBody>Content</CardBody>
        </Card>,
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no axe violations (raised, full composition)', async () => {
      const { container } = render(
        <Card elevation="raised">
          <CardHeader>
            <h3>Title</h3>
          </CardHeader>
          <CardBody>Body</CardBody>
          <CardFooter>Footer</CardFooter>
        </Card>,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
