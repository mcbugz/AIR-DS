import type { ReactNode, RefAttributes } from 'react';
import {
  FieldError,
  Label,
  Radio as RACRadio,
  RadioGroup as RACRadioGroup,
  Text,
  type RadioGroupProps as RACRadioGroupProps,
  type RadioProps as RACRadioProps,
} from 'react-aria-components';
import styles from './RadioGroup.module.css';

export interface RadioGroupProps
  extends Omit<
      RACRadioGroupProps,
      'className' | 'style' | 'children' | 'orientation'
    >,
    RefAttributes<HTMLDivElement> {
  /**
   * Visible label naming the group. Required: a radio group without an
   * accessible name is an accessibility failure, so the label is part of the
   * typed contract rather than an optional slot.
   */
  label: string;
  /**
   * Layout axis of the options. `vertical` stacks the radios, `horizontal`
   * lays them out in a wrapping row. Keyboard arrow navigation follows the
   * orientation automatically via React Aria.
   *
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal';
  /**
   * Optional helper text rendered below the label and associated with the
   * group via `aria-describedby`.
   */
  description?: string;
  /**
   * Error text rendered below the options. Only shown while the group is
   * invalid (`isInvalid` or form validation); it is associated with the
   * group via `aria-describedby`.
   */
  errorMessage?: string;
  /**
   * Additional CSS class appended after the component's own classes.
   * Narrowed from the react-aria-components render-prop form to a plain
   * string; inline `style` is intentionally not supported (token rule).
   */
  className?: string;
  /**
   * The `Radio` options of the group.
   */
  children: ReactNode;
}

/**
 * A labeled group of mutually exclusive options built on
 * react-aria-components `RadioGroup`. Roving tabindex, arrow-key navigation,
 * and group labelling come from React Aria; visual states are driven purely
 * by RAC data attributes (`data-disabled`, `data-invalid`,
 * `data-orientation`) and `--ds-*` tokens. Selection is single-value:
 * `value`/`defaultValue` plus `onChange` receive the selected `Radio`'s
 * `value` string.
 *
 * @racBase RadioGroup
 * @example
 * ```tsx
 * <RadioGroup label="Notification method" onChange={setMethod}>
 *   <Radio value="email">Email</Radio>
 *   <Radio value="sms">SMS</Radio>
 * </RadioGroup>
 * <RadioGroup label="Density" orientation="horizontal" defaultValue="cozy">
 *   <Radio value="compact">Compact</Radio>
 *   <Radio value="cozy">Cozy</Radio>
 * </RadioGroup>
 * <RadioGroup label="Plan" isInvalid errorMessage="Choose a plan to continue.">
 *   <Radio value="free">Free</Radio>
 *   <Radio value="pro">Pro</Radio>
 * </RadioGroup>
 * ```
 */
export function RadioGroup({
  label,
  orientation = 'vertical',
  description,
  errorMessage,
  className,
  children,
  ...props
}: RadioGroupProps) {
  const ownClassName = [styles.radiogroup, styles[orientation], className]
    .filter(Boolean)
    .join(' ');

  return (
    <RACRadioGroup {...props} orientation={orientation} className={ownClassName}>
      <Label className={styles.label!}>{label}</Label>
      {description ? (
        <Text slot="description" className={styles.description!}>
          {description}
        </Text>
      ) : null}
      <div className={styles.radios}>{children}</div>
      {errorMessage ? (
        <FieldError className={styles.error!}>{errorMessage}</FieldError>
      ) : null}
    </RACRadioGroup>
  );
}

export interface RadioProps
  extends Omit<RACRadioProps, 'className' | 'style' | 'children' | 'value'>,
    RefAttributes<HTMLLabelElement> {
  /**
   * Value this option contributes to the group: it is compared against the
   * group's `value`/`defaultValue` and passed to the group's `onChange`
   * when the option is selected.
   */
  value: string;
  /**
   * Label content rendered next to the CSS-drawn control. Required: every
   * radio needs a visible accessible name.
   */
  children: ReactNode;
  /**
   * Additional CSS class appended after the component's own classes.
   * Narrowed from the react-aria-components render-prop form to a plain
   * string; inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

/**
 * A single option inside a `RadioGroup`, built on react-aria-components
 * `Radio`. The circular control is drawn entirely in CSS (no icon assets)
 * and reflects selection, hover, focus, invalid, and disabled states via
 * RAC data attributes (`data-selected`, `data-hovered`,
 * `data-focus-visible`, `data-invalid`, `data-disabled`).
 *
 * @racBase Radio
 * @example
 * ```tsx
 * <Radio value="email">Email</Radio>
 * <Radio value="sms" isDisabled>SMS</Radio>
 * ```
 */
export function Radio({ className, children, ...props }: RadioProps) {
  const ownClassName = [styles.radio, className].filter(Boolean).join(' ');

  return (
    <RACRadio {...props} className={ownClassName}>
      <span className={styles.control} aria-hidden="true" />
      {children}
    </RACRadio>
  );
}
