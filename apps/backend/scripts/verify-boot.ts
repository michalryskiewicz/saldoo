import 'reflect-metadata';

/**
 * That the process can load its own controllers.
 *
 * This exists because a bug got past every other gate and stopped the whole backend from starting.
 * `BondOfferService` carried a tsyringe decorator while its constructor took a module singleton and
 * a function, neither of which the container can reflect: under bun `design:paramtypes` came out as
 * `["Object", "Object"]`, tsyringe tried to inject both rather than letting the defaults stand, and
 * threw. Controllers are resolved at **module load** (`container.resolve` at the bottom of each
 * controller file), so nothing ever listened on the port.
 *
 * **No unit test can see it.** Vitest's transform does not emit that metadata, so
 * `container.resolve(BondOffersController)` passes there whether the bug is present or not — a test
 * for it was written, watched to pass against the broken code, and deleted.
 *
 * So the gate is the thing itself: import the router tree the way `index.ts` does, under bun, and
 * let a throw be a failure. No server and no database — Prisma connects lazily, so constructing its
 * client needs no reachable file, and every failure of this kind happens before a port is opened.
 */
await import('../api/index.ts');

console.log('backend: module graph loaded, every controller resolved');
