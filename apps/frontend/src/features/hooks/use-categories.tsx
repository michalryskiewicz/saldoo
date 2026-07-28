import { useSettings } from '@/features/settings/use-settings.ts';
import { BUDGETING_STRATEGIES } from '@/constant.ts';
import i18n from '@/i18n.ts';
import { useListTags } from '@/database/hooks/use-list-tags.tsx';

export const useCategories = () => {
  const { settings } = useSettings();
  const { tags } = useListTags();

  const budgetingPartsOptions = (
    BUDGETING_STRATEGIES[settings?.strategy as keyof typeof BUDGETING_STRATEGIES] || []
  )?.map((s) => {
    return {
      label: i18n.t(s.type),
      value: s.type,
    };
  });

  return {
    tags: tags?.map((tag) => ({ label: tag.name, value: tag.id })) || [],
    budgetingPartsOptions,
  };
};
