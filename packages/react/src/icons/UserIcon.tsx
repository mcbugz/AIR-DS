import { IconBase, type IconProps } from './IconBase';

/**
 * Single person — user, account, or profile.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords person, account, profile, avatar, member
 * @example
 * ```tsx
 * <UserIcon />
 * <UserIcon size="lg" title="Account" />
 * ```
 */
export function UserIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />
    </IconBase>
  );
}
