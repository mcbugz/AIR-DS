import * as React from 'react';

export interface AtlasCardProps {
  /** Optional heading rendered at the top of the card. */
  title?: string;
  /** Apply the default inner padding. */
  padded?: boolean;
  children?: React.ReactNode;
}

/** Atlas content card — bordered, raised surface (`.atlas-card`). */
export function Card({ title, padded = true, children }: AtlasCardProps) {
  return (
    <div className={padded ? 'atlas-card' : 'atlas-card atlas-card--flush'}>
      {title ? <h3 className="atlas-card__title">{title}</h3> : null}
      {children}
    </div>
  );
}
