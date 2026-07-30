# Browser tests

What only a browser can answer: whether two devices sharing one Drive folder converge,
whether an old-shaped IndexedDB upgrades without losing rows, whether the vault re-locks,
and whether the shipped Content-Security-Policy is complete.

```bash
bun run e2e                  # whole suite
bun run e2e --grep "vault"   # one area
bun run e2e:install          # once, to fetch Chromium
```

## How it works

**Google and Drive are stubbed at the network boundary, never bypassed in app code.**
The real `DriveFileGateway`, the real `DriveTokenService` and the real GIS bridge all run;
only the answers coming off the wire are the test's. A stub that replaced the gateway
would prove nothing about the code that ships.

- `support/fake-drive.ts` — one Drive folder, held in the Node process. Living outside the
  browser is what lets two contexts share it, and a shared folder is what makes a
  two-context test a test of *two devices*.
- `support/google-stub.ts` — the GIS script, `userinfo`, and the Drive endpoints
  `googleDriveUtils.ts` calls. Anonymous calls get a 401, so the auth path stays
  load-bearing.
- `support/csp.ts` — serves the app under the policy read from
  `security-headers.conf.template`, so an allowlist edit is either exercised here or it is
  a deliberate change to a file this harness reads.
- `support/device.ts` — one browser context per device, its own IndexedDB and session,
  plus a console-error collector. Console errors and uncaught exceptions fail the tests
  that assert on them; a `Refused to …` CSP violation is exactly the class of bug this
  suite exists to catch, and it is invisible unless asserted.
- `support/app.ts` — the app driven as a person drives it, with every label read from
  `src/locales/pl.json`.

**The suite runs against a production build served by `vite preview`, not the dev
server.** The dev server injects an inline React-refresh script the shipped CSP forbids, so
CSP could not be asserted against it and the bundle under test would not be the bundle
that ships. The cost: a source change needs a rebuild before a test sees it.

## What stays manual

A green suite does **not** mean the manual list is done. None of these is reachable here:

- **A live Google consent** — an agent or CI cannot complete Google's interactive OAuth
  flow, and a real token does not belong in a test.
- **GIS silent renewal in a real browser** — the stub always hands a token back. Whether
  Google honours `prompt: ''` after the app is published is a property of Google, and it
  is what breaks first when the OAuth app is left unpublished.
- **Real Drive states** — quota exhaustion, several files sharing one name, trashed files,
  and whether Drive honours `If-Match` on a media upload (that last one is its own spike).
- **Whether Umami records a visit** — it is disabled in this suite on purpose: anything
  loaded there runs in the same origin as the vault.
- **A reload while genuinely offline** — there is no service worker, so the app shell
  cannot load without a network at all. The offline test therefore reconnects before
  reloading, and offline *writing* is what it proves.
- **The nginx wiring itself** — the policy text is read from the template, but that every
  `location` block includes it is a property of the deployed image.
