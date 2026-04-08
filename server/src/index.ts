import 'dotenv/config';
import http from 'http';
import { connectDB } from './config/db.js';
import { getRedis } from './config/redis.js';
import { createApp } from './config/app.js';
import { initSocket } from './socket/index.js';

const PORT = process.env.PORT ?? 3001;

async function boot(): Promise<void> {
  await connectDB();
  getRedis(); // eagerly connect + validate REDIS_URL

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

boot().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
