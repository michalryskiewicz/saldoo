import { TOTAL } from '@/constant.ts';
import i18n from '@/i18n.ts';

type DescriptionCellProps = {
  id: string;
  name: string;
};

export default function DescriptionCell({ id, name }: DescriptionCellProps) {
  if (id === TOTAL) {
    return <strong>{i18n.t('total')}</strong>;
  }

  if (!name) {
    return null;
  }

  return name;
}
