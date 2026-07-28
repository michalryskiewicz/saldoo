import { describe, it, expect } from 'vitest';
import { decideAuthAccess } from '../auth-access.service.ts';

describe('decideAuthAccess', () => {
  it('waits while the identity is still being resolved', () => {
    expect(decideAuthAccess({ isLoading: true, isAuthenticated: false, isOnline: true })).toBe(
      'wait'
    );
  });

  it('lets a signed-in user through', () => {
    expect(decideAuthAccess({ isLoading: false, isAuthenticated: true, isOnline: true })).toBe(
      'allow'
    );
  });

  it('sends a signed-out user to sign in', () => {
    expect(decideAuthAccess({ isLoading: false, isAuthenticated: false, isOnline: true })).toBe(
      'redirect'
    );
  });

  it('lets an offline user through without an identity', () => {
    // The access token dies with the tab and cannot be renewed offline, so demanding
    // one would lock the user out of data that is already on this device. Nothing is
    // exposed by allowing it: the vault gate downstream still needs the data key,
    // and the server holds nothing to authorise against.
    expect(decideAuthAccess({ isLoading: false, isAuthenticated: false, isOnline: false })).toBe(
      'allow'
    );
  });

  it('still waits offline while the identity is resolving', () => {
    expect(decideAuthAccess({ isLoading: true, isAuthenticated: false, isOnline: false })).toBe(
      'wait'
    );
  });
});
