import Redis from 'ioredis';

let redis;

export function getRedis() {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('REDIS_URL is not set');

    redis = new Redis(url, {
      tls: {}, // required for Upstash rediss:// connections
      maxRetriesPerRequest: 3,
      connectTimeout: 10_000,
      lazyConnect: false,
    });

    redis.on('error', (err) => console.error('Redis error:', err));
    redis.on('connect', () => console.log('Redis connected'));
  }
  return redis;
}
