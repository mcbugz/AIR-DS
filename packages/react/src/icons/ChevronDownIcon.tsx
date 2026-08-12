import { IconBase, type IconProps } from './IconBase';

/**
 * Chevron pointing down — expand a section or open a dropdown.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords caret, expand, down, dropdown, select
 * @example
 * ```tsx
 * <ChevronDownIcon />
 * <ChevronDownIcon size="lg" title="Expand" />
 * ```
 */
export function ChevronDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </IconBase>
  );
}
