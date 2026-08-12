import { IconBase, type IconProps } from './IconBase';

/**
 * Arrow pointing down — downward movement, descending sort, or decrease.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords down, descending, sort, decrease, south
 * @example
 * ```tsx
 * <ArrowDownIcon />
 * <ArrowDownIcon size="lg" title="Sorted descending" />
 * ```
 */
export function ArrowDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 4.5v15" />
      <path d="m5.5 13 6.5 6.5 6.5-6.5" />
    </IconBase>
  );
}
