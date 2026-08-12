import { IconBase, type IconProps } from './IconBase';

/**
 * Chevron pointing left — previous item or collapsed navigation.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords caret, back, left, previous
 * @example
 * ```tsx
 * <ChevronLeftIcon />
 * <ChevronLeftIcon size="lg" title="Previous" />
 * ```
 */
export function ChevronLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m14.5 6-6 6 6 6" />
    </IconBase>
  );
}
