import { IconBase, type IconProps } from './IconBase';

/**
 * Trash can — delete or discard.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords delete, remove, bin, discard, destroy
 * @example
 * ```tsx
 * <TrashIcon />
 * <TrashIcon size="lg" title="Delete" />
 * ```
 */
export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
      <path d="M6 7v12.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7" />
      <path d="M10 11.5v5" />
      <path d="M14 11.5v5" />
    </IconBase>
  );
}
