import type { ReactNode, RefAttributes } from 'react';
import {
  Checkbox as RACCheckbox,
  type CheckboxProps as RACCheckboxProps,
} from 'react-aria-components';
import styles from './Checkbox.module.css';

export interface CheckboxProps
  extends Omit<
      RACCheckboxProps,
      | 'className'
      | 'style'
      | 'children'
      | 'isSelected'
      | 'defaultSelected'
      | 'onChange'
      | 'isIndeterminate'
      | 'isDisabled'
      | 'isInvalid'
      | 'isRequired'
    >,
    RefAttributes<HTMLLabelElement> {
  /**
   * Label content rendered next to the box. Always provide a visible label;
   * the whole label is the click target.
   */
  children?: ReactNode;
  /**
   * Whether the checkbox is selected (controlled). Pair with `onChange`.
   */
  isSelected?: boolean;
  /**
   * Whether the checkbox is selected initially (uncontrolled).
   */
  defaultSelected?: boolean;
  /**
   * Handler called when the selection state changes. Receives the next
   * selected state.
   */
  onChange?: (isSelected: boolean) => void;
  /**
   * Marks the checkbox as indeterminate ("mixed"): a dash is shown instead
   * of a check and assistive technology announces the mixed state. Typical
   * for a "select all" control over a partially selected set.
   */
  isIndeterminate?: boolean;
  /**
   * Disables the checkbox: interaction is blocked and the native input is
   * disabled.
   */
  isDisabled?: boolean;
  /**
   * Marks the checkbox as failing validation; the box takes the danger
   * treatment and the state is exposed to assistive technology.
   */
  isInvalid?: boolean;
  /**
   * Marks the checkbox as required before form submission.
   */
  isRequired?: boolean;
  /**
   * Additional CSS class appended after the component's own classes.
   * Narrowed from the react-aria-components render-prop form to a plain
   * string; inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

/**
 * Accessible checkbox built on react-aria-components `Checkbox`. The visible
 * box is CSS-drawn over a visually hidden native input; the check and
 * indeterminate marks are inline SVG stroked with `currentColor`. Keyboard
 * behavior (Space toggles), focus management, and ARIA state come from React
 * Aria; visual states are driven purely by RAC data attributes
 * (`data-selected`, `data-indeterminate`, `data-hovered`, `data-pressed`,
 * `data-focus-visible`, `data-disabled`, `data-invalid`) and `--ds-*` tokens.
 *
 * @racBase Checkbox
 * @tokenPrefix checkbox
 * @example
 * ```tsx
 * <Checkbox onChange={setAccepted}>Accept terms</Checkbox>
 * <Checkbox isSelected={allSelected} isIndeterminate={someSelected} onChange={toggleAll}>
 *   Select all
 * </Checkbox>
 * <Checkbox isRequired isInvalid={showError}>I agree to the policy</Checkbox>
 * ```
 */
export function Checkbox({ className, children, ...props }: CheckboxProps) {
  const ownClassName = [styles.checkbox, className].filter(Boolean).join(' ');

  return (
    <RACCheckbox {...props} className={ownClassName}>
      {({ isIndeterminate }) => (
        <>
          <span className={styles.box} aria-hidden="true">
            {isIndeterminate ? (
              <svg className={styles.mark} viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6h7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg className={styles.mark} viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6.5 5 9l4.5-5.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          {children}
        </>
      )}
    </RACCheckbox>
  );
}
