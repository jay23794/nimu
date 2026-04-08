import { Server } from 'socket.io';
import { registerGameHandlers } from './game.handler.js';
import { Player } from '../models/player.model.js';

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', async (socket) => {
    const { guestId, nickname } = socket.handshake.auth;

    if (!guestId || !nickname) {
      socket.disconnect(true);
      return;
    }

    socket.data.guestId = guestId;
    socket.data.nickname = nickname;

    // Upsert guest player record
    try {
      await Player.findOneAndUpdate(
        { guestId },
        { guestId, nickname, isGuest: true },
        { upsert: true, new: true, setDefaultsOnInsert: true }
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

  return io;
}
