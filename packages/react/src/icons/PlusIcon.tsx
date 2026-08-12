import { IconBase, type IconProps } from './IconBase';

/**
 * Plus sign — add or create something new.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords add, create, new, increase
 * @example
 * ```tsx
 * <PlusIcon />
 * <PlusIcon size="lg" title="Add item" />
 * ```
 */
export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}
