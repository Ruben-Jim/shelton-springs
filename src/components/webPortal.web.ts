import type React from 'react';

// react-dom ships no types in this project; only the web bundle ever loads it
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createPortal } = require('react-dom') as {
  createPortal: (children: React.ReactNode, container: Element) => React.ReactPortal;
};

/** Renders children at document.body so page stacking contexts can't cover them. */
export function renderInBodyPortal(children: React.ReactNode): React.ReactNode {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
