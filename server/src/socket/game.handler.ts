import type { Server, Socket } from 'socket.io';
import { roomService, getRedisRoom, setRedisRoom } from '../services/room.service.js';
import { roomRepository } from '../repositories/room.repository.js';
import { Player } from '../models/player.model.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  RedisRoomState,
  RoomPlayer,
} from '../types/index.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Count how many digits in `guess` appear anywhere in `secret` (no position, no duplicates).
 * secret="5189", guess="5100" → 2  (digits 5 and 1 are in secret)
 */
function countCorrectDigits(secret: string, guess: string): number {
  const seen = new Set(secret.split(''));
  let count = 0;
  for (const ch of guess) {
    if (seen.has(ch)) {
      count++;
      seen.delete(ch);
    }
  }
  return count;
}

function otherPlayer(state: RedisRoomState, guestId: string): RoomPlayer | undefined {
  return state.players.find((p) => p.guestId !== guestId);
}

export function registerGameHandlers(io: AppServer, socket: AppSocket): void {
  const { guestId, nickname } = socket.data;

  // ── join_room ─────────────────────────────────────────────────────────────
  // code = undefined | 'new' → create room; otherwise → join existing room
  socket.on('join_room', async (data) => {
    const rawCode = data?.code;
    try {
      let roomCode: string;

      if (!rawCode || rawCode === 'new') {
        const result = await roomService.createRoom({ guestId, nickname });
        roomCode = result.code;
      } else {
        const existing = await getRedisRoom(rawCode);
        if (existing?.players.some((p) => p.guestId === guestId)) {
          roomCode = rawCode; // reconnect
        } else {
          await roomService.joinRoom({ code: rawCode, guestId, nickname });
          roomCode = rawCode;
        }
      }

      socket.data.code = roomCode;
      socket.join(roomCode);

      const state = await getRedisRoom(roomCode);
      if (!state) return;
      io.to(roomCode).emit('room_update', state);

      if (state.players.length >= 2 && state.status === 'LOBBY') {
        state.status = 'SET_NUMBER';
        await setRedisRoom(state);
        await roomRepository.updateByCode(roomCode, { status: 'SET_NUMBER' });
        io.to(roomCode).emit('phase_change', { phase: 'SET_NUMBER' });
        io.to(roomCode).emit('room_update', state);
      }
    } catch (err) {
      console.error('[join_room]', err);
      socket.emit('error', {
        message: err instanceof Error ? err.message : 'Failed to join room',
      });
    }
  });

  // ── set_number ────────────────────────────────────────────────────────────
  socket.on('set_number', async ({ code, number }) => {
    try {
      const state = await getRedisRoom(code);
      if (!state) return socket.emit('error', { message: 'Room not found' });
      if (state.status !== 'SET_NUMBER')
        return socket.emit('error', { message: 'Not in SET_NUMBER phase' });

      const numStr = String(number);
      if (!/^\d{4}$/.test(numStr))
        return socket.emit('error', { message: 'Number must be exactly 4 digits' });

      state.secretNumbers[guestId] = numStr;
      socket.emit('number_set');

      const bothSet = state.players.every((p) => state.secretNumbers[p.guestId]);
      if (bothSet) {
        const host = state.players.find((p) => p.isHost);
        state.currentTurn = host?.guestId ?? state.players[0].guestId;
        state.status = 'GUESSING';
        await setRedisRoom(state);
        await roomRepository.updateByCode(code, { status: 'GUESSING' });
        io.to(code).emit('phase_change', { phase: 'GUESSING' });
        io.to(code).emit('room_update', state);
        io.to(code).emit('your_turn', { guestId: state.currentTurn });
      } else {
        await setRedisRoom(state);
      }
    } catch (err) {
      console.error('[set_number]', err);
      socket.emit('error', { message: 'Failed to set number' });
    }
  });

  // ── make_guess ────────────────────────────────────────────────────────────
  socket.on('make_guess', async ({ code, guess }) => {
    try {
      const state = await getRedisRoom(code);
      if (!state) return socket.emit('error', { message: 'Room not found' });
      if (state.status !== 'GUESSING')
        return socket.emit('error', { message: 'Not in GUESSING phase' });
      if (state.currentTurn !== guestId)
        return socket.emit('error', { message: 'Not your turn' });

      const guessStr = String(guess);
      if (!/^\d{4}$/.test(guessStr))
        return socket.emit('error', { message: 'Guess must be exactly 4 digits' });

      const opponent = otherPlayer(state, guestId);
      if (!opponent) return socket.emit('error', { message: 'Opponent not found' });

      const secret = state.secretNumbers[opponent.guestId];
      const correctDigits = countCorrectDigits(secret, guessStr);

      state.turnCount += 1;
      const mongoGuess = {
        byGuestId: guestId,
        guessedNumber: guessStr,
        correctDigits,
        turnNumber: state.turnCount,
      };
      state.guesses.push(mongoGuess);
      await roomRepository.pushGuess(code, mongoGuess);

      const guessResult = {
        byGuestId: guestId,
        byNickname: nickname,
        guess: guessStr,
        correctDigits,
        turnNumber: state.turnCount,
      };

      const isWin = correctDigits === 4;

      if (isWin) {
        state.status = 'FINISHED';
        state.winnerGuestId = guestId;
        await setRedisRoom(state);
        await roomRepository.setFinished(code, guestId);

        await Player.findOneAndUpdate({ guestId }, { $inc: { gamesPlayed: 1, gamesWon: 1 } });
        await Player.findOneAndUpdate(
          { guestId: opponent.guestId },
          { $inc: { gamesPlayed: 1 } },
        );

        io.to(code).emit('guess_result', guessResult);
        io.to(code).emit('phase_change', { phase: 'FINISHED' });

        const allSockets = await io.in(code).fetchSockets();
        for (const s of allSockets) {
          const pid = s.data.guestId;
          if (!pid) continue;
          const opp = otherPlayer(state, pid);
          s.emit('game_over', {
            winnerGuestId: guestId,
            winnerNickname: nickname,
            secret: opp ? state.secretNumbers[opp.guestId] : null,
            totalTurns: state.turnCount,
          });
        }
      } else {
        state.currentTurn = opponent.guestId;
        await setRedisRoom(state);

        io.to(code).emit('guess_result', guessResult);
        io.to(code).emit('your_turn', { guestId: state.currentTurn });
      }
    } catch (err) {
      console.error('[make_guess]', err);
      socket.emit('error', { message: 'Failed to process guess' });
    }
  });

  // ── rematch ───────────────────────────────────────────────────────────────
  socket.on('rematch', async ({ code }) => {
    try {
      const state = await getRedisRoom(code);
      if (!state) return socket.emit('error', { message: 'Room not found' });

      state.status = 'SET_NUMBER';
      state.secretNumbers = {};
      state.guesses = [];
      state.turnCount = 0;
      state.winnerGuestId = null;
      state.currentTurn = null;

      await setRedisRoom(state);
      await roomRepository.updateByCode(code, {
        status: 'SET_NUMBER',
        guesses: [],
        winnerGuestId: null,
      });

      io.to(code).emit('phase_change', { phase: 'SET_NUMBER' });
      io.to(code).emit('room_update', state);
    } catch (err) {
      console.error('[rematch]', err);
      socket.emit('error', { message: 'Failed to rematch' });
    }
  });

  // ── disconnecting ─────────────────────────────────────────────────────────
  socket.on('disconnecting', async () => {
    const code = socket.data.code;
    if (!code) return;

    try {
      const state = await getRedisRoom(code);
      if (!state) return;

      io.to(code).emit('player_left', { guestId, nickname });

      if (state.status === 'GUESSING' || state.status === 'SET_NUMBER') {
        const opponent = otherPlayer(state, guestId);
        if (opponent) {
          state.status = 'FINISHED';
          state.winnerGuestId = opponent.guestId;
          await setRedisRoom(state);
          await roomRepository.setFinished(code, opponent.guestId);

          io.to(code).emit('phase_change', { phase: 'FINISHED' });

          const allSockets = await io.in(code).fetchSockets();
          for (const s of allSockets) {
            const pid = s.data.guestId;
            if (!pid || pid === guestId) continue;
            s.emit('game_over', {
              winnerGuestId: opponent.guestId,
              winnerNickname: opponent.nickname,
              secret: state.secretNumbers[guestId] ?? null,
              totalTurns: state.turnCount,
              reason: 'opponent_disconnected',
            });
          }
        }
      }
    } catch (err) {
      console.error('[disconnecting]', err);
    }
  });
}
