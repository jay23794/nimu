export type RoomStatus = 'LOBBY' | 'SET_NUMBER' | 'GUESSING' | 'FINISHED';
export type GameMode = 'standard' | 'shared';

export interface RoomPlayer {
  guestId: string;
  nickname: string;
  isHost: boolean;
}

export interface GuessEntry {
  byGuestId: string;
  targetGuestId?: string; // whose number was being guessed (optional for backward compat)
  guessedNumber: string;
  correctDigits: number;
  turnNumber: number;
}

export interface RedisRoomState {
  code: string;
  status: RoomStatus;
  gameMode: GameMode;
  players: RoomPlayer[];
  currentTurn: string | null;
  /** Ordered guestIds for round-robin turns */
  turnOrder: string[];
  /** Maps guestId → the guestId of the player whose secret they are guessing.
   *  In 'shared' mode every entry maps to '__shared__'. */
  targetMap: Record<string, string>;
  secretNumbers: Record<string, string>;
  guesses: GuessEntry[];
  turnCount: number;
  winnerGuestId: string | null;
}

export interface GuessResult {
  byGuestId: string;
  byNickname: string;
  targetGuestId: string;
  targetNickname: string;
  guess: string;
  correctDigits: number;
  turnNumber: number;
}

export interface GameOverPayload {
  winnerGuestId: string;
  winnerNickname: string;
  crackedGuestId: string;    // '__shared__' in shared mode, otherwise the player whose number was cracked
  crackedNickname: string;
  secret: string | null;
  totalTurns: number;
  reason?: 'player_disconnected';
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
  start_game: (data: { code: string }) => void;
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
