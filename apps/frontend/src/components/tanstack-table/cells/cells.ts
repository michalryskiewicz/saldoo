import DescriptionCell from '@/components/tanstack-table/cells/description-cell.tsx';
import MoneyCell from '@/components/tanstack-table/cells/money-cell.tsx';
import CostNatureCell from '@/components/tanstack-table/cells/cost-nature-cell.tsx';
import TextCell from '@/components/tanstack-table/cells/text-cell.tsx';
import TagsCell from '@/components/tanstack-table/cells/tags-cell.tsx';

export const Cell = {
  Description: DescriptionCell,
  Money: MoneyCell,
  CostNature: CostNatureCell,
  Text: TextCell,
  Tags: TagsCell,
};
