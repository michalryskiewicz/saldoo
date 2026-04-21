import { CONFIG } from '@/global-config.ts';

const metadata = { title: `404 page not found! | Error - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <div>NOT FOUND 404</div>
    </>
  );
}
