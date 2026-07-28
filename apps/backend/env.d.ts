// env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    FRONTEND_URL: string;
    ANALYTICS_ENDPOINT: string;
  }
}
