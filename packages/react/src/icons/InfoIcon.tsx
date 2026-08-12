import { IconBase, type IconProps } from './IconBase';

/**
 * Circled i — neutral supplementary information.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords information, help, note, about, hint
 * @example
 * ```tsx
 * <InfoIcon />
 * <InfoIcon size="lg" title="More information" />
 * ```
 */
export function InfoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.5h.01" />
    </IconBase>
  );
}
