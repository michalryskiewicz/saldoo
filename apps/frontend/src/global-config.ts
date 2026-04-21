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

  driveToken: {
    name: string;
    expires: number;
    secure: boolean;
    sameSite: 'strict' | 'Strict' | 'lax' | 'Lax' | 'none' | 'None' | undefined;
  };

  dataSourceFile: string;
  dataSourceDirectory: string;

  googleClientId: string;
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
   * Drive token information to properly set cookie on client side of app
   */
  driveToken: {
    name: 'access_token',
    expires: 1 / 24, // 1 hour,
    secure: true,
    sameSite: 'strict',
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
};

export const GOOGLE_ENDPOINTS = {
  LOGIN_DRIVE: 'https://www.googleapis.com/auth/drive.file',
};
