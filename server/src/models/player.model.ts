import mongoose, { Document, Schema } from 'mongoose';

export interface IPlayer extends Document {
  guestId: string;
  nickname: string;
  gamesPlayed: number;
  gamesWon: number;
  isGuest: boolean;
  email: string | null;
  passwordHash: string | null;
}

const playerSchema = new Schema<IPlayer>(
  {
    guestId: { type: String, required: true, unique: true, index: true },
    nickname: { type: String, required: true },
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    isGuest: { type: Boolean, default: true },
    email: { type: String, default: null },
    passwordHash: { type: String, default: null },
  },
  { timestamps: true },
);

export const Player = mongoose.model<IPlayer>('Player', playerSchema);
