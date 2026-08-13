import type { ReactElement, RefAttributes } from 'react';
import { mergeProps, useFocusRing } from 'react-aria';
import {
  Dialog as RACDialog,
  type DialogProps as RACDialogProps,
  DialogTrigger as RACDialogTrigger,
  Heading as RACHeading,
  Modal as RACModal,
  ModalOverlay as RACModalOverlay,
} from 'react-aria-components';
import styles from './Dialog.module.css';

export interface DialogProps
  extends Omit<RACDialogProps, 'className' | 'style' | 'render'>,
    RefAttributes<HTMLElement> {
  /**
   * Dialog title. Rendered as the react-aria-components `Heading` with
   * `slot="title"`, which wires the dialog's `aria-labelledby` to it
   * automatically.
   */
  title: string;
  /**
   * Width step of the dialog panel, applied as a `max-inline-size` cap; the
   * panel shrinks to fit small viewports.
   *
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Whether the dialog can be dismissed by clicking the backdrop or pressing
   * Escape. Set to `false` for flows that require an explicit choice; provide
   * a closing action via the `children` render function's `close` callback.
   *
   * @default true
   */
  isDismissable?: boolean;
  /**
   * Optional trigger element (e.g. a `Button`). When provided, the dialog is
   * wrapped in a react-aria-components `DialogTrigger` and opens when the
   * trigger is pressed. Omit it to control the dialog yourself via `isOpen`.
   */
  trigger?: ReactElement;
  /**
   * Whether the dialog is open (controlled).
   */
  isOpen?: boolean;
  /**
   * Whether the dialog is initially open (uncontrolled).
   */
  defaultOpen?: boolean;
  /**
   * Handler called when the dialog's open state changes (trigger pressed,
   * Escape, backdrop click, or the `close` render-prop callback).
   */
  onOpenChange?: (isOpen: boolean) => void;
  /**
   * Additional CSS class appended after the component's own classes on the
   * dialog panel. Narrowed to a plain string; inline `style` is intentionally
   * not supported (token rule).
   */
  className?: string;
}

/**
 * Modal dialog built on react-aria-components `DialogTrigger` + `Modal` +
 * `Dialog`. Focus trapping, scroll locking, Escape/backdrop dismissal, and
 * `aria-labelledby` wiring all come from React Aria; entry/exit states are
 * driven by RAC data attributes (`data-entering`, `data-exiting`) with
 * `--ds-motion-*` tokens, gated by `prefers-reduced-motion`.
 *
 * @racBase Dialog
 * @tokenPrefix dialog
 * @example
 * ```tsx
 * <Dialog title="Delete project" trigger={<Button variant="danger">Delete…</Button>}>
 *   {({ close }) => (
 *     <>
 *       <p>This action cannot be undone.</p>
 *       <Button variant="danger" onPress={close}>Confirm delete</Button>
 *     </>
 *   )}
 * </Dialog>
 *
 * <Dialog title="Settings" size="lg" isOpen={isOpen} onOpenChange={setOpen}>
 *   <SettingsForm />
 * </Dialog>
 * ```
 */
export function Dialog({
  title,
  size = 'md',
  isDismissable = true,
  trigger,
  isOpen,
  defaultOpen,
  onOpenChange,
  className,
  children,
  ...props
}: DialogProps) {
  const ownClassName = [styles.dialog, styles[size], className]
    .filter(Boolean)
    .join(' ');

  // Panel focus ring (F10): when the dialog holds no focusable children,
  // React Aria focuses the panel itself — which must then show the canonical
  // focus ring. RAC's Dialog does not emit data-focus-visible natively
  // (verified in react-aria-components 1.20.0), and focus handlers passed as
  // props are filtered out, so the supported route is react-aria's
  // useFocusRing attached through the documented `render` escape hatch below.
  // NR-009 still holds: the CSS keys off [data-focus-visible], set here by
  // React Aria's modality tracking, never a pseudo-class.
  const { focusProps, isFocusVisible } = useFocusRing();

  // Open state goes to the DialogTrigger when a trigger is provided,
  // otherwise directly to the ModalOverlay. Built conditionally so
  // `exactOptionalPropertyTypes` never sees an explicit `undefined`.
  const openState: {
    isOpen?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
  } = {};
  if (isOpen !== undefined) openState.isOpen = isOpen;
  if (defaultOpen !== undefined) openState.defaultOpen = defaultOpen;
  if (onOpenChange !== undefined) openState.onOpenChange = onOpenChange;

  const modal = (
    <RACModalOverlay
      className={styles.backdrop!}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={!isDismissable}
      {...(trigger ? {} : openState)}
    >
      <RACModal className={styles.modal!}>
        <RACDialog
          {...props}
          className={ownClassName}
          render={(sectionProps) => (
            <section
              {...mergeProps(sectionProps, focusProps)}
              data-focus-visible={isFocusVisible || undefined}
            />
          )}
        >
          {(renderProps) => (
            <>
              <RACHeading slot="title" className={styles.title!}>
                {title}
              </RACHeading>
              {typeof children === 'function' ? children(renderProps) : children}
            </>
          )}
        </RACDialog>
      </RACModal>
    </RACModalOverlay>
  );

  if (trigger) {
    return (
      <RACDialogTrigger {...openState}>
        {trigger}
        {modal}
      </RACDialogTrigger>
    );
  }

  return modal;
}
