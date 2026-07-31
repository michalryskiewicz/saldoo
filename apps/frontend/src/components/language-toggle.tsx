import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import i18n, { LOCALES, setLocale, type Locale } from '@/i18n.ts';

/**
 * The language picker, beside the theme picker, because both are choices about how the app looks
 * rather than about what is in it.
 *
 * The languages name themselves — "Polski" and "English", not "Polish" and "Angielski". Somebody
 * looking for their own language is looking for the word they call it by, which is also why neither
 * label is translated.
 */
export function LanguageToggle() {
  const current = i18n.language as Locale;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={i18n.t('language.choose')}>
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => setLocale(locale)}
            aria-current={locale === current}
          >
            {i18n.t(`language.${locale}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
