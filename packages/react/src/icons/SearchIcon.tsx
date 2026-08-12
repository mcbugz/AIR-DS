import { IconBase, type IconProps } from './IconBase';

/**
 * Magnifying glass — search, find, or filter.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords find, magnifier, filter, lookup, query
 * @example
 * ```tsx
 * <SearchIcon />
 * <SearchIcon size="lg" title="Search" />
 * ```
 */
export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.2 16.2 4.3 4.3" />
    </IconBase>
  );
}
