import React from 'react';

export function Card({ title, children }) {
  return (
    <div style={{ background: '#ffffff', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
      {title ? <h3 style={{ color: '#1e3a8a', fontSize: '18px' }}>{title}</h3> : null}
      {children}
    </div>
  );
}
