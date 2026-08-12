import { IconBase, type IconProps } from './IconBase';

/**
 * Minus sign — remove, decrease, or an indeterminate state.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords subtract, remove, decrease, indeterminate
 * @example
 * ```tsx
 * <MinusIcon />
 * <MinusIcon size="lg" title="Remove item" />
 * ```
 */
export function MinusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
    </IconBase>
  );
}
