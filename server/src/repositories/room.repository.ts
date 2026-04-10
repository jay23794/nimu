import { Room, IRoom } from '../models/room.model.js';
import type { GuessEntry, RoomPlayer } from '../types/index.js';

export const roomRepository = {
  async create(data: {
    code: string;
    players: RoomPlayer[];
    isPublic: boolean;
    gameType: string;
    gameMode?: string;
  }): Promise<IRoom> {
    return Room.create(data);
  },

  async findByCode(code: string): Promise<IRoom | null> {
    return Room.findOne({ code });
  },

  // Atomically claim a waiting public room — returns the updated doc or null
  async atomicJoinPublic({
    guestId,
    nickname,
  }: {
    guestId: string;
    nickname: string;
  }): Promise<IRoom | null> {
    return Room.findOneAndUpdate(
      {
        status: 'LOBBY',
        isPublic: true,
        'players.0': { $exists: true }, // at least 1 player (host waiting)
        'players.1': { $exists: false }, // exactly 1 player (not full)
        'players.guestId': { $ne: guestId }, // not already in room
      },
      { $push: { players: { guestId, nickname, isHost: false } } },
      { new: true, sort: { createdAt: 1 } },
    );
  },

  async findFinishedByGuestId(guestId: string): Promise<IRoom[]> {
    return Room.find({
      status: 'FINISHED',
      'players.guestId': guestId,
    }).sort({ updatedAt: -1 });
  },

  async updateByCode(code: string, update: object): Promise<IRoom | null> {
    return Room.findOneAndUpdate({ code }, update, { new: true });
  },

  async pushGuess(code: string, guess: GuessEntry): Promise<IRoom | null> {
    return Room.findOneAndUpdate({ code }, { $push: { guesses: guess } }, { new: true });
  },

  async setFinished(code: string, winnerGuestId: string): Promise<IRoom | null> {
    return Room.findOneAndUpdate(
      { code },
      { status: 'FINISHED', winnerGuestId },
      { new: true },
    );
  },
};
