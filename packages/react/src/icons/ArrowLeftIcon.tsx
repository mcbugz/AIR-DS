import { IconBase, type IconProps } from './IconBase';

/**
 * Arrow pointing left — go back or return to the previous view.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords back, left, previous, return, west
 * @example
 * ```tsx
 * <ArrowLeftIcon />
 * <ArrowLeftIcon size="lg" title="Back" />
 * ```
 */
export function ArrowLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M19.5 12h-15" />
      <path d="m11 5.5-6.5 6.5 6.5 6.5" />
    </IconBase>
  );
}
