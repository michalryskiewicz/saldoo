import DescriptionCell from '@/components/tanstack-table/cells/description-cell.tsx';
import MoneyCell from '@/components/tanstack-table/cells/money-cell.tsx';
import CostNatureCell from '@/components/tanstack-table/cells/cost-nature-cell.tsx';
import SeverityCell from '@/components/tanstack-table/cells/severity-cell.tsx';
import TextCell from '@/components/tanstack-table/cells/text-cell.tsx';
import TagsCell from '@/components/tanstack-table/cells/tags-cell.tsx';

export const Cell = {
  Description: DescriptionCell,
  Money: MoneyCell,
  CostNature: CostNatureCell,
  Severity: SeverityCell,
  Text: TextCell,
  Tags: TagsCell,
};
