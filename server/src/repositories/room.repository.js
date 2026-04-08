import { Room } from '../models/room.model.js';

export const roomRepository = {
  async create(data) {
    return Room.create(data);
  },

  async findByCode(code) {
    return Room.findOne({ code });
  },

  // Atomically claim a waiting public room — returns the updated doc or null
  async atomicJoinPublic({ guestId, nickname }) {
    return Room.findOneAndUpdate(
      {
        status: 'LOBBY',
        isPublic: true,
        'players.0': { $exists: true },  // at least 1 player (host waiting)
        'players.1': { $exists: false }, // exactly 1 player (not full)
        'players.guestId': { $ne: guestId }, // not already in room
      },
      { $push: { players: { guestId, nickname, isHost: false } } },
      { new: true, sort: { createdAt: 1 } }
    );
  },

  async findFinishedByGuestId(guestId) {
    return Room.find({
      status: 'FINISHED',
      'players.guestId': guestId,
    }).sort({ updatedAt: -1 });
  },

  async updateByCode(code, update) {
    return Room.findOneAndUpdate({ code }, update, { new: true });
  },

  async pushGuess(code, guess) {
    return Room.findOneAndUpdate(
      { code },
      { $push: { guesses: guess } },
      { new: true }
    );
  },

  async setFinished(code, winnerGuestId) {
    return Room.findOneAndUpdate(
      { code },
      { status: 'FINISHED', winnerGuestId },
      { new: true }
    );
  },
};
