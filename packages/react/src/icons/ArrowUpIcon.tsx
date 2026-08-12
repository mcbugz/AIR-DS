import { IconBase, type IconProps } from './IconBase';

/**
 * Arrow pointing up — upward movement, ascending sort, or increase.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords up, ascending, sort, increase, north
 * @example
 * ```tsx
 * <ArrowUpIcon />
 * <ArrowUpIcon size="lg" title="Sorted ascending" />
 * ```
 */
export function ArrowUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 19.5v-15" />
      <path d="m5.5 11 6.5-6.5 6.5 6.5" />
    </IconBase>
  );
}
