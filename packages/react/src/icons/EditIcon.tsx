import { IconBase, type IconProps } from './IconBase';

/**
 * Pencil — edit, rename, or modify.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords pencil, write, modify, rename, compose
 * @example
 * ```tsx
 * <EditIcon />
 * <EditIcon size="lg" title="Edit" />
 * ```
 */
export function EditIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M16.8 3.7a2.1 2.1 0 0 1 3.5 3.5L8.5 19 3 21l2-5.5L16.8 3.7Z" />
    </IconBase>
  );
}
