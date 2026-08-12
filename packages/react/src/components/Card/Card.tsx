import type { HTMLAttributes, RefAttributes } from 'react';
import styles from './Card.module.css';

export interface CardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style'>,
    RefAttributes<HTMLDivElement> {
  /**
   * Elevation treatment of the card surface. `flat` outlines the card with
   * a border; `raised` lifts it with the card shadow (plus a hairline
   * border under the shadow).
   *
   * @default 'flat'
   */
  elevation?: 'flat' | 'raised';
  /**
   * Additional CSS class appended after the component's own classes.
   * Inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

export interface CardHeaderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style'>,
    RefAttributes<HTMLDivElement> {
  /**
   * Additional CSS class appended after the component's own classes.
   * Inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

export interface CardBodyProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style'>,
    RefAttributes<HTMLDivElement> {
  /**
   * Additional CSS class appended after the component's own classes.
   * Inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

export interface CardFooterProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style'>,
    RefAttributes<HTMLDivElement> {
  /**
   * Additional CSS class appended after the component's own classes.
   * Inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

/**
 * Static, purely presentational surface container (a plain `<div>`, no
 * role). Groups related content on a token-driven card surface. The ONLY
 * sanctioned composition slots are `CardHeader`, `CardBody`, and
 * `CardFooter` — there are no other slot components; layout inside a slot
 * is plain HTML with space tokens.
 *
 * @tokenPrefix card
 *
 * @example
 * ```tsx
 * <Card>
 *   <CardBody>Body-only card</CardBody>
 * </Card>
 * <Card elevation="raised">
 *   <CardHeader>
 *     <h3>Plan</h3>
 *   </CardHeader>
 *   <CardBody>Everything in Starter, plus unlimited seats.</CardBody>
 *   <CardFooter>
 *     <Button onPress={upgrade}>Upgrade</Button>
 *   </CardFooter>
 * </Card>
 * ```
 */
export function Card({
  elevation = 'flat',
  className,
  children,
  ...props
}: CardProps) {
  const ownClassName = [styles.card, styles[elevation], className]
    .filter(Boolean)
    .join(' ');

  return (
    <div {...props} className={ownClassName}>
      {children}
    </div>
  );
}

/**
 * Card slot: leading region of a `Card`, separated from the content below
 * by a hairline border. Static presentational `<div>`; put your own
 * semantic heading element inside.
 *
 * @tokenPrefix card
 *
 * @example
 * ```tsx
 * <Card>
 *   <CardHeader>
 *     <h3>Team members</h3>
 *   </CardHeader>
 *   <CardBody>…</CardBody>
 * </Card>
 * ```
 */
export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  const ownClassName = [styles.cardheader, className].filter(Boolean).join(' ');

  return (
    <div {...props} className={ownClassName}>
      {children}
    </div>
  );
}

/**
 * Card slot: main content region of a `Card`. Static presentational
 * `<div>` carrying the card's internal padding.
 *
 * @tokenPrefix card
 *
 * @example
 * ```tsx
 * <Card>
 *   <CardBody>Usage this month: 4,210 requests.</CardBody>
 * </Card>
 * ```
 */
export function CardBody({ className, children, ...props }: CardBodyProps) {
  const ownClassName = [styles.cardbody, className].filter(Boolean).join(' ');

  return (
    <div {...props} className={ownClassName}>
      {children}
    </div>
  );
}

/**
 * Card slot: trailing region of a `Card` (typically actions), separated
 * from the content above by a hairline border. Static presentational
 * `<div>`.
 *
 * @tokenPrefix card
 *
 * @example
 * ```tsx
 * <Card>
 *   <CardBody>Delete this project?</CardBody>
 *   <CardFooter>
 *     <Button variant="danger" onPress={confirm}>Delete</Button>
 *   </CardFooter>
 * </Card>
 * ```
 */
export function CardFooter({ className, children, ...props }: CardFooterProps) {
  const ownClassName = [styles.cardfooter, className].filter(Boolean).join(' ');

  return (
    <div {...props} className={ownClassName}>
      {children}
    </div>
  );
}
