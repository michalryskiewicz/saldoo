const UMAMI_WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID;
const UMAMI_SRC = import.meta.env.VITE_UMAMI_SRC ?? 'https://cloud.umami.is/script.js';

const SCRIPT_ID = 'umami-analytics';

export const initUmami = () => {
  if (!UMAMI_WEBSITE_ID) return;
  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.defer = true;
  script.src = UMAMI_SRC;
  script.setAttribute('data-website-id', UMAMI_WEBSITE_ID);
  document.head.appendChild(script);
};
