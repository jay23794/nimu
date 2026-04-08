import 'dotenv/config';
import http from 'http';
import { connectDB } from './config/db.js';
import { getRedis } from './config/redis.js';
import { createApp } from './config/app.js';
import { initSocket } from './socket/index.js';

const PORT = process.env.PORT ?? 3001;

async function boot(): Promise<void> {
  console.log('Boot starting...');
  console.log('MONGODB_URI set:', !!process.env.MONGODB_URI);
  console.log('REDIS_URL set:', !!process.env.REDIS_URL);

  await connectDB();
  console.log("####################");
  console.log('DB connected ✅');

  getRedis();
  console.log('Redis connected ✅');

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

boot().catch((err) => {
  console.error('Failed to start server:', err);  // <-- this will now show the actual error
  process.exit(1);
});