import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { useTheme } from '@/components/theme-provider.tsx';
import i18n from '@/i18n.ts';
import type { TranslationKey } from '@/i18n.ts';

type Choice = { theme: 'light' | 'dark' | 'system'; icon: typeof Sun; label: TranslationKey };

/**
 * `system` is kept as an option rather than resolved away: a person who has told their
 * operating system they want dark has already answered this question, and following that is
 * different from happening to match it today.
 */
const CHOICES: Choice[] = [
  { theme: 'light', icon: Sun, label: 'theme.light' },
  { theme: 'dark', icon: Moon, label: 'theme.dark' },
  { theme: 'system', icon: Monitor, label: 'theme.system' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const current = CHOICES.find((choice) => choice.theme === theme) ?? CHOICES[2];
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={i18n.t('theme.choose')}>
          <CurrentIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {CHOICES.map(({ theme: choice, icon: Icon, label }) => (
          <DropdownMenuItem key={choice} onClick={() => setTheme(choice)}>
            <Icon className="size-4" />
            {i18n.t(label)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
