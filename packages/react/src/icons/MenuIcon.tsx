import { IconBase, type IconProps } from './IconBase';

/**
 * Three stacked lines — main menu or navigation drawer.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords hamburger, navigation, list, drawer, nav
 * @example
 * ```tsx
 * <MenuIcon />
 * <MenuIcon size="lg" title="Open menu" />
 * ```
 */
export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6.5h16" />
      <path d="M4 12h16" />
      <path d="M4 17.5h16" />
    </IconBase>
  );
}
