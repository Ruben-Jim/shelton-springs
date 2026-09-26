import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import type { FunctionReference } from 'convex/server';
import { useAuth } from '../context/AuthContext';
import { simpleAlert } from '../utils/webCompatibleAlert';

export const TEST_USER_READ_ONLY_TITLE = 'View only';
export const TEST_USER_READ_ONLY_MESSAGE =
  'Test accounts can browse and explore the app, but cannot make changes.';

export function isTestUserReadOnlyError(error: unknown): boolean {
  return error instanceof Error && error.message === 'TEST_USER_READ_ONLY';
}

export function useIsTestUserReadOnly() {
  const { user } = useAuth();
  const isReadOnly = user?.isTestUser === true;

  const notifyReadOnly = useCallback(() => {
    simpleAlert(TEST_USER_READ_ONLY_MESSAGE, TEST_USER_READ_ONLY_TITLE);
  }, []);

  /** Run fn only when writable; otherwise show the view-only notice. */
  const guardPress = useCallback(
    (fn?: () => void) => {
      if (isReadOnly) {
        notifyReadOnly();
        return;
      }
      fn?.();
    },
    [isReadOnly, notifyReadOnly]
  );

  return { isReadOnly, notifyReadOnly, guardPress };
}

/**
 * Drop-in for useMutation that blocks writes for App Store / QA test users.
 * Allowlisted flows (notifications mark-read, push token) should keep using useMutation.
 */
export function useGuardedMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation
) {
  const raw = useMutation(mutation);
  const { isReadOnly, notifyReadOnly } = useIsTestUserReadOnly();

  return useCallback(
    (...args: Parameters<typeof raw>) => {
      if (isReadOnly) {
        notifyReadOnly();
        return Promise.reject(new Error('TEST_USER_READ_ONLY'));
      }
      return raw(...args);
    },
    [raw, isReadOnly, notifyReadOnly]
  ) as typeof raw;
}
