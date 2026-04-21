import type { PropsWithChildren } from 'react';
import { METADATA, type MetadataKey } from '@/routes/paths.ts';
import { CONFIG } from '@/global-config.ts';

type MetaDataProps = PropsWithChildren & { page: MetadataKey };

export const MetaDataWrapper = ({ children, page }: MetaDataProps) => (
  <>
    <title>{`${METADATA[page].title} | ${CONFIG.appName}`}</title>
    {children}
  </>
);
