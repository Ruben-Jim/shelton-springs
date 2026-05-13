import React, { createContext, useContext, useMemo, useState } from 'react';
import { isDemoBuild } from '../config/isDemoBuild';
import { initialDemoSnapshot, type DemoSnapshot } from './fixtures/initialSnapshot';

type DemoDataContextValue = {
  snapshot: DemoSnapshot;
  setSnapshot: React.Dispatch<React.SetStateAction<DemoSnapshot>>;
};

export const DemoDataContext = createContext<DemoDataContextValue | null>(null);

export function DemoDataProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<DemoSnapshot>(() =>
    JSON.parse(JSON.stringify(initialDemoSnapshot)) as DemoSnapshot
  );

  const value = useMemo(() => ({ snapshot, setSnapshot }), [snapshot]);

  if (!isDemoBuild()) {
    return <>{children}</>;
  }

  return <DemoDataContext.Provider value={value}>{children}</DemoDataContext.Provider>;
}

export function useDemoData(): DemoDataContextValue {
  const ctx = useContext(DemoDataContext);
  if (!isDemoBuild()) {
    throw new Error('useDemoData is only valid when demoMode is enabled');
  }
  if (!ctx) {
    throw new Error('DemoDataProvider is required when demoMode is enabled');
  }
  return ctx;
}

/** Safe outside demo builds: returns null when not in demo mode or provider missing. */
export function useDemoDataOptional(): DemoDataContextValue | null {
  if (!isDemoBuild()) return null;
  return useContext(DemoDataContext);
}
