import type { RefAttributes } from 'react';
import {
  Button as RACButton,
  FieldError as RACFieldError,
  Label as RACLabel,
  ListBox as RACListBox,
  ListBoxItem as RACListBoxItem,
  Popover as RACPopover,
  Select as RACSelect,
  SelectValue as RACSelectValue,
  Text as RACText,
  type SelectProps as RACSelectProps,
} from 'react-aria-components';
import styles from './Select.module.css';

export interface SelectProps
  extends Omit<
      RACSelectProps<object>,
      | 'className'
      | 'style'
      | 'children'
      | 'items'
      | 'selectionMode'
      | 'value'
      | 'defaultValue'
      | 'onChange'
    >,
    RefAttributes<HTMLDivElement> {
  /**
   * Visible field label. Required: the trigger's accessible name is derived
   * from it, so a Select can never render unlabeled.
   */
  label: string;
  /**
   * Help text rendered below the field and linked to the trigger via
   * `aria-describedby`.
   */
  description?: string;
  /**
   * Error text rendered when the field is invalid (via `isInvalid` or
   * failed native validation) and linked via `aria-describedby`. Hidden
   * while the field is valid.
   */
  errorMessage?: string;
  /**
   * Typed options (v1 is a data-driven API, not free composition). Each
   * option's `id` is the selection key and `label` is the visible and
   * accessible text; `isDisabled` renders the option non-selectable.
   */
  items: Array<{ id: string | number; label: string; isDisabled?: boolean }>;
  /**
   * Text shown in the trigger while no option is selected.
   */
  placeholder?: string;
  /**
   * The `id` of the currently selected option (controlled). `null` means no
   * selection.
   */
  selectedKey?: string | number | null;
  /**
   * The `id` of the initially selected option (uncontrolled).
   */
  defaultSelectedKey?: string | number | null;
  /**
   * Handler called with the selected option's `id` (or `null`) when the
   * selection changes.
   */
  onSelectionChange?: (key: string | number | null) => void;
  /**
   * Whether the field value is invalid. Drives the error border, the
   * `data-invalid` state, and rendering of `errorMessage`.
   *
   * @default false
   */
  isInvalid?: boolean;
  /**
   * Whether the field is disabled: the trigger cannot be focused or opened.
   *
   * @default false
   */
  isDisabled?: boolean;
  /**
   * Whether a selection is required before form submission.
   *
   * @default false
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
 * Accessible single-select built on react-aria-components `Select`,
 * composing the RAC `Label`, `Button`, `SelectValue`, `Popover`, and
 * `ListBox` parts internally behind a data-driven `items` API. Keyboard
 * behavior (arrow keys, typeahead, Enter/Escape), focus management, and
 * label/description/error wiring come from React Aria; visual states are
 * driven purely by RAC data attributes (`data-open`, `data-invalid`,
 * `data-disabled`, `data-focused`, `data-selected`) and `--ds-*` tokens.
 *
 * The trigger consumes the SHARED `--ds-field-*` token namespace — one
 * override surface intentionally shared by TextField, TextArea, and Select
 * so all form fields re-theme together.
 *
 * @racBase Select
 * @tokenPrefix field
 * @example
 * ```tsx
 * <Select
 *   label="Favorite fruit"
 *   placeholder="Pick a fruit"
 *   items={[
 *     { id: 'apple', label: 'Apple' },
 *     { id: 'banana', label: 'Banana' },
 *   ]}
 *   onSelectionChange={setFruit}
 * />
 * <Select label="Plan" items={plans} selectedKey={plan} onSelectionChange={setPlan} isRequired />
 * <Select label="Region" items={regions} isInvalid errorMessage="Pick a region." />
 * ```
 */
export function Select({
  label,
  description,
  errorMessage,
  items,
  className,
  ...props
}: SelectProps) {
  const ownClassName = [styles.select, className].filter(Boolean).join(' ');

  return (
    <RACSelect {...props} className={ownClassName}>
      <RACLabel className={styles.label!}>{label}</RACLabel>
      <RACButton className={styles.trigger!}>
        <RACSelectValue className={styles.value!} />
        <span className={styles.chevron!} aria-hidden="true" />
      </RACButton>
      {description ? (
        <RACText slot="description" className={styles.description!}>
          {description}
        </RACText>
      ) : null}
      <RACFieldError className={styles.error!}>{errorMessage}</RACFieldError>
      <RACPopover className={styles.popover!}>
        <RACListBox items={items} className={styles.listbox!}>
          {(item) => (
            <RACListBoxItem
              id={item.id}
              textValue={item.label}
              isDisabled={item.isDisabled ?? false}
              className={styles.option!}
            >
              {item.label}
            </RACListBoxItem>
          )}
        </RACListBox>
      </RACPopover>
    </RACSelect>
  );
}
