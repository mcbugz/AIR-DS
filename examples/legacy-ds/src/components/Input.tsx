import * as React from 'react';

/**
 * Atlas text input with a stacked label. Loosely typed on purpose —
 * the props type is inline and `type` is an open string.
 */
export function Input(props: {
  /** Visible label rendered above the control. */
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  /** Native input type (free-form string — legacy API). */
  type?: string;
  /** Error message; when set the input gets the error border. */
  error?: string;
}) {
  return (
    <label className="atlas-field">
      <span className="atlas-field__label">{props.label}</span>
      <input
        className="atlas-input"
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange?.(e.target.value)}
      />
      {props.error ? <span className="atlas-field__error">{props.error}</span> : null}
    </label>
  );
}
