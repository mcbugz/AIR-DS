import { IconBase, type IconProps } from './IconBase';

/**
 * Chevron pointing right — next item or drill-in navigation.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords caret, forward, right, next, drill-in
 * @example
 * ```tsx
 * <ChevronRightIcon />
 * <ChevronRightIcon size="lg" title="Next" />
 * ```
 */
export function ChevronRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </IconBase>
  );
}
