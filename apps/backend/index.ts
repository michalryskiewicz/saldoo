import 'reflect-metadata';
import express from 'express';
import http from 'http';
import apiRouter from './api';
import cors from 'cors';
import { errorHandler } from './middleware';
import { container } from 'tsyringe';
import { BondOfferService } from './api/bond-offers/bond-offer.service.ts';

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

/**
 * Once a week, and once on boot.
 *
 * Weekly rather than monthly because the run that matters is the one just after the Ministry
 * publishes — nobody knows which day that is, and a week of polling costs fourteen requests to
 * public pages. On boot as well, so a restart is also a chance to catch up rather than a reason to
 * wait seven days.
 *
 * Nothing here can fail loudly enough to matter: an unreadable source leaves the last good rows in
 * place, and the app ships a catalogue that works with none of them.
 */
const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;

const refreshBondOffers = async () => {
  const reports = await container
    .resolve(BondOfferService)
    .refreshRecent(new Date())
    .catch((error: unknown) => {
      console.error('Bond offers: refresh failed entirely', error);

      return [];
    });

  for (const report of reports) {
    console.log(
      `Bond offers: ${report.month} — recorded ${report.recorded}` +
        (report.unreadable.length ? `, could not read ${report.unreadable.join(', ')}` : ''),
    );
  }
};

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });

  void refreshBondOffers();
  setInterval(() => void refreshBondOffers(), WEEKLY_MS);
}

export { app, server };
