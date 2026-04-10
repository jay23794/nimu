import express, { Application } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { roomRouter } from '../routes/room.routes.js';
import { errorHandler } from '../middleware/error.middleware.js';
import { getRedis } from './redis.js';
import { getOnlineCount } from '../socket/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Compiled to server/dist/config/app.js → go up 3 levels to reach project root dist/
const clientDist = path.join(__dirname, '..', '..', '..', 'dist');

export function createApp(): Application {
  const app = express();

  app.use(express.json());
  app.use(express.static(clientDist));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/rooms', roomRouter);

  app.get('/api/stats', async (_req, res) => {
    try {
      const redis = getRedis();
      const [totalVisitsRaw, rawVisitors] = await Promise.all([
        redis.get('stats:total_visits'),
        redis.lrange('stats:recent_visitors', 0, 49),
      ]);

      const recentVisitors = rawVisitors.map((v) => {
        try { return JSON.parse(v); } catch { return null; }
      }).filter(Boolean);

      res.json({
        onlineUsers: getOnlineCount(),
        totalVisits: parseInt(totalVisitsRaw ?? '0', 10),
        recentVisitors,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load stats' });
    }
  });

  app.use(errorHandler);

  // Catch-all: serve React app for any non-API route
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return app;
}
