import type { ReactElement, RefAttributes } from 'react';
import {
  OverlayArrow,
  Tooltip as RACTooltip,
  TooltipTrigger,
  type TooltipProps as RACTooltipProps,
} from 'react-aria-components';
import styles from './Tooltip.module.css';

export interface TooltipProps
  extends Omit<RACTooltipProps, 'className' | 'style' | 'children' | 'placement'>,
    RefAttributes<HTMLDivElement> {
  /**
   * Text shown inside the tooltip bubble. Deliberately typed as `string`,
   * not `ReactNode`: a tooltip vanishes as soon as pointer or focus leaves
   * its trigger, so links, buttons, or any other interactive content inside
   * it could never be reached by keyboard or assistive technology. The type
   * forbids that class of misuse at compile time.
   */
  content: string;
  /**
   * The trigger element the tooltip describes. Must be a focusable,
   * hoverable element (e.g. `Button`) — React Aria attaches hover *and*
   * focus triggering to it, which keyboard accessibility requires.
   */
  children: ReactElement;
  /**
   * Which side of the trigger the tooltip appears on. Automatically flips
   * to the opposite side when there is not enough room in the viewport.
   *
   * @default 'top'
   */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * Warmup delay in milliseconds before the tooltip shows on hover.
   * Showing on keyboard focus is always immediate. The default is the
   * react-aria warmup delay (no dedicated motion token exists for tooltip
   * delay in the current token set).
   *
   * @default 1500
   */
  delay?: number;
  /**
   * Additional CSS class appended after the component's own classes.
   * Narrowed from the react-aria-components render-prop form to a plain
   * string; inline `style` is intentionally not supported (token rule).
   */
  className?: string;
}

/**
 * Contextual text label shown near a trigger element on hover or keyboard
 * focus, built on react-aria-components `TooltipTrigger` + `Tooltip`.
 * Open/close timing, positioning, flipping, and the `role="tooltip"` /
 * `aria-describedby` wiring come from React Aria; visuals are driven purely
 * by RAC data attributes (`data-placement`, `data-entering`, `data-exiting`)
 * and `--ds-*` tokens (inverse-surface recipe via the `--ds-tooltip-*`
 * hooks). Content is plain text only — tooltips never hold interactive
 * content.
 *
 * @racBase Tooltip
 * @tokenPrefix tooltip
 * @example
 * ```tsx
 * <Tooltip content="Save your changes">
 *   <Button onPress={save}>Save</Button>
 * </Tooltip>
 * <Tooltip content="Delete project" placement="bottom" delay={500}>
 *   <Button variant="ghost" aria-label="Delete">🗑</Button>
 * </Tooltip>
 * ```
 */
export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 1500,
  isOpen,
  defaultOpen,
  onOpenChange,
  className,
  ...props
}: TooltipProps) {
  const ownClassName = [styles.tooltip, className].filter(Boolean).join(' ');

  return (
    // Open state lives on the trigger: it owns the hover/focus interactions,
    // and the RAC Tooltip defers to the trigger's state via context.
    <TooltipTrigger
      delay={delay}
      {...(isOpen !== undefined ? { isOpen } : null)}
      {...(defaultOpen !== undefined ? { defaultOpen } : null)}
      {...(onOpenChange !== undefined ? { onOpenChange } : null)}
    >
      {children}
      <RACTooltip
        offset={8}
        {...props}
        placement={placement}
        className={ownClassName}
      >
        <OverlayArrow className={[styles.arrow].filter(Boolean).join(' ')}>
          <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true">
            <path d="M0 0 L4 4 L8 0" />
          </svg>
        </OverlayArrow>
        {content}
      </RACTooltip>
    </TooltipTrigger>
  );
}
