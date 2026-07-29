import { useEffect } from 'react';
import { initUmami } from '@/lib/umami';

/**
 * Loads analytics, and nothing else, into the origin that holds the vault.
 *
 * Every script running here can read the Dexie database holding the data key and
 * the Drive token in `sessionStorage`, so how many third parties have that reach is
 * a security number, not a product one. Google Analytics used to be the second; it
 * was wired up but switched off, and it is now gone rather than one environment
 * variable away from coming back.
 *
 * Umami follows route changes itself by hooking the History API, so there is no
 * per-navigation call to make from here.
 */
const AnalyticsProvider = () => {
  useEffect(() => {
    initUmami();
  }, []);

  return null;
};

export default AnalyticsProvider;
