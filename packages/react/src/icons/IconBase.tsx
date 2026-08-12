import type { ReactNode, RefAttributes } from 'react';
import styles from './Icon.module.css';

/** Icon box scale. Maps to the semantic `--ds-size-icon-*` size tokens. */
export type IconSize = 'sm' | 'md' | 'lg';

/**
 * Public props shared by every `@ds/react/icons` component.
 *
 * Icons are a closed surface on purpose: size, an optional accessible
 * title, and a class hook. No inline `style` (token rule), no arbitrary
 * SVG passthrough.
 */
export interface IconProps extends RefAttributes<SVGSVGElement> {
  /**
   * Icon box size. Maps to the `--ds-size-icon-*` scale (`sm` for dense
   * UI and sm controls, `md` alongside body text, `lg` for prominent
   * placements such as empty states).
   *
   * @default 'md'
   */
  size?: IconSize;
  /**
   * Accessible name for the icon. By default icons are decorative
   * (`aria-hidden="true"`); providing `title` switches the SVG to
   * `role="img"` with an accessible `<title>`, for icons that convey
   * meaning on their own (no adjacent visible text).
   */
  title?: string;
  /**
   * Additional CSS class appended after the component's own classes.
   * Plain string only; inline `style` is intentionally not supported
   * (token rule).
   */
  className?: string;
}

interface IconBaseProps extends IconProps {
  /** SVG geometry (paths/shapes) drawn on the shared 24×24 grid. */
  children: ReactNode;
}

/**
 * Shared SVG shell for every icon: 24×24 viewBox, outline style
 * (`stroke="currentColor"`, stroke-width 2, round caps and joins, no
 * fill), sized by the `--ds-size-icon-*` scale, decorative by default.
 *
 * Internal to `src/icons/` — consumers use the named `<Name>Icon`
 * components; only the `IconProps`/`IconSize` types are public.
 */
export function IconBase({
  size = 'md',
  title,
  className,
  children,
  ref,
}: IconBaseProps) {
  const ownClassName = [styles.icon, styles[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={ownClassName}
      {...(title === undefined
        ? ({ 'aria-hidden': 'true' } as const)
        : ({ role: 'img' } as const))}
    >
      {title === undefined ? null : <title>{title}</title>}
      {children}
    </svg>
  );
}
