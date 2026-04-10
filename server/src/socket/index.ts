import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { registerGameHandlers } from './game.handler.js';
import { Player } from '../models/player.model.js';
import { getRedis } from '../config/redis.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../types/index.js';

let _io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

export function getIo() {
  return _io;
}

export function getOnlineCount(): number {
  return _io?.engine.clientsCount ?? 0;
}

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    { cors: { origin: '*' } },
  );

  io.on('connection', async (socket) => {
    const { guestId, nickname } = socket.handshake.auth as {
      guestId?: string;
      nickname?: string;
    };

    if (!guestId || !nickname) {
      socket.disconnect(true);
      return;
    }

    socket.data.guestId = guestId;
    socket.data.nickname = nickname;

    // Register game event handlers immediately — before any async work —
    // so that a join_room emitted right after connect is never lost.
    registerGameHandlers(io, socket);

    console.log(`[socket] connected ${socket.id} (${nickname} / ${guestId})`);

    // Fire-and-forget: DB/Redis bookkeeping doesn't block game events.
    Player.findOneAndUpdate(
      { guestId },
      { guestId, nickname, isGuest: true },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).catch((err) => console.error('Player upsert error:', err));

    // Track visit metadata in Redis
    (async () => {
      try {
        const redis = getRedis();
        const forwarded = socket.handshake.headers['x-forwarded-for'];
        const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]) ?? socket.handshake.address;
        const ua = socket.handshake.headers['user-agent'] ?? 'unknown';

        await redis.incr('stats:total_visits');
        const visitor = JSON.stringify({ ip, ua, nickname, guestId, ts: Date.now() });
        await redis.lpush('stats:recent_visitors', visitor);
        await redis.ltrim('stats:recent_visitors', 0, 99); // keep last 100
      } catch (err) {
        console.error('Stats tracking error:', err);
      }
    })();

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected ${socket.id} (${nickname})`);
    });
  });

  _io = io;
  return io;
}
