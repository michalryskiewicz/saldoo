import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/database';

export const useListTags = () => {
  const result = useLiveQuery(async () => {
    const tags = await db.tags.toArray();
    return {
      tags,
      tagsNames: tags.map((tag) => tag.name),
    };
  }, []);

  return { tags: result?.tags, tagsNames: result?.tagsNames, isLoading: result === undefined };
};
