import { useContext } from 'react';
import { useQuery } from 'convex/react';
import { isDemoBuild } from '../config/isDemoBuild';
import { DemoDataContext } from '../demo/DemoDataProvider';
import type { DemoSnapshot } from '../demo/fixtures/initialSnapshot';

/**
 * When `demoMode` is on: Convex query is always `"skip"`; data comes from `selectDemo(snapshot, args)`.
 * Otherwise: normal `useQuery` behavior.
 */
export function useDemoQuery<TResult>(
  queryRef: any,
  args: any,
  selectDemo: (snapshot: DemoSnapshot, args: any) => TResult
): TResult | undefined {
  const isDemo = isDemoBuild();
  const demoCtx = useContext(DemoDataContext);
  const convexResult = useQuery(queryRef, isDemo ? 'skip' : args);

  if (!isDemo) {
    return convexResult as TResult;
  }

  if (args === 'skip') {
    return undefined;
  }

  if (!demoCtx) {
    throw new Error('DemoDataProvider is required when demoMode is enabled');
  }

  return selectDemo(demoCtx.snapshot, args);
}
