import type { ReactNode, RefAttributes } from 'react';
import {
  Button as RACButton,
  type ButtonProps as RACButtonProps,
} from 'react-aria-components';
import styles from './IconButton.module.css';

export interface IconButtonProps
  extends Omit<
      RACButtonProps,
      'className' | 'style' | 'isPending' | 'children' | 'aria-label'
    >,
    RefAttributes<HTMLButtonElement> {
  /**
   * Accessible name for the button. Required at the type level: the icon is
   * decorative (rendered `aria-hidden`), so this label is the ONLY accessible
   * name the control has. There is no escape hatch.
   */
  'aria-label': string;
  /**
   * Visual intent of the button. `ghost` is the low-emphasis default for
   * toolbar/inline icon actions; `primary` is a main action, `secondary` a
   * supporting action, `danger` a destructive action.
   *
   * @default 'ghost'
   */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /**
   * Control size. The button is square: both dimensions come from the
   * button height scale.
   *
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * The icon to render. Presented to assistive technology as decorative
   * (`aria-hidden`); the accessible name comes from `aria-label`.
   */
  children?: ReactNode;
  /**
   * Additional CSS class appended after the component's own classes.
   * Narrowed from the react-aria-components render-prop form to a plain
   * string; inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

/**
 * Icon-only push button built on react-aria-components `Button`. A square
 * control (width and height both from the button height scale) whose single
 * child is a decorative icon; `aria-label` is required at the type level
 * because it is the control's only accessible name. Keyboard behavior, focus
 * management, and press semantics come from React Aria; visual states are
 * driven purely by RAC data attributes (`data-hovered`, `data-pressed`,
 * `data-focus-visible`, `data-disabled`) and `--ds-*` tokens.
 *
 * Documented NR-008 exception (lead decision): IconButton belongs to the
 * button family and consumes the `--ds-button-*` component-tier hook
 * namespace rather than forking an `--ds-iconbutton-*` namespace of its own,
 * so customer overrides of the button family restyle both controls together.
 *
 * @racBase Button
 * @example
 * ```tsx
 * <IconButton aria-label="Close" onPress={close}>
 *   <CloseIcon />
 * </IconButton>
 * <IconButton aria-label="Add item" variant="primary" size="lg" onPress={add}>
 *   <PlusIcon />
 * </IconButton>
 * <IconButton aria-label="Delete row" variant="danger" onPress={remove}>
 *   <TrashIcon />
 * </IconButton>
 * ```
 */
export function IconButton({
  variant = 'ghost',
  size = 'md',
  className,
  children,
  ...props
}: IconButtonProps) {
  const ownClassName = [
    styles.iconbutton,
    styles[variant],
    styles[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <RACButton {...props} className={ownClassName}>
      <span className={styles.icon} aria-hidden="true">
        {children}
      </span>
    </RACButton>
  );
}
