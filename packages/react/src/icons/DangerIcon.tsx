import { IconBase, type IconProps } from './IconBase';

/**
 * Circled exclamation mark — error, failure, or destructive state.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords alert-circle, error, critical, failed, exclamation
 * @example
 * ```tsx
 * <DangerIcon />
 * <DangerIcon size="lg" title="Error" />
 * ```
 */
export function DangerIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5" />
      <path d="M12 16.5h.01" />
    </IconBase>
  );
}
