import { IconBase, type IconProps } from './IconBase';

/**
 * Circled check mark — positive result or completed operation.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords circle-check, complete, ok, passed, done
 * @example
 * ```tsx
 * <SuccessIcon />
 * <SuccessIcon size="lg" title="Success" />
 * ```
 */
export function SuccessIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.8 2.8 5.2-6.6" />
    </IconBase>
  );
}
