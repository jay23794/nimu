import { roomService } from '../services/room.service.js';
import { roomRepository } from '../repositories/room.repository.js';
import { Player } from '../models/player.model.js';

/**
 * Count how many digits in `guess` appear anywhere in `secret` (no position, no duplicates).
 * secret="5189", guess="5100" → 2  (digits 5 and 1 are in secret)
 */
function countCorrectDigits(secret, guess) {
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

function otherPlayer(state, guestId) {
  return state.players.find((p) => p.guestId !== guestId);
}

export function registerGameHandlers(io, socket) {
  const { guestId, nickname } = socket.data;

  // ── join_room ─────────────────────────────────────────────────────────────
  // code = null | 'new' → create room; otherwise → join existing room
  socket.on('join_room', async ({ code: rawCode } = {}) => {
    try {
      let roomCode;

      if (!rawCode || rawCode === 'new') {
        const result = await roomService.createRoom({ guestId, nickname });
        roomCode = result.code;
      } else {
        // Check for reconnect (player already in Redis state)
        const existing = await roomService.getRedisRoom(rawCode);
        if (existing?.players.some((p) => p.guestId === guestId)) {
          roomCode = rawCode; // reconnect — no service call needed
        } else {
          await roomService.joinRoom({ code: rawCode, guestId, nickname });
          roomCode = rawCode;
        }
      }

      socket.data.code = roomCode;
      socket.join(roomCode);

      const state = await roomService.getRedisRoom(roomCode);
      io.to(roomCode).emit('room_update', state);

      // Advance to SET_NUMBER when both players are in the room
      if (state.players.length >= 2 && state.status === 'LOBBY') {
        state.status = 'SET_NUMBER';
        await roomService.setRedisRoom(state);
        await roomRepository.updateByCode(roomCode, { status: 'SET_NUMBER' });
        io.to(roomCode).emit('phase_change', { phase: 'SET_NUMBER' });
        io.to(roomCode).emit('room_update', state);
      }
    } catch (err) {
      console.error('[join_room]', err);
      socket.emit('error', { message: err.message ?? 'Failed to join room' });
    }
  });

  // ── set_number ────────────────────────────────────────────────────────────
  socket.on('set_number', async ({ code, number }) => {
    try {
      const state = await roomService.getRedisRoom(code);
      if (!state) return socket.emit('error', { message: 'Room not found' });
      if (state.status !== 'SET_NUMBER')
        return socket.emit('error', { message: 'Not in SET_NUMBER phase' });

      const numStr = String(number);
      if (!/^\d{4}$/.test(numStr))
        return socket.emit('error', { message: 'Number must be exactly 4 digits' });

      state.secretNumbers[guestId] = numStr;
      socket.emit('number_set'); // confirm to the setter only

      const bothSet = state.players.every((p) => state.secretNumbers[p.guestId]);
      if (bothSet) {
        const host = state.players.find((p) => p.isHost);
        state.currentTurn = host?.guestId ?? state.players[0].guestId;
        state.status = 'GUESSING';
        await roomService.setRedisRoom(state);
        await roomRepository.updateByCode(code, { status: 'GUESSING' });
        io.to(code).emit('phase_change', { phase: 'GUESSING' });
        io.to(code).emit('room_update', state);
        io.to(code).emit('your_turn', { guestId: state.currentTurn });
      } else {
        await roomService.setRedisRoom(state);
      }
    } catch (err) {
      console.error('[set_number]', err);
      socket.emit('error', { message: 'Failed to set number' });
    }
  });

  // ── make_guess ────────────────────────────────────────────────────────────
  socket.on('make_guess', async ({ code, guess }) => {
    try {
      const state = await roomService.getRedisRoom(code);
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
        await roomService.setRedisRoom(state);
        await roomRepository.setFinished(code, guestId);

        await Player.findOneAndUpdate({ guestId }, { $inc: { gamesPlayed: 1, gamesWon: 1 } });
        await Player.findOneAndUpdate({ guestId: opponent.guestId }, { $inc: { gamesPlayed: 1 } });

        io.to(code).emit('guess_result', guessResult);
        io.to(code).emit('phase_change', { phase: 'FINISHED' });

        // Reveal each player's opponent secret individually
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
        await roomService.setRedisRoom(state);

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
      const state = await roomService.getRedisRoom(code);
      if (!state) return socket.emit('error', { message: 'Room not found' });

      state.status = 'SET_NUMBER';
      state.secretNumbers = {};
      state.guesses = [];
      state.turnCount = 0;
      state.winnerGuestId = null;
      state.currentTurn = null;

      await roomService.setRedisRoom(state);
      await roomRepository.updateByCode(code, { status: 'SET_NUMBER', guesses: [], winnerGuestId: null });

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
      const state = await roomService.getRedisRoom(code);
      if (!state) return;

      io.to(code).emit('player_left', { guestId, nickname });

      if (state.status === 'GUESSING' || state.status === 'SET_NUMBER') {
        const opponent = otherPlayer(state, guestId);
        if (opponent) {
          state.status = 'FINISHED';
          state.winnerGuestId = opponent.guestId;
          await roomService.setRedisRoom(state);
          await roomRepository.setFinished(code, opponent.guestId);

          io.to(code).emit('phase_change', { phase: 'FINISHED' });

          // Remaining sockets get game_over with the disconnected player's secret
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
