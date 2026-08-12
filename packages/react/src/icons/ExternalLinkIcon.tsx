import { IconBase, type IconProps } from './IconBase';

/**
 * Box with outbound arrow — opens in a new tab or another site.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords open, new-tab, outbound, href, outgoing
 * @example
 * ```tsx
 * <ExternalLinkIcon />
 * <ExternalLinkIcon size="lg" title="Opens in a new tab" />
 * ```
 */
export function ExternalLinkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M11 5.5H5.5A1.5 1.5 0 0 0 4 7v11.5A1.5 1.5 0 0 0 5.5 20H17a1.5 1.5 0 0 0 1.5-1.5V13" />
      <path d="M14.5 3.5h6v6" />
      <path d="m20.5 3.5-9 9" />
    </IconBase>
  );
}
