import type { HTMLAttributes, RefAttributes } from 'react';
import styles from './Badge.module.css';

export interface BadgeProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, 'className' | 'style'>,
    RefAttributes<HTMLSpanElement> {
  /**
   * Status intent of the badge. `neutral` is a plain label, `info` an
   * informational note, `success` a positive state, `warning` a caution,
   * `danger` an error or destructive state. Soft recipe: each tone pairs a
   * status surface background with its matching status text color — never a
   * solid fill.
   *
   * @default 'neutral'
   */
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  /**
   * Additional CSS class appended after the component's own classes.
   * Plain string only; inline `style` is intentionally not supported
   * (token rule).
   */
  className?: string;
}

/**
 * Static status label rendered as a plain `<span>`. Purely presentational:
 * no interaction, no focus, no ARIA role beyond the text itself. Tones use
 * the soft recipe — a `*-surface` background with the matching `*-text`
 * foreground via the `--ds-badge-*` component hooks.
 *
 * @tokenPrefix badge
 *
 * @example
 * ```tsx
 * <Badge>Draft</Badge>
 * <Badge tone="success">Active</Badge>
 * <Badge tone="danger">Failed</Badge>
 * ```
 */
export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: BadgeProps) {
  const ownClassName = [styles.badge, styles[tone], className]
    .filter(Boolean)
    .join(' ');

  return (
    <span {...props} className={ownClassName}>
      {children}
    </span>
  );
}
