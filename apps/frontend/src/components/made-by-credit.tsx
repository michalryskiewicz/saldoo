import { Heart } from 'lucide-react';

/**
 * Who made this.
 *
 * On the settings page rather than in the sidebar. A sidebar is navigation somebody passes through
 * every time they use the app, and a permanent credit there charges rent on that space forever —
 * on a phone it would be competing with the navigation itself. Settings is where a person goes to
 * read about the app rather than to use it.
 */
export function MadeByCredit() {
  return (
    <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      Made with
      <Heart className="size-3 fill-current" aria-hidden="true" />
      <span className="sr-only">love</span>
      by
      <a
        href="https://rysiuo.it"
        target="_blank"
        rel="noreferrer"
        className="font-medium underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        Michał Ryśkiewicz
      </a>
    </p>
  );
}
