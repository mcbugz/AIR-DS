import { IconBase, type IconProps } from './IconBase';

/**
 * Chevron pointing up — collapse a section or step upward.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords caret, collapse, up, expand-less
 * @example
 * ```tsx
 * <ChevronUpIcon />
 * <ChevronUpIcon size="lg" title="Collapse" />
 * ```
 */
export function ChevronUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 14.5 6-6 6 6" />
    </IconBase>
  );
}
