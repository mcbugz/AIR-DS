import type { HTMLAttributes, ReactNode, RefAttributes } from 'react';
import { Button as RACButton } from 'react-aria-components';
import styles from './Alert.module.css';

export interface AlertProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style' | 'role'>,
    RefAttributes<HTMLDivElement> {
  /**
   * Status intent of the alert. Soft recipe: each tone pairs a status
   * surface background with its matching status border and text colors —
   * never a solid fill. The tone also decides the ARIA role: `danger` and
   * `warning` are interruptive and render `role="alert"`; `info` and
   * `success` render the polite `role="status"`.
   *
   * @default 'info'
   */
  tone?: 'info' | 'success' | 'warning' | 'danger';
  /**
   * Optional bold heading line rendered above the message. Replaces the
   * native HTML tooltip attribute of the same name — it is rendered as
   * visible text, never as a tooltip.
   */
  title?: string;
  /**
   * When provided, the alert renders a dismiss control (an icon-only
   * accessible button labeled "Dismiss") and calls this handler when it is
   * pressed. The alert does not remove itself — the caller owns visibility.
   */
  onDismiss?: () => void;
  /**
   * Additional CSS class appended after the component's own classes.
   * Plain string only; inline `style` is intentionally not supported
   * (token rule).
   */
  className?: string;
}

/* Tone icons: inline, decorative (aria-hidden), stroke = currentColor so the
   per-tone icon class controls the color via --ds-alert-icon-*. */
const toneIcons: Record<
  NonNullable<AlertProps['tone']>,
  ReactNode
> = {
  info: (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 9v5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10 6v.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m6.5 10.5 2.5 2.5 4.5-5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3 18 16.5H2L10 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 8.5v3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10 14v.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  danger: (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m7 7 6 6M13 7l-6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
};

/**
 * Static status message rendered as a plain `<div>` with a tone-mapped ARIA
 * role: interruptive tones (`danger`, `warning`) use `role="alert"` so
 * assistive technology announces them immediately; calm tones (`info`,
 * `success`) use the polite `role="status"`. Tones follow the soft recipe —
 * status surface background, status border, status text — through the
 * `--ds-alert-*` component hooks, with a decorative tone icon. An optional
 * dismiss control (react-aria-components `Button` internally) appears when
 * `onDismiss` is provided; the caller owns removing the alert.
 *
 * @example
 * ```tsx
 * <Alert>Your changes were saved as a draft.</Alert>
 * <Alert tone="success" title="Deployed">Build 42 is live.</Alert>
 * <Alert tone="danger" onDismiss={() => setVisible(false)}>
 *   Payment failed — check your card details.
 * </Alert>
 * ```
 */
export function Alert({
  tone = 'info',
  title,
  onDismiss,
  className,
  children,
  ...props
}: AlertProps) {
  const ownClassName = [styles.alert, styles[tone], className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      {...props}
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      className={ownClassName}
    >
      <span className={styles.icon}>{toneIcons[tone]}</span>
      <div className={styles.body}>
        {title ? <div className={styles.title}>{title}</div> : null}
        <div className={styles.message}>{children}</div>
      </div>
      {onDismiss ? (
        <RACButton
          aria-label="Dismiss"
          className={styles.dismiss!}
          onPress={onDismiss}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="m5.5 5.5 9 9M14.5 5.5l-9 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </RACButton>
      ) : null}
    </div>
  );
}
