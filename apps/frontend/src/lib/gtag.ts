import ReactGA from 'react-ga4';

const GA_ID = import.meta.env.VITE_GA_ID;

export const initGA = () => {
  if (GA_ID) {
    ReactGA.initialize(GA_ID);
  }
};

export const logPageView = () => {
  if (GA_ID) {
    ReactGA.send({ hitType: 'pageview', page: window.location.pathname + window.location.search });
  }
};
