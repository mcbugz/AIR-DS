import * as React from 'react';

/**
 * Atlas status banner. Untyped legacy JavaScript — no prop contract at all;
 * `tone` is one of info | danger | warning | success by convention only.
 */
export function Banner({ tone, children }) {
  return <div className={`atlas-banner atlas-banner--${tone || 'info'}`}>{children}</div>;
}
