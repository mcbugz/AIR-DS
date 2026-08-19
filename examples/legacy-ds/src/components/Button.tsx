import * as React from 'react';

export interface AtlasButtonProps {
  /** Visual style of the button. */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Control size. */
  size?: 'sm' | 'md' | 'lg';
  /** Disables the control. */
  disabled?: boolean;
  /** Click handler. */
  onClick?: () => void;
  children?: React.ReactNode;
}

/**
 * Atlas push button. Renders a native `<button>` with the `.atlas-btn`
 * class family from styles/atlas.css.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  children,
}: AtlasButtonProps) {
  return (
    <button
      type="button"
      className={`atlas-btn atlas-btn--${variant} atlas-btn--${size}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
