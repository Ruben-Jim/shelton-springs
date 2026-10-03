import type React from 'react';

/** Native: no DOM portal; render in place (see webPortal.web.ts). */
export function renderInBodyPortal(children: React.ReactNode): React.ReactNode {
  return children;
}
