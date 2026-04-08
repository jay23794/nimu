import express, { Application } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { roomRouter } from '../routes/room.routes.js';
import { errorHandler } from '../middleware/error.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Compiled to server/dist/config/app.js → go up 3 levels to reach project root dist/
const clientDist = path.join(__dirname, '..', '..', '..', 'dist');

export function createApp(): Application {
  const app = express();

  app.use(express.json());
  app.use(express.static(clientDist));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/rooms', roomRouter);

  app.use(errorHandler);

  // Catch-all: serve React app for any non-API route
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return app;
}
