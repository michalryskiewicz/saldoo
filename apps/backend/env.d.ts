// env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    BETTER_AUTH_URL: string;
    FRONTEND_URL: string;
    ANALYTICS_ENDPOINT: string;

    // GOOGLE AUTH
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
  }
}
