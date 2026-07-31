import { Button } from '@/components/ui/button.tsx';
import { driveTokenService } from '@/auth/google/drive-token.ts';
import { useGoogleDriveAuthStatus } from '@/components/google-drive/use-google-drive-auth-status.tsx';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';
import i18n from '@/i18n.ts';

/**
 * Fallback for the rare case where Google will not renew the Drive token silently —
 * normally the connection is kept alive without any interaction.
 */
export function GoogleDriveButton() {
  const isLoggedIn = useGoogleDriveAuthStatus();

  const login = async () => {
    await driveTokenService.connect();
    window.location.reload();
  };

  return (
    <Tooltip>
      {/* `asChild`, or both this and Button render a <button> and one nests in the other —
          invalid HTML that React reports as a hydration error. Same fix as `survey-button`. */}
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={
            isLoggedIn
              ? i18n.t('metrics.google_drive_in_sync')
              : i18n.t('metrics.need_to_sync_with_google_drive')
          }
          onClick={() => login()}
          className={cn(
            ' cursor-pointer  text-white px-4 py-2 rounded',
            isLoggedIn ? 'bg-green-600' : 'bg-red-600'
          )}
          disabled={isLoggedIn}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
            <rect width="256" height="256" fill="none" />
            <path
              d="M93.65,35.76A8,8,0,0,1,100.43,32h55.14a8,8,0,0,1,6.78,3.76l68.43,112.18a8,8,0,0,1,.17,8.21L203.62,204a8,8,0,0,1-6.94,4H59.32a8,8,0,0,1-6.94-4L25.05,156.15a8,8,0,0,1,.17-8.21Z"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="16"
            />
            <line
              x1="55.12"
              y1="206.8"
              x2="159.41"
              y2="32.98"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="16"
            />
            <line
              x1="200.88"
              y1="206.8"
              x2="96.59"
              y2="32.98"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="16"
            />
            <line
              x1="24"
              y1="152"
              x2="232"
              y2="152"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="16"
            />
          </svg>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isLoggedIn ? (
          <p>{i18n.t('metrics.google_drive_in_sync')}</p>
        ) : (
          <p>{i18n.t('metrics.need_to_sync_with_google_drive')}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
