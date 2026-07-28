export type AuthAccess = 'wait' | 'allow' | 'redirect';

export type AuthAccessState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnline: boolean;
};

/**
 * Decides whether the app may be entered.
 *
 * Being offline is enough on its own. The Drive token lives in `sessionStorage`
 * and cannot be renewed without Google, so requiring an identity offline would
 * lock the user out of records that are already on their device. Nothing is given
 * away by allowing it: the backend stores no user data to authorise against, and
 * the vault gate downstream still demands the data key before anything is read.
 */
export function decideAuthAccess({
  isLoading,
  isAuthenticated,
  isOnline,
}: AuthAccessState): AuthAccess {
  if (isLoading) return 'wait';
  if (isAuthenticated) return 'allow';

  return isOnline ? 'redirect' : 'allow';
}
