import { IconBase, type IconProps } from './IconBase';

/**
 * Eye — visibility, show, or preview.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords view, visibility, show, preview, reveal
 * @example
 * ```tsx
 * <EyeIcon />
 * <EyeIcon size="lg" title="Show password" />
 * ```
 */
export function EyeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}
