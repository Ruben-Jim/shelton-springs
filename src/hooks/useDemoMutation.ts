import React, { useCallback, useContext } from 'react';
import { useMutation } from 'convex/react';
import { isDemoBuild } from '../config/isDemoBuild';
import { DemoDataContext } from '../demo/DemoDataProvider';

type DemoCtx = NonNullable<React.ContextType<typeof DemoDataContext>>;

/**
 * In demo builds, Convex mutations never hit the network (no-op / optional local handler).
 * In production, forwards to the real Convex mutation.
 */
export function useDemoMutation<TArgs = any, TResult = any>(
  mutationRef: any,
  options?: {
    demo?: (args: TArgs | undefined, ctx: DemoCtx) => void | Promise<void>;
  }
): (args?: TArgs) => Promise<TResult | undefined> {
  const isDemo = isDemoBuild();
  const demoCtx = useContext(DemoDataContext);
  const realMut = useMutation(mutationRef);

  return useCallback(
    async (args?: TArgs) => {
      if (isDemo) {
        if (options?.demo && demoCtx) {
          await options.demo(args, demoCtx);
        }
        return undefined as TResult;
      }
      if (args === undefined) {
        return (await (realMut as () => Promise<TResult>)()) as TResult;
      }
      return (await realMut(args as any)) as TResult;
    },
    [isDemo, realMut, options, demoCtx]
  );
}
