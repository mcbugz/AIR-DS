import { IconBase, type IconProps } from './IconBase';

/**
 * Warning triangle — caution, something needs attention.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords caution, triangle, attention, alert-triangle
 * @example
 * ```tsx
 * <WarningIcon />
 * <WarningIcon size="lg" title="Warning" />
 * ```
 */
export function WarningIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 4 2.5 20.5h19L12 4Z" />
      <path d="M12 10.5v4" />
      <path d="M12 17.5h.01" />
    </IconBase>
  );
}
