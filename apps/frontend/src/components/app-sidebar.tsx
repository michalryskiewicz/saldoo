import * as React from 'react';

import { NavUser } from '@/components/nav-user';
import { TeamSwitcher } from '@/components/team-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { paths } from '@/routes/paths';
import { NavSingleButtonWithIcon } from '@/components/nav-single-button-with-icon.tsx';
import i18n from '@/i18n.ts';
import { CreditCard, ListTodo, Flame, HandCoins, Gauge, Target} from 'lucide-react';

// ===========================================================================
// DATA TO DISPLAY IN NAV BAR
// ===========================================================================
const data = {
  projects: [
    {
      name: i18n.t('dashboard'),
      url: paths.dashboard.root,
      icon: Gauge,
    },
    {
      name: i18n.t('duties'),
      url: paths.dashboard.duties,
      icon: ListTodo,
    },
    {
      name: i18n.t('goals'),
      url: paths.dashboard.goals,
      icon: Target,
    },
  ],
  navMainTwo: [
    {
      name: i18n.t('expenses'),
      url: paths.dashboard.expenses,
      icon: Flame,
    },
    {
      name: i18n.t('profits'),
      url: paths.dashboard.profits,
      icon: HandCoins,
    },
    {
      name: i18n.t('transactions'),
      url: paths.dashboard.transactions,
      icon: CreditCard,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavSingleButtonWithIcon items={data.projects} />
        <NavSingleButtonWithIcon items={data.navMainTwo} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
