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

// Configurable because 3000 is a popular default and a second app holding it makes
// every request from the frontend land somewhere else entirely — with confusing
// symptoms, since the wrong server answers rather than nothing answering.
const PORT = Number(process.env.PORT ?? 3000);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });
}

export { app, server };
