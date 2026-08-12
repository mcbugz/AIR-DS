import { IconBase, type IconProps } from './IconBase';

/**
 * Check mark — confirmation, completion, or a selected state.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords confirm, done, complete, tick, selected
 * @example
 * ```tsx
 * <CheckIcon />
 * <CheckIcon size="lg" title="Completed" />
 * ```
 */
export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m4.5 12.5 5.5 5.5 9.5-11.5" />
    </IconBase>
  );
}
