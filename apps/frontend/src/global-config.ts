import packageJson from '../package.json';
import { paths } from './routes/paths.ts';

export type ConfigType = {
  appName: string;
  devMode: boolean; //"DEV" | "PROD";
  appVersion: string;
  serverUrl: string;
  auth: {
    method: 'google';
    skip: boolean;
    redirectPath: string;
  };
  dateFormat: string;

  dataSourceFile: string;
  dataSourceDirectory: string;

  googleClientId: string;
  /**
   * Where the legal documents actually live.
   *
   * On the marketing site, not in the app: `paths.docs.*` used to point at
   * `/docs/terms-and-conditions` and `/docs/privacy-policy`, which no route ever
   * rendered — so both links under the sign-in checkbox resolved to the 404 page.
   */
  legal: {
    privacyPolicy: string;
    termsOfService: string;
  };
};

export const CONFIG: ConfigType = {
  appName: 'Saldoo',
  devMode: import.meta.env.DEV,
  appVersion: packageJson.version,
  serverUrl: import.meta.env.VITE_SERVER_URL ?? '',

  /**
   * Dates
   */
  dateFormat: 'dd.MM.yyyy',

  /**
   * Auth
   * @method google
   */
  auth: {
    method: 'google',
    skip: false,
    redirectPath: paths.dashboard.root,
  },

  /**
   * Google Drive Auth Info
   */
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT,

  /**
   * File name to store all users sensitive data in Google Drive
   */
  dataSourceFile: import.meta.env.VITE_GA_DRIVE_FILE ?? 'saldoo-data.json',
  dataSourceDirectory: import.meta.env.VITE_GA_DRIVE_DIRECTORY ?? 'saldoo',

  /**
   * Legal
   */
  legal: {
    privacyPolicy: 'https://saldoo.io/polityka-prywatnosci',
    termsOfService: 'https://saldoo.io/regulamin',
  },
};

/**
 * Every scope Saldoo ever asks for, granted in one consent at login.
 *
 * `drive.file` is non-sensitive and limits the app to files it created itself, so
 * this whole set only needs basic OAuth verification.
 */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');
