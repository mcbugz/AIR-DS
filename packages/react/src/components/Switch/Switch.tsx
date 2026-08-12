import type { ReactNode, RefAttributes } from 'react';
import {
  Switch as RACSwitch,
  type SwitchProps as RACSwitchProps,
} from 'react-aria-components';
import styles from './Switch.module.css';

export interface SwitchProps
  extends Omit<
      RACSwitchProps,
      | 'className'
      | 'style'
      | 'children'
      | 'isSelected'
      | 'defaultSelected'
      | 'onChange'
      | 'isDisabled'
    >,
    RefAttributes<HTMLLabelElement> {
  /**
   * Label content rendered next to the track. Always provide a visible
   * label; the whole label is the click target.
   */
  children?: ReactNode;
  /**
   * Whether the switch is on (controlled). Pair with `onChange`.
   */
  isSelected?: boolean;
  /**
   * Whether the switch is on initially (uncontrolled).
   */
  defaultSelected?: boolean;
  /**
   * Handler called when the on/off state changes. Receives the next
   * selected state.
   */
  onChange?: (isSelected: boolean) => void;
  /**
   * Disables the switch: interaction is blocked and the native input is
   * disabled.
   */
  isDisabled?: boolean;
  /**
   * Additional CSS class appended after the component's own classes.
   * Narrowed from the react-aria-components render-prop form to a plain
   * string; inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

/**
 * Accessible on/off switch built on react-aria-components `Switch`. The
 * visible track and thumb are CSS-drawn over a visually hidden native input
 * (`role="switch"`); the thumb slides with motion tokens and settles
 * instantly under `prefers-reduced-motion`. Keyboard behavior (Space
 * toggles), focus management, and ARIA state come from React Aria; visual
 * states are driven purely by RAC data attributes (`data-selected`,
 * `data-hovered`, `data-pressed`, `data-focus-visible`, `data-disabled`)
 * and `--ds-*` tokens.
 *
 * @racBase Switch
 * @tokenPrefix switch
 * @example
 * ```tsx
 * <Switch onChange={setNotifications}>Enable notifications</Switch>
 * <Switch isSelected={isDark} onChange={setIsDark}>Dark mode</Switch>
 * <Switch isDisabled>Beta features</Switch>
 * ```
 */
export function Switch({ className, children, ...props }: SwitchProps) {
  const ownClassName = [styles.switch, className].filter(Boolean).join(' ');

  return (
    <RACSwitch {...props} className={ownClassName}>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      {children}
    </RACSwitch>
  );
}
