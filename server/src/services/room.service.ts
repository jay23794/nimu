import { nanoid } from 'nanoid';
import { getRedis } from '../config/redis.js';
import { getIo } from '../socket/index.js';
import { roomRepository } from '../repositories/room.repository.js';
import { AppError } from '../middleware/error.middleware.js';
import type { RedisRoomState, RoomPlayer, GameMode } from '../types/index.js';

const ROOM_TTL = 60 * 60 * 2; // 2 hours

function generateCode(): string {
  return nanoid(6).toUpperCase();
}

function redisKey(code: string): string {
  return `room:${code}`;
}

export async function setRedisRoom(state: RedisRoomState): Promise<void> {
  const redis = getRedis();
  await redis.set(redisKey(state.code), JSON.stringify(state), 'EX', ROOM_TTL);
}

export async function getRedisRoom(code: string): Promise<RedisRoomState | null> {
  const redis = getRedis();
  const raw = await redis.get(redisKey(code));
  return raw ? (JSON.parse(raw) as RedisRoomState) : null;
}

function buildRedisState(code: string, players: RoomPlayer[], gameMode: GameMode = 'standard'): RedisRoomState {
  return {
    code,
    status: 'LOBBY',
    gameMode,
    players,
    currentTurn: null,
    turnOrder: [],
    targetMap: {},
    secretNumbers: {},
    guesses: [],
    turnCount: 0,
    winnerGuestId: null,
  };
}

export const roomService = {
  async createRoom({
    guestId,
    nickname,
    isPublic = true,
    gameType = 'standard',
    gameMode = 'standard',
  }: {
    guestId: string;
    nickname: string;
    isPublic?: boolean;
    gameType?: string;
    gameMode?: GameMode;
  }): Promise<{ code: string }> {
    const code = generateCode();
    const players: RoomPlayer[] = [{ guestId, nickname, isHost: true }];

    await roomRepository.create({ code, players, isPublic, gameType, gameMode });
    await setRedisRoom(buildRedisState(code, players, gameMode));

    return { code };
  },

  async joinRoom({
    code,
    guestId,
    nickname,
  }: {
    code: string;
    guestId: string;
    nickname: string;
  }): Promise<{ code: string }> {
    const room = await roomRepository.findByCode(code);
    if (!room) throw new AppError('Room not found', 404);
    if (room.status !== 'LOBBY') throw new AppError('Room is not in lobby', 400);
    if (room.players.length >= 15) throw new AppError('Room is full', 400);
    if (room.players.some((p) => p.guestId === guestId)) {
      throw new AppError('Already in room', 400);
    }

    room.players.push({ guestId, nickname, isHost: false } as RoomPlayer &
      (typeof room.players)[number]);
    await room.save();

    const state = await getRedisRoom(code);
    if (!state) throw new AppError('Redis state not found', 500);
    state.players = room.players.map((p) => p.toObject() as RoomPlayer);
    await setRedisRoom(state);

    // Notify any already-connected sockets in the room immediately
    getIo()?.to(code).emit('room_update', state);

    return { code };
  },

  async joinOrCreatePublic({
    guestId,
    nickname,
  }: {
    guestId: string;
    nickname: string;
  }): Promise<{ code: string }> {
    // Single atomic DB op — no locks needed
    const joined = await roomRepository.atomicJoinPublic({ guestId, nickname });

    if (joined) {
      const state = await getRedisRoom(joined.code);
      if (state) {
        state.players = joined.players.map((p) => p.toObject() as RoomPlayer);
        await setRedisRoom(state);
        // Notify already-connected sockets immediately
        getIo()?.to(joined.code).emit('room_update', state);
      }
      return { code: joined.code };
    }

    return this.createRoom({ guestId, nickname, isPublic: true });
  },

  async getRoomState(code: string): Promise<RedisRoomState> {
    const state = await getRedisRoom(code);
    if (!state) throw new AppError('Room not found', 404);
    return state;
  },

  async getHistory(guestId: string) {
    return roomRepository.findFinishedByGuestId(guestId);
  },
};
