import React from 'react';
import './button.css';

// Loose, untyped API — `variant` accepts any string.
export function Button({ variant, size, children, onClick }) {
  return (
    <button
      className={`btn btn-${variant || 'primary'} btn-${size || 'md'}`}
      onClick={onClick}
      style={{ borderRadius: '6px', fontWeight: 600 }}
    >
      {children}
    </button>
  );
}
