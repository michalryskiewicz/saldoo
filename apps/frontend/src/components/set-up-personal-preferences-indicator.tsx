import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.tsx';
import i18n from '@/i18n.ts';
import { Button } from '@/components/ui/button.tsx';
import { Grid2X2X } from 'lucide-react';
import { Link } from 'react-router';
import { paths } from '@/routes/paths.ts';

export const SetUpPersonalPreferencesIndicator = () => {
  // ===========================================================================
  // Render
  // ===========================================================================
  return (
    <Card className="pt-0">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>{i18n.t('introduction.introduction_title')}</CardTitle>
          <CardDescription>{i18n.t('introduction.introduction_description')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 bg-gray-300 p-4 rounded-4xl">
          <Grid2X2X size={32} />
        </div>
        <Button size="lg" variant="ghost">
          <Link to={paths.account.root}>{i18n.t('account_settings')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
};
