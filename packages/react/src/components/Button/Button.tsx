import type { RefAttributes } from 'react';
import {
  Button as RACButton,
  type ButtonProps as RACButtonProps,
} from 'react-aria-components';
import styles from './Button.module.css';

export interface ButtonProps
  extends Omit<RACButtonProps, 'className' | 'style' | 'isPending'>,
    RefAttributes<HTMLButtonElement> {
  /**
   * Visual intent of the button. `primary` is the single main action of a
   * view, `secondary` a supporting action, `ghost` a low-emphasis inline
   * action, `danger` a destructive action.
   *
   * @default 'primary'
   */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /**
   * Control size. Maps to the `--ds-size-control-*` height scale.
   *
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Marks the button as busy with an in-progress action: interaction is
   * disabled, the state is announced to assistive technology, and a
   * CSS-only spinner is shown before the label. The label stays visible.
   *
   * @default false
   */
  isLoading?: boolean;
  /**
   * Additional CSS class appended after the component's own classes.
   * Narrowed from the react-aria-components render-prop form to a plain
   * string; inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

/**
 * Accessible push button built on react-aria-components `Button`.
 * Keyboard behavior, focus management, and press semantics come from React
 * Aria; visual states are driven purely by RAC data attributes
 * (`data-hovered`, `data-pressed`, `data-focus-visible`, `data-disabled`,
 * `data-pending`) and `--ds-*` tokens.
 *
 * @racBase Button
 * @tokenPrefix button
 * @example
 * ```tsx
 * <Button onPress={save}>Save</Button>
 * <Button variant="secondary" size="lg" onPress={cancel}>Cancel</Button>
 * <Button variant="danger" isLoading>Deleting…</Button>
 * ```
 */
export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const ownClassName = [styles.button, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <RACButton {...props} isPending={isLoading} className={ownClassName}>
      {(renderProps) => (
        <>
          {isLoading ? <span className={styles.spinner} aria-hidden="true" /> : null}
          {typeof children === 'function'
            ? children({ ...renderProps, defaultChildren: undefined })
            : children}
        </>
      )}
    </RACButton>
  );
}
