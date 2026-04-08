import { nanoid } from 'nanoid';
import { getRedis } from '../config/redis.js';
import { roomRepository } from '../repositories/room.repository.js';
import { AppError } from '../middleware/error.middleware.js';

const ROOM_TTL = 60 * 60 * 2; // 2 hours

function generateCode() {
  return nanoid(6).toUpperCase();
}

function redisKey(code) {
  return `room:${code}`;
}

async function setRedisRoom(state) {
  const redis = getRedis();
  await redis.set(redisKey(state.code), JSON.stringify(state), 'EX', ROOM_TTL);
}

async function getRedisRoom(code) {
  const redis = getRedis();
  const raw = await redis.get(redisKey(code));
  return raw ? JSON.parse(raw) : null;
}

function buildRedisState(code, players) {
  return {
    code,
    status: 'LOBBY',
    players,
    currentTurn: players[0]?.guestId ?? null,
    secretNumbers: {},
    guesses: [],
    turnCount: 0,
  };
}

export const roomService = {
  async createRoom({ guestId, nickname, isPublic = true, gameType = 'standard' }) {
    const code = generateCode();
    const players = [{ guestId, nickname, isHost: true }];

    await roomRepository.create({ code, players, isPublic, gameType });
    await setRedisRoom(buildRedisState(code, players));

    return { code };
  },

  async joinRoom({ code, guestId, nickname }) {
    const room = await roomRepository.findByCode(code);
    if (!room) throw new AppError('Room not found', 404);
    if (room.status !== 'LOBBY') throw new AppError('Room is not in lobby', 400);
    if (room.players.length >= 2) throw new AppError('Room is full', 400);
    if (room.players.some((p) => p.guestId === guestId)) {
      throw new AppError('Already in room', 400);
    }

    room.players.push({ guestId, nickname, isHost: false });
    await room.save();

    const state = await getRedisRoom(code);
    if (!state) throw new AppError('Redis state not found', 500);
    state.players = room.players.map((p) => p.toObject());
    await setRedisRoom(state);

    return { code };
  },

  async joinOrCreatePublic({ guestId, nickname }) {
    // Single atomic DB op — no locks needed
    const joined = await roomRepository.atomicJoinPublic({ guestId, nickname });

    if (joined) {
      // Sync the new player list into Redis
      const state = await getRedisRoom(joined.code);
      if (state) {
        state.players = joined.players.map((p) => p.toObject());
        await setRedisRoom(state);
      }
      return { code: joined.code };
    }

    // No waiting room found — create one and wait for an opponent
    return this.createRoom({ guestId, nickname, isPublic: true });
  },

  async getRoomState(code) {
    const state = await getRedisRoom(code);
    if (!state) throw new AppError('Room not found', 404);
    return state;
  },

  async getHistory(guestId) {
    return roomRepository.findFinishedByGuestId(guestId);
  },

  // Exposed for socket layer
  getRedisRoom,
  setRedisRoom,
};
