import type { RefAttributes } from 'react';
import {
  FieldError,
  Label,
  Text,
  TextArea as RACTextArea,
  TextField as RACTextField,
  type TextFieldProps as RACTextFieldProps,
} from 'react-aria-components';
import styles from './TextArea.module.css';

export interface TextAreaProps
  extends Omit<
      RACTextFieldProps,
      'className' | 'style' | 'children' | 'type' | 'pattern'
    >,
    RefAttributes<HTMLTextAreaElement> {
  /**
   * Visible label for the field. Always rendered and associated with the
   * textarea for assistive technology — there is no unlabeled variant.
   */
  label: string;
  /**
   * Optional help text rendered below the field and linked to the textarea
   * via `aria-describedby`.
   */
  description?: string;
  /**
   * Error text rendered when the field is invalid (via `isInvalid` or a
   * failed `validate`). When omitted, react-aria-components' built-in
   * validation messages are shown instead.
   */
  errorMessage?: string;
  /**
   * Temporary hint text shown while the field is empty. Never a substitute
   * for `label`.
   */
  placeholder?: string;
  /**
   * Initial visible text rows. With `autoGrow`, serves as the fallback
   * height in browsers without `field-sizing` support.
   *
   * @default 3
   */
  rows?: number;
  /**
   * Grow the field with its content instead of scrolling. Implemented with
   * CSS `field-sizing: content` (no JS, no dependencies); browsers without
   * support fall back to the fixed `rows` height with a scrollbar. Manual
   * resize is disabled while auto-growing.
   *
   * @default false
   */
  autoGrow?: boolean;
  /**
   * Additional CSS class appended after the component's own classes.
   * Narrowed from the react-aria-components render-prop form to a plain
   * string; inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

/**
 * Accessible multi-line text input built on react-aria-components
 * `TextField` with a `TextArea` element. Label, description, and error
 * wiring (`aria-describedby`, `aria-invalid`) come from React Aria; visual
 * states are driven purely by RAC data attributes (`data-hovered`,
 * `data-focus-visible`, `data-disabled`, `data-invalid`) and `--ds-*`
 * tokens. Styling consumes the SHARED `--ds-field-*` hook namespace — by
 * design, TextField, TextArea, and Select theme together as one field
 * surface.
 *
 * @racBase TextField
 * @tokenPrefix field
 * @example
 * ```tsx
 * <TextArea label="Message" placeholder="Tell us more…" />
 * <TextArea label="Notes" description="Visible to the whole team." rows={5} />
 * <TextArea label="Feedback" autoGrow isRequired isInvalid errorMessage="Feedback is required." />
 * ```
 */
export function TextArea({
  label,
  description,
  errorMessage,
  placeholder,
  rows = 3,
  autoGrow = false,
  className,
  ref,
  ...props
}: TextAreaProps) {
  const ownClassName = [styles.textarea, className].filter(Boolean).join(' ');
  const inputClassName = [styles.input, autoGrow ? styles.autoGrow : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <RACTextField {...props} className={ownClassName}>
      <Label className={styles.label}>{label}</Label>
      <RACTextArea
        ref={ref}
        rows={rows}
        placeholder={placeholder}
        className={inputClassName}
      />
      {description ? (
        <Text slot="description" className={styles.description}>
          {description}
        </Text>
      ) : null}
      {/* Render-prop children: `errorMessage` wins, otherwise replicate
          FieldError's default (RAC validation messages). FieldError renders
          nothing while the field is valid. */}
      <FieldError className={styles.error!}>
        {({ validationErrors }) => errorMessage ?? validationErrors.join(' ')}
      </FieldError>
    </RACTextField>
  );
}
