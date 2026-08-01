import { Fragment } from 'react';
import * as React from 'react';
import { AppSidebar } from '@/components/app-sidebar.tsx';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar.tsx';
import i18n from '@/i18n.ts';
import { useBreadcrumbs } from '@/hooks/use-breadcrumbs';
import { Link } from 'react-router';
import { SurveysButton } from '@/components/survey-button.tsx';
import { GoogleDriveButton } from '@/components/google-drive/google-drive-button.tsx';
import { SyncAlertBanner } from '@/components/sync-alert-banner.tsx';
import { useGoogleDriveAuthStatus } from '@/components/google-drive/use-google-drive-auth-status.tsx';
import { ThemeToggle } from '@/components/theme-toggle.tsx';
import { LanguageToggle } from '@/components/language-toggle.tsx';

export default function MiniDrawer({ children }: React.PropsWithChildren) {
  const { breadcrumbs } = useBreadcrumbs();
  const isDriveConnected = useGoogleDriveAuthStatus();

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />

      <SidebarInset>
        {/* Bordered and stuck to the top. With no line under it the header and the page were one
            undivided field, so nothing marked where navigation stopped and content began — which
            is most of what made this hard to read. */}
        <header className="bg-background/95 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b backdrop-blur">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <div className="flex w-full flex-row items-center justify-between align-middle">
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbs.map((item, idx) => {
                    const isCurrentPage = idx === breadcrumbs.length - 1;

                    return (
                      <Fragment key={item.path}>
                        {/* The page you are on is not a link to itself, and it is the one crumb
                            worth reading. Every crumb linked and weighted alike left the trail
                            with no answer to "where am I". */}
                        <BreadcrumbItem className="hidden md:block">
                          {isCurrentPage ? (
                            <BreadcrumbPage className="font-medium">
                              {i18n.t(item.label)}
                            </BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link to={item.path}>{i18n.t(item.label)}</Link>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                        {!isCurrentPage && <BreadcrumbSeparator className="hidden md:block" />}
                      </Fragment>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>

              {/* Fenced off from the trail. These act on the application rather than on where you
                  are in it, and standing in one undivided row they read as more navigation. */}
              <div className="flex items-center gap-1">
                <GoogleDriveButton isDriveConnected={isDriveConnected} />
                <Separator
                  orientation="vertical"
                  className="mx-1 data-[orientation=vertical]:h-4"
                />
                <ThemeToggle />
                <LanguageToggle />
                <SurveysButton />
              </div>
            </div>
          </div>
        </header>
        <SyncAlertBanner isDriveConnected={isDriveConnected} />
        {/* Capped and centred. Nothing constrained the content before, so on a wide screen the
            dashboard stretched edge to edge and every table spread its columns across the whole
            span — which is why the rows read as scattered islands rather than as rows. Data does
            not become easier to read by being further apart. One value, one place to change it. */}
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
