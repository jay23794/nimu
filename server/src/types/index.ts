export type RoomStatus = 'LOBBY' | 'SET_NUMBER' | 'GUESSING' | 'FINISHED';

export interface RoomPlayer {
  guestId: string;
  nickname: string;
  isHost: boolean;
}

export interface GuessEntry {
  byGuestId: string;
  guessedNumber: string;
  correctDigits: number;
  turnNumber: number;
}

export interface RedisRoomState {
  code: string;
  status: RoomStatus;
  players: RoomPlayer[];
  currentTurn: string | null;
  secretNumbers: Record<string, string>;
  guesses: GuessEntry[];
  turnCount: number;
  winnerGuestId: string | null;
}

export interface GuessResult {
  byGuestId: string;
  byNickname: string;
  guess: string;
  correctDigits: number;
  turnNumber: number;
}

export interface GameOverPayload {
  winnerGuestId: string;
  winnerNickname: string;
  secret: string | null;
  totalTurns: number;
  reason?: 'opponent_disconnected';
}

// ── Socket.IO event maps ────────────────────────────────────────────────────

export interface ServerToClientEvents {
  room_update: (state: RedisRoomState) => void;
  phase_change: (data: { phase: RoomStatus }) => void;
  your_turn: (data: { guestId: string }) => void;
  guess_result: (data: GuessResult) => void;
  game_over: (data: GameOverPayload) => void;
  number_set: () => void;
  player_left: (data: { guestId: string; nickname: string }) => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  join_room: (data?: { code?: string }) => void;
  set_number: (data: { code: string; number: string | number }) => void;
  make_guess: (data: { code: string; guess: string | number }) => void;
  rematch: (data: { code: string }) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  guestId: string;
  nickname: string;
  code?: string;
}
