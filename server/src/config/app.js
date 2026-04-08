import express from 'express';
import { roomRouter } from '../routes/room.routes.js';
import { errorHandler } from '../middleware/error.middleware.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/rooms', roomRouter);

  app.use(errorHandler);

  return app;
}
