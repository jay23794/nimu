import mongoose from 'mongoose';

const ROOM_STATUSES = ['LOBBY', 'SET_NUMBER', 'GUESSING', 'FINISHED'];

const guessSchema = new mongoose.Schema(
  {
    byGuestId: { type: String, required: true },
    guessedNumber: { type: String, required: true },
    correctDigits: { type: Number, required: true },
    turnNumber: { type: Number, required: true },
  },
  { _id: false }
);

const roomPlayerSchema = new mongoose.Schema(
  {
    guestId: { type: String, required: true },
    nickname: { type: String, required: true },
    isHost: { type: Boolean, default: false },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ROOM_STATUSES, default: 'LOBBY' },
    players: [roomPlayerSchema],
    guesses: [guessSchema],
    winnerGuestId: { type: String, default: null },
    isPublic: { type: Boolean, default: true },
    gameType: { type: String, default: 'standard' },
  },
  { timestamps: true }
);

export const Room = mongoose.model('Room', roomSchema);
