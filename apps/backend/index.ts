import express from 'express';
import http from 'http';
import apiRouter from './api';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.ts';
import cors from 'cors';

const app = express();
const server = http.createServer(app);

console.log('process.env.FRONTEND_URL === ', process.env.FRONTEND_URL);
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
);

app.all('/api/auth/*', toNodeHandler(auth));

// Mount express json middleware after Better Auth handler
// or only apply it to routes that don't interact with Better Auth
app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRouter);

if (require.main === module) {
  server.listen(3000, () => {
    console.log('Server is listening on port 3000');
  });
}

export { app, server };
