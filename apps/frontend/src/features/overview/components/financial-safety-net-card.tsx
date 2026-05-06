import { ShieldCheck } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.tsx';
import { InfoTooltip } from '@/components/info-tooltip.tsx';
import { formatMoney } from '@/lib/formats.ts';
import { useTranslation } from 'react-i18next';
import { useOverviewData } from '@/features/overview/hooks/use-overview-data.tsx';
import { EmptyState } from '@/components/stats/empty-state.tsx';
import { paths } from '@/routes/paths.ts';

export function FinancialSafetyNetCard() {
  const { t } = useTranslation();
  const { financialSafetyNet, hasExpenses } = useOverviewData();

  const isEmpty = !hasExpenses;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('financial_safety_net.title')}</CardTitle>
        <CardDescription>
          {t('financial_safety_net.description')}
          <InfoTooltip text={t('financial_safety_net.tooltip')} />
        </CardDescription>
      </CardHeader>

      <CardContent className="h-full grid grid-cols-3 w-full">
        {isEmpty ? (
          <div className="col-span-3 flex items-center justify-center w-full">
            <EmptyState
              icon={ShieldCheck}
              description={t('empty_state.no_safety_net_data')}
              ctaLabel={t('empty_state.add_first_expense')}
              ctaTo={paths.dashboard.expenses}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col w-full align-middle justify-center items-center gap-2">
              <CardTitle>
                {formatMoney(financialSafetyNet.small, financialSafetyNet.currency)}
              </CardTitle>
              <CardDescription>{t('financial_safety_net.3_months')}</CardDescription>
            </div>

            <div className="flex flex-col w-full align-middle justify-center items-center gap-2">
              <CardTitle>
                {formatMoney(financialSafetyNet.medium, financialSafetyNet.currency)}
              </CardTitle>
              <CardDescription>{t('financial_safety_net.6_months')}</CardDescription>
            </div>

            <div className="flex flex-col w-full align-middle justify-center items-center gap-2">
              <CardTitle>
                {formatMoney(financialSafetyNet.comfort, financialSafetyNet.currency)}
              </CardTitle>
              <CardDescription>{t('financial_safety_net.12_months')}</CardDescription>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
