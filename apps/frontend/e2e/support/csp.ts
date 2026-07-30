import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { BrowserContext } from '@playwright/test';

/**
 * Serves the app under the Content-Security-Policy it actually ships with.
 *
 * The dev server and `vite preview` send no security headers — those are added by nginx
 * from `security-headers.conf.template` at image build time — so without this the one
 * class of bug this suite exists to catch could not happen in it. The policy is read
 * from that template rather than copied, so an allowlist edit is either exercised here
 * or it is a deliberate change to a file this harness reads.
 */

const TEMPLATE = fileURLToPath(new URL('../../security-headers.conf.template', import.meta.url));
const CSP_HEADER = /add_header Content-Security-Policy "([^"]*)"/;

/** The two placeholders nginx substitutes for optional third parties, neither configured here. */
const SUBSTITUTIONS = { CSP_SCRIPT_EXTRA: '', CSP_CONNECT_EXTRA: '' };

export function shippedContentSecurityPolicy(): string {
  const template = readFileSync(TEMPLATE, 'utf8');
  const found = CSP_HEADER.exec(template);
  if (!found) throw new Error(`No Content-Security-Policy header found in ${TEMPLATE}`);

  return Object.entries(SUBSTITUTIONS).reduce(
    (policy, [name, value]) => policy.replaceAll(`\${${name}}`, value),
    found[1]
  );
}

export async function serveWithShippedCsp(context: BrowserContext, origin: string): Promise<void> {
  const policy = shippedContentSecurityPolicy();

  await context.route(
    (url) => url.origin === origin,
    async (route) => {
      // Only the HTML document carries the policy; re-fetching every asset through the
      // interceptor would slow the suite down for no coverage gained.
      if (route.request().resourceType() !== 'document') return route.fallback();

      const response = await route.fetch();

      await route.fulfill({
        response,
        headers: { ...response.headers(), 'content-security-policy': policy },
      });
    }
  );
}
