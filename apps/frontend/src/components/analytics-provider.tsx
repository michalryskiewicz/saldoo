import { useEffect } from 'react';
import { initGA, logPageView } from '@/lib/gtag';
import { useLocation } from 'react-router';

const AnalyticsProvider = () => {
  const location = useLocation();

  useEffect(() => {
    initGA();
  }, []);

  useEffect(() => {
    logPageView();
  }, [location]);

  return null;
};

export default AnalyticsProvider;
