import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { registerGameHandlers } from './game.handler.js';
import { Player } from '../models/player.model.js';
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

    try {
      await Player.findOneAndUpdate(
        { guestId },
        { guestId, nickname, isGuest: true },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (err) {
      console.error('Player upsert error:', err);
    }

    console.log(`[socket] connected ${socket.id} (${nickname} / ${guestId})`);

    registerGameHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected ${socket.id} (${nickname})`);
    });
  });

  _io = io;
  return io;
}
