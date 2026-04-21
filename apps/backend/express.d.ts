// types/express/index.d.ts
import 'express';

declare module 'express-serve-static-core' {
  interface SessionData {
    userId?: string;
    // add other session properties if needed
  }

  interface Request {
    session: SessionData;
  }
}
