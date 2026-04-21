import { Item, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item.tsx';
import { Spinner } from '@/components/ui/spinner.tsx';
import type { TranslationKey } from '@/i18n.ts';
import i18n from '@/i18n.ts';

type PageLoaderProps = {
  title: TranslationKey;
};

export const PageLoader = ({ title }: PageLoaderProps) => {
  // ===========================================================================
  // Render
  // ===========================================================================
  return (
    <div className="h-screen w-screen bg-gray-200 flex flex-col justify-center items-center">
      <Item variant="muted">
        <ItemMedia>
          <Spinner />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="line-clamp-1">{i18n.t(title)}</ItemTitle>
        </ItemContent>
      </Item>
    </div>
  );
};
