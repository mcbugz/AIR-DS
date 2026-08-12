import { IconBase, type IconProps } from './IconBase';

/**
 * Calendar page — dates, scheduling, or events.
 *
 * Decorative by default (`aria-hidden="true"`); pass `title` when the icon
 * stands alone and must carry meaning (`role="img"` + accessible title).
 *
 * @keywords date, schedule, event, month, day
 * @example
 * ```tsx
 * <CalendarIcon />
 * <CalendarIcon size="lg" title="Choose date" />
 * ```
 */
export function CalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10.5h16" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </IconBase>
  );
}
