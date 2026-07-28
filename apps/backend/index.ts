import 'reflect-metadata';
import express from 'express';
import http from 'http';
import apiRouter from './api';
import cors from 'cors';
import { errorHandler } from './middleware';

const app = express();
const server = http.createServer(app);

// No credentials: the backend holds no session and no user data, so there is
// nothing for the browser to send along.
app.use(
  cors({
    origin: [process.env.FRONTEND_URL],
    methods: ['GET'],
  }),
);

app.use(express.json());

app.use('/api', apiRouter);

// Global error handler — must be the last middleware so unhandled errors
// from routes/async handlers are funnelled into a consistent JSON response.
app.use(errorHandler);

if (require.main === module) {
  server.listen(3000, () => {
    console.log('Server is listening on port 3000');
  });
}

export { app, server };
