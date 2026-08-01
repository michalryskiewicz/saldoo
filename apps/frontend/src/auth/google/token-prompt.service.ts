/**
 * What to ask Google to show — the whole difference between a window appearing and not.
 *
 * - **Silent** asks for `'none'`: *"Don't display any authentication or consent screens"*.
 *   The value used to be `''`, which Google documents as *"the user will be prompted only
 *   the first time your app requests access"* — a weaker promise, and the reason a renewal
 *   running without a click could put a window on screen nobody asked for.
 * - **Interactive with a remembered account** asks for `''`, which Google honours by
 *   skipping the chooser when `login_hint` names the account.
 * - **Interactive with no hint** asks for `select_account`: a device signing in for the
 *   first time, where choosing is the point.
 *
 * `consent` is never returned. It forced re-approval of a grant that already existed, on
 * every single sign-in, and was the most repeated piece of friction on the way in.
 */
export function resolveTokenPrompt(silent: boolean, hint: string | null): string {
  if (silent) return 'none';

  return hint ? '' : 'select_account';
}
