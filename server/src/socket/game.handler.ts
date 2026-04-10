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

const MAX_PLAYERS = 15;
const SHARED_KEY = '__shared__';

// Grace-period timers so brief network hiccups don't drop players.
// Key: `${roomCode}:${guestId}`
const LOBBY_GRACE_MS = 12_000;
const GAME_GRACE_MS  = 20_000;
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Generate a 4-digit string with 4 unique random digits (0–9). */
function generateSharedSecret(): string {
  const pool = Array.from({ length: 10 }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 4).join('');
}

/**
 * Count how many digits in `guess` appear anywhere in `secret` (no position, no duplicates).
 * secret="1234", guess="3981" → 2  (digits 3 and 1 appear in secret)
 * secret="1234", guess="4321" → 4  (all digits present, but not an exact match → no win)
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

/**
 * Build circular target assignments from an ordered list of guestIds.
 * [A, B, C] → { A: B, B: C, C: A }
 */
function buildTargetMap(order: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = 0; i < order.length; i++) {
    map[order[i]] = order[(i + 1) % order.length];
  }
  return map;
}

/**
 * Advance to the next turn in turnOrder, skipping the current player.
 */
function nextTurn(state: RedisRoomState, currentGuestId: string): string {
  const idx = state.turnOrder.indexOf(currentGuestId);
  return state.turnOrder[(idx + 1) % state.turnOrder.length];
}

/**
 * Find a player by guestId.
 */
function findPlayer(state: RedisRoomState, guestId: string): RoomPlayer | undefined {
  return state.players.find((p) => p.guestId === guestId);
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

      // Cancel any pending disconnect grace timer for this player
      const timerKey = `${roomCode}:${guestId}`;
      const pending = disconnectTimers.get(timerKey);
      if (pending) {
        clearTimeout(pending);
        disconnectTimers.delete(timerKey);
      }

      socket.data.code = roomCode;
      socket.join(roomCode);

      const state = await getRedisRoom(roomCode);
      if (!state) return;

      // Ensure new fields exist on state (for old Redis records)
      if (!state.turnOrder) state.turnOrder = [];
      if (!state.targetMap) state.targetMap = {};
      if (!state.gameMode) state.gameMode = 'standard';

      io.to(roomCode).emit('room_update', state);
    } catch (err) {
      console.error('[join_room]', err);
      socket.emit('error', {
        message: err instanceof Error ? err.message : 'Failed to join room',
      });
    }
  });

  // ── start_game ────────────────────────────────────────────────────────────
  // Host triggers game start once 2+ players have joined (max MAX_PLAYERS)
  socket.on('start_game', async ({ code }) => {
    try {
      const state = await getRedisRoom(code);
      if (!state) return socket.emit('error', { message: 'Room not found' });
      if (state.status !== 'LOBBY')
        return socket.emit('error', { message: 'Game already started' });

      const host = state.players.find((p) => p.isHost);
      if (host?.guestId !== guestId)
        return socket.emit('error', { message: 'Only the host can start the game' });

      if (state.players.length < 2)
        return socket.emit('error', { message: 'Need at least 2 players to start' });

      if (state.players.length > MAX_PLAYERS)
        return socket.emit('error', { message: `Too many players (max ${MAX_PLAYERS})` });

      const turnOrder = state.players.map((p) => p.guestId);
      state.turnOrder = turnOrder;

      if (state.gameMode === 'shared') {
        // Auto-generate one secret; everyone guesses it, skip SET_NUMBER entirely
        const secret = generateSharedSecret();
        console.log(`[start_game] Room ${code} shared secret: ${secret}`);
        state.secretNumbers[SHARED_KEY] = secret;
        turnOrder.forEach((id) => { state.targetMap[id] = SHARED_KEY; });
        state.currentTurn = turnOrder[0];
        state.status = 'GUESSING';

        await setRedisRoom(state);
        await roomRepository.updateByCode(code, { status: 'GUESSING', sharedSecret: secret });

        io.to(code).emit('phase_change', { phase: 'GUESSING' });
        io.to(code).emit('room_update', state);
        io.to(code).emit('your_turn', { guestId: state.currentTurn });
      } else {
        // Standard: each player sets their own number
        state.targetMap = buildTargetMap(turnOrder);
        state.status = 'SET_NUMBER';

        await setRedisRoom(state);
        await roomRepository.updateByCode(code, { status: 'SET_NUMBER' });

        io.to(code).emit('phase_change', { phase: 'SET_NUMBER' });
        io.to(code).emit('room_update', state);
      }
    } catch (err) {
      console.error('[start_game]', err);
      socket.emit('error', { message: 'Failed to start game' });
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

      // Wait for every player in the game to set their number
      const allSet = state.turnOrder.every((id) => state.secretNumbers[id]);
      if (allSet) {
        state.currentTurn = state.turnOrder[0];
        state.status = 'GUESSING';
        await setRedisRoom(state);
        await roomRepository.updateByCode(code, { status: 'GUESSING' });
        io.to(code).emit('phase_change', { phase: 'GUESSING' });
        io.to(code).emit('room_update', state);
        io.to(code).emit('your_turn', { guestId: state.currentTurn });
      } else {
        await setRedisRoom(state);
        // Broadcast updated room so others can see how many have set their number
        io.to(code).emit('room_update', state);
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

      const targetGuestId = state.targetMap[guestId];
      if (!targetGuestId) return socket.emit('error', { message: 'Target not found' });

      const isSharedMode = targetGuestId === SHARED_KEY;
      const targetPlayer = isSharedMode ? null : findPlayer(state, targetGuestId);
      if (!isSharedMode && !targetPlayer)
        return socket.emit('error', { message: 'Target player not found' });

      const secret = state.secretNumbers[targetGuestId];
      if (!secret) return socket.emit('error', { message: 'Target has no secret set' });

      const correctDigits = countCorrectDigits(secret, guessStr);

      state.turnCount += 1;
      const mongoGuess = {
        byGuestId: guestId,
        targetGuestId,
        guessedNumber: guessStr,
        correctDigits,
        turnNumber: state.turnCount,
      };
      state.guesses.push(mongoGuess);
      await roomRepository.pushGuess(code, mongoGuess);

      const guessResult = {
        byGuestId: guestId,
        byNickname: nickname,
        targetGuestId,
        targetNickname: isSharedMode ? '' : targetPlayer!.nickname,
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

        const playerUpdates = state.players.map((p) =>
          Player.findOneAndUpdate(
            { guestId: p.guestId },
            { $inc: { gamesPlayed: 1, ...(p.guestId === guestId ? { gamesWon: 1 } : {}) } },
          ),
        );
        await Promise.all(playerUpdates);

        io.to(code).emit('guess_result', guessResult);
        io.to(code).emit('phase_change', { phase: 'FINISHED' });
        io.to(code).emit('game_over', {
          winnerGuestId: guestId,
          winnerNickname: nickname,
          crackedGuestId: targetGuestId,
          crackedNickname: isSharedMode ? '' : targetPlayer!.nickname,
          secret,
          totalTurns: state.turnCount,
        });
      } else {
        state.currentTurn = nextTurn(state, guestId);
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

      state.secretNumbers = {};
      state.guesses = [];
      state.turnCount = 0;
      state.winnerGuestId = null;
      state.currentTurn = null;

      if (state.gameMode === 'shared') {
        // Regenerate a fresh shared secret and jump straight to GUESSING
        const secret = generateSharedSecret();
        console.log(`[rematch] Room ${code} new shared secret: ${secret}`);
        state.secretNumbers[SHARED_KEY] = secret;
        state.turnOrder.forEach((id) => { state.targetMap[id] = SHARED_KEY; });
        state.currentTurn = state.turnOrder[0];
        state.status = 'GUESSING';

        await setRedisRoom(state);
        await roomRepository.updateByCode(code, { status: 'GUESSING', guesses: [], winnerGuestId: null, sharedSecret: secret });

        io.to(code).emit('phase_change', { phase: 'GUESSING' });
        io.to(code).emit('room_update', state);
        io.to(code).emit('your_turn', { guestId: state.currentTurn });
      } else {
        state.status = 'SET_NUMBER';

        await setRedisRoom(state);
        await roomRepository.updateByCode(code, { status: 'SET_NUMBER', guesses: [], winnerGuestId: null });

        io.to(code).emit('phase_change', { phase: 'SET_NUMBER' });
        io.to(code).emit('room_update', state);
      }
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

      const timerKey = `${code}:${guestId}`;

      if (state.status === 'LOBBY') {
        // Grace period: if the player reconnects within LOBBY_GRACE_MS, do nothing.
        disconnectTimers.set(timerKey, setTimeout(async () => {
          disconnectTimers.delete(timerKey);
          const fresh = await getRedisRoom(code);
          if (!fresh || fresh.status !== 'LOBBY') return;
          if (!fresh.players.some((p) => p.guestId === guestId)) return;
          fresh.players = fresh.players.filter((p) => p.guestId !== guestId);
          await setRedisRoom(fresh);
          await roomRepository.updateByCode(code, { players: fresh.players });
          io.to(code).emit('player_left', { guestId, nickname });
          io.to(code).emit('room_update', fresh);
        }, LOBBY_GRACE_MS));
        return;
      }

      if (state.status === 'SET_NUMBER' || state.status === 'GUESSING') {
        // During active game, if it was their turn advance it immediately so
        // others aren't blocked, but keep the player in the room for GAME_GRACE_MS
        // so a brief reconnect lets them continue.
        const wasTheirTurn = state.currentTurn === guestId;
        const oldIdx = state.turnOrder.indexOf(guestId);

        if (wasTheirTurn && state.status === 'GUESSING') {
          const newIdx = (oldIdx + 1) % state.turnOrder.length;
          state.currentTurn = state.turnOrder[newIdx];
          await setRedisRoom(state);
          io.to(code).emit('your_turn', { guestId: state.currentTurn! });
        }

        disconnectTimers.set(timerKey, setTimeout(async () => {
          disconnectTimers.delete(timerKey);
          const fresh = await getRedisRoom(code);
          if (!fresh || fresh.status === 'LOBBY' || fresh.status === 'FINISHED') return;
          if (!fresh.players.some((p) => p.guestId === guestId)) return;

          const freshOldIdx = fresh.turnOrder.indexOf(guestId);
          const freshWasTurn = fresh.currentTurn === guestId;
          fresh.turnOrder = fresh.turnOrder.filter((id) => id !== guestId);
          fresh.players   = fresh.players.filter((p) => p.guestId !== guestId);

          if (fresh.turnOrder.length < 2) {
            const lastGuestId = fresh.turnOrder[0] ?? null;
            const lastPlayer  = lastGuestId ? findPlayer(fresh, lastGuestId) : null;
            fresh.status = 'FINISHED';
            fresh.winnerGuestId = lastGuestId;
            await setRedisRoom(fresh);
            if (lastGuestId) await roomRepository.setFinished(code, lastGuestId);
            io.to(code).emit('phase_change', { phase: 'FINISHED' });
            if (lastPlayer) {
              io.to(code).emit('game_over', {
                winnerGuestId: lastPlayer.guestId,
                winnerNickname: lastPlayer.nickname,
                crackedGuestId: guestId,
                crackedNickname: nickname,
                secret: fresh.secretNumbers[guestId] ?? null,
                totalTurns: fresh.turnCount,
                reason: 'player_disconnected',
              });
            }
            return;
          }

          if (fresh.gameMode === 'shared') {
            fresh.turnOrder.forEach((id) => { fresh.targetMap[id] = SHARED_KEY; });
          } else {
            fresh.targetMap = buildTargetMap(fresh.turnOrder);
          }
          delete fresh.secretNumbers[guestId];

          if (freshWasTurn) {
            const newIdx = freshOldIdx < fresh.turnOrder.length ? freshOldIdx : 0;
            fresh.currentTurn = fresh.turnOrder[newIdx];
          }

          await setRedisRoom(fresh);
          io.to(code).emit('player_left', { guestId, nickname });
          io.to(code).emit('room_update', fresh);
          if (fresh.status === 'GUESSING') {
            io.to(code).emit('your_turn', { guestId: fresh.currentTurn! });
          }
        }, GAME_GRACE_MS));
      }
    } catch (err) {
      console.error('[disconnecting]', err);
    }
  });
}
