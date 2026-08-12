import { IconBase, type IconProps } from './IconBase';

/**
 * X mark — close, dismiss, or clear the current thing.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords x, dismiss, cancel, remove, clear
 * @example
 * ```tsx
 * <CloseIcon />
 * <CloseIcon size="lg" title="Close" />
 * ```
 */
export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </IconBase>
  );
}
