import { IconBase, type IconProps } from './IconBase';

/**
 * Arrow pointing right — go forward or continue to the next view.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords forward, right, next, continue, east
 * @example
 * ```tsx
 * <ArrowRightIcon />
 * <ArrowRightIcon size="lg" title="Continue" />
 * ```
 */
export function ArrowRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.5 12h15" />
      <path d="m13 5.5 6.5 6.5-6.5 6.5" />
    </IconBase>
  );
}
