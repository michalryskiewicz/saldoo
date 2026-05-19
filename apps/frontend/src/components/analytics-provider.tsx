import { useEffect } from 'react';
import { initGA, logPageView } from '@/lib/gtag';
import { initUmami } from '@/lib/umami';
import { useLocation } from 'react-router';

const AnalyticsProvider = () => {
  const location = useLocation();

  useEffect(() => {
    initGA();
    initUmami();
  }, []);

  useEffect(() => {
    logPageView();
  }, [location]);

  return null;
};

export default AnalyticsProvider;
