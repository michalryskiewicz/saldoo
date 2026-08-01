/**
 * What a failed token request means.
 *
 * - `needs-interaction` — Google would answer, but not without the person present.
 *   Ordinary: it is what a silent request gets once the session is old enough.
 * - `refused` — the grant is gone, or the account is barred. Nothing local fixes it and
 *   no retry will help. **The only verdict that ends a session.**
 * - `unavailable` — could not ask. A dead network, a blocked window, something
 *   unclassified. Work continues; the next attempt may well succeed.
 */
export type TokenFailureReason = 'needs-interaction' | 'refused' | 'unavailable';

/**
 * Codes Google uses to say the person has to be there. Standard OIDC vocabulary, and it
 * arrives on the ordinary path — a silent renewal after the Google session lapses.
 */
const NEEDS_INTERACTION = new Set([
  'login_required',
  'consent_required',
  'interaction_required',
  'account_selection_required',
]);

/**
 * Codes that mean no. Deliberately short: everything not listed here is treated as
 * "could not ask", because mistaking a bad network for a withdrawn grant throws someone
 * out of an app whose data is sitting on their own disk.
 */
const REFUSED = new Set(['access_denied', 'admin_policy_enforced']);

/**
 * Reads a Google token failure.
 *
 * The distinction exists because the app used to flatten every failure into one error
 * and call all of them transient, so a revoked grant retried forever in silence while a
 * dropped WiFi connection was treated with the same gravity.
 */
export function classifyTokenFailure(code: string | undefined): TokenFailureReason {
  if (!code) return 'unavailable';
  if (NEEDS_INTERACTION.has(code)) return 'needs-interaction';
  if (REFUSED.has(code)) return 'refused';

  return 'unavailable';
}
