import { Fragment } from 'react';
import * as React from 'react';
import { AppSidebar } from '@/components/app-sidebar.tsx';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar.tsx';
import i18n from '@/i18n.ts';
import { GoogleDriveButton } from '@/components/google-drive/google-drive-button.tsx';
import { useBreadcrumbs } from '@/hooks/use-breadcrumbs';
import { Link } from 'react-router';
import { SurveysButton } from '@/components/survey-button.tsx';
import { SyncStatusIndicator } from '@/components/sync-status-indicator.tsx';
import { ThemeToggle } from '@/components/theme-toggle.tsx';

export default function MiniDrawer({ children }: React.PropsWithChildren) {
  const { breadcrumbs } = useBreadcrumbs();

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4 w-full">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <div className="w-full flex flex-row items-center justify-between align-middle">
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbs.map((item, idx) => {
                    return (
                      <Fragment key={item.path}>
                        <BreadcrumbItem className="hidden md:block">
                          <BreadcrumbLink asChild>
                            <Link to={item.path}>{i18n.t(item.label)}</Link>
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                        {idx !== breadcrumbs?.length - 1 && (
                          <BreadcrumbSeparator className="hidden md:block" />
                        )}
                      </Fragment>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex items-center gap-2">
                <SyncStatusIndicator />
                <ThemeToggle />
                <SurveysButton />
                <GoogleDriveButton />
              </div>
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
