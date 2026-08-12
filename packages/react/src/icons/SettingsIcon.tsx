import { IconBase, type IconProps } from './IconBase';

/**
 * Gear — settings, preferences, configuration.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords gear, cog, preferences, configure, options
 * @example
 * ```tsx
 * <SettingsIcon />
 * <SettingsIcon size="lg" title="Settings" />
 * ```
 */
export function SettingsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M12 2.5v3" />
      <path d="M12 18.5v3" />
      <path d="M2.5 12h3" />
      <path d="M18.5 12h3" />
      <path d="m5.3 5.3 2.1 2.1" />
      <path d="m16.6 16.6 2.1 2.1" />
      <path d="m18.7 5.3-2.1 2.1" />
      <path d="m7.4 16.6-2.1 2.1" />
    </IconBase>
  );
}
