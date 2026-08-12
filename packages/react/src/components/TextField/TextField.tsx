import type { RefAttributes } from 'react';
import {
  FieldError,
  Input,
  Label,
  Text,
  TextField as RACTextField,
  type TextFieldProps as RACTextFieldProps,
} from 'react-aria-components';
import styles from './TextField.module.css';

export interface TextFieldProps
  extends Omit<RACTextFieldProps, 'className' | 'style' | 'children'>,
    RefAttributes<HTMLInputElement> {
  /**
   * Visible label for the field. Required: the label is rendered as a RAC
   * `Label` and associated with the input automatically, so the field is
   * always accessibly named.
   */
  label: string;
  /**
   * Optional helper text rendered below the input as a RAC `Text` with
   * `slot="description"`, linked to the input via `aria-describedby`.
   */
  description?: string;
  /**
   * Error text rendered in a RAC `FieldError` below the input. It is only
   * shown while the field is invalid (`isInvalid` or failed validation) and
   * is linked to the input via `aria-describedby`.
   */
  errorMessage?: string;
  /**
   * Placeholder text shown inside the input while it is empty. Forwarded to
   * the inner RAC `Input` (react-aria-components moves `placeholder` off the
   * `TextField` root). Not a substitute for `label`.
   */
  placeholder?: string;
  /**
   * Additional CSS class appended after the component's own classes on the
   * field root. Narrowed from the react-aria-components render-prop form to
   * a plain string; inline `style` is intentionally not supported (token
   * rule).
   */
  className?: string;
}

/**
 * Accessible single-line text input built on react-aria-components
 * `TextField`, composing RAC `Label`, `Input`, `Text` (description), and
 * `FieldError` internally — label association, description/error wiring
 * (`aria-describedby`), and invalid-state announcement come from React Aria.
 * Validation and state flow through the RAC props (`isInvalid`,
 * `isRequired`, `isDisabled`, `value`/`defaultValue`/`onChange`, `type`,
 * `name`, ...). The forwarded `ref` reaches the underlying `<input>`.
 *
 * Styling consumes the `--ds-field-*` component-token namespace, which is
 * SHARED by TextField, TextArea, and Select by design: one customer override
 * retunes every form field consistently.
 *
 * @racBase TextField
 * @example
 * ```tsx
 * <TextField label="Email" type="email" placeholder="you@example.com" />
 * <TextField
 *   label="Display name"
 *   description="Shown on your public profile."
 * />
 * <TextField
 *   label="Email"
 *   isRequired
 *   isInvalid
 *   errorMessage="Enter a valid email address."
 * />
 * ```
 */
export function TextField({
  label,
  description,
  errorMessage,
  placeholder,
  className,
  ref,
  ...props
}: TextFieldProps) {
  const ownClassName = [styles.textfield, className].filter(Boolean).join(' ');

  return (
    <RACTextField {...props} className={ownClassName}>
      <Label className={styles.label}>{label}</Label>
      <Input
        ref={ref}
        className={styles.input!}
        {...(placeholder !== undefined ? { placeholder } : {})}
      />
      {description ? (
        <Text slot="description" className={styles.description}>
          {description}
        </Text>
      ) : null}
      <FieldError className={styles.error!}>{errorMessage}</FieldError>
    </RACTextField>
  );
}
