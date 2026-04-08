import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    guestId: { type: String, required: true, unique: true, index: true },
    nickname: { type: String, required: true },
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    isGuest: { type: Boolean, default: true },
    email: { type: String, default: null },
    passwordHash: { type: String, default: null },
  },
  { timestamps: true }
);

export const Player = mongoose.model('Player', playerSchema);
