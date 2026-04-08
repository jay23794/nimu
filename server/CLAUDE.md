# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Development server with hot reload (tsx watch)
npm run build    # Compile TypeScript to dist/
npm start        # Run production build from dist/
```

No test runner is configured yet.

## Environment

The server requires a `.env` file with:
- `PORT` — HTTP server port (default 3001)
- `MONGODB_URI` — MongoDB connection string
- `REDIS_URL` — Redis URL (supports `rediss://` for TLS, e.g. Upstash)

## Architecture

This is a real-time 2-player number-guessing game server. Players guess their opponent's secret 4-digit number; each guess returns how many digits are correct (no position info). First to guess all 4 wins.

**Stack:** Node.js + TypeScript (ESM), Express, Socket.IO, MongoDB (Mongoose), Redis (ioredis)

**Layered structure:**
```
Routes → Controllers → Services → Repositories → Models
```

**Dual storage strategy:**
- MongoDB — persistent room/player records
- Redis — live game state with 2-hour TTL for fast real-time access

### HTTP API (`/api/rooms`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/create` | Create a new room |
| POST | `/join` | Join by room code |
| POST | `/random` | Random public matchmaking (atomic join-or-create) |
| GET | `/:code` | Get room state |
| GET | `/history/:guestId` | Get finished games for a player |

### Socket.IO Game Flow

Events handled in `src/socket/game.handler.ts`:
1. `join_room` — Player joins; auto-transitions to `SET_NUMBER` when 2 players are present
2. `set_number` — Each player sets their secret number; transitions to `GUESSING` once both are set
3. `make_guess` — Turn-based guessing; broadcasts result with correct-digit count
4. `rematch` — Resets the room for another round
5. `disconnecting` — Awards win to remaining player if a game is in progress

### Room Status State Machine

`LOBBY` → `SET_NUMBER` → `GUESSING` → `FINISHED`

### Player Identity

Players are identified by `guestId` (no authentication yet). Auth middleware stubs exist in `src/middleware/auth.middleware.ts` for future use. `Player` model has `email`/`passwordHash` fields for future auth.

### Key Patterns

- **Atomic public matchmaking:** `room.repository.ts → atomicJoinPublic` uses a MongoDB find-and-update to avoid race conditions when two players request a public room simultaneously.
- **Room codes:** 6-character alphanumeric IDs generated via `nanoid`.
- **ESM imports:** All imports must use explicit `.js` extensions (TypeScript NodeNext resolution).
