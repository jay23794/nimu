import mongoose, { Document, Schema } from 'mongoose';
import type { RoomStatus, RoomPlayer, GuessEntry } from '../types/index.js';

export interface IRoom extends Document {
  code: string;
  status: RoomStatus;
  players: mongoose.Types.DocumentArray<RoomPlayer & mongoose.Types.Subdocument>;
  guesses: mongoose.Types.DocumentArray<GuessEntry & mongoose.Types.Subdocument>;
  winnerGuestId: string | null;
  isPublic: boolean;
  gameType: string;
}

const ROOM_STATUSES: RoomStatus[] = ['LOBBY', 'SET_NUMBER', 'GUESSING', 'FINISHED'];

const guessSchema = new Schema<GuessEntry>(
  {
    byGuestId: { type: String, required: true },
    guessedNumber: { type: String, required: true },
    correctDigits: { type: Number, required: true },
    turnNumber: { type: Number, required: true },
  },
  { _id: false },
);

const roomPlayerSchema = new Schema<RoomPlayer>(
  {
    guestId: { type: String, required: true },
    nickname: { type: String, required: true },
    isHost: { type: Boolean, default: false },
  },
  { _id: false },
);

const roomSchema = new Schema<IRoom>(
  {
    code: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ROOM_STATUSES, default: 'LOBBY' },
    players: [roomPlayerSchema],
    guesses: [guessSchema],
    winnerGuestId: { type: String, default: null },
    isPublic: { type: Boolean, default: true },
    gameType: { type: String, default: 'standard' },
  },
  { timestamps: true },
);

export const Room = mongoose.model<IRoom>('Room', roomSchema);
