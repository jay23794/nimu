# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Frontend (port 5173, proxies `/api` and `/socket.io` to `:3001`):**
```bash
npm run dev          # Vite dev server with hot reload
npm run build        # Vite build → dist/ (also builds server)
npm run preview      # Preview production build
```

**Backend (port 3001):**
```bash
cd server
npm run dev          # tsx watch src/index.ts (hot reload)
npm run build        # tsc → dist/
npm start            # node dist/index.js
```

**Run full stack in production:**
```bash
npm run build        # builds both frontend and server
npm start            # runs server which serves static dist/
```

No test runner is configured.

## Environment

Create `server/.env` with:
- `PORT` — HTTP port (default 3001)
- `MONGODB_URI` — MongoDB connection string
- `REDIS_URL` — Redis URL (`rediss://` for TLS, e.g. Upstash)

## Architecture

NIMU is a real-time multiplayer number-guessing game (2–15 players). Players each set a secret 4-digit number and take turns guessing any opponent's secret; each guess returns how many digits are correct (no position info). First player to correctly guess all opponents' secrets wins.

### Dual Transport

- **REST API** (`/api/rooms`) — room lifecycle only (create, join, matchmake)
- **WebSocket** (Socket.io) — all in-game events (guesses, turn changes, phase transitions)

### Dual Storage

- **MongoDB** — persistent room records, player data, guess history
- **Redis** — live game state (secrets, turn order, current phase) with 2-hour TTL for fast real-time access

Secrets are stored **only in Redis**, never exposed to clients via HTTP. Clients store their own secret locally after submission.

### Game State Machine

```
LOBBY → SET_NUMBER → GUESSING → FINISHED (→ rematch → SET_NUMBER)
```

### Backend (`server/src/`)

Layered architecture:
```
Routes → Controllers → Services → Repositories → Models
```

- `socket/game.handler.ts` — all WebSocket events: `join_room`, `set_number`, `make_guess`, `rematch`, `disconnecting`
- `services/room.service.ts` — business logic and Redis state management
- `repositories/room.repository.ts` — MongoDB queries; `atomicJoinPublic` uses `findOneAndUpdate` to prevent race conditions in matchmaking
- `types/index.ts` — shared TypeScript types including typed Socket.io event maps (`ServerToClientEvents`, `ClientToServerEvents`)
- ESM: all imports require explicit `.js` extensions (TypeScript NodeNext resolution)

### Frontend (`src/`)

- `pages/Lobby.jsx` — REST calls for room creation/joining/matchmaking
- `pages/Room.jsx` — renders the correct component based on current game phase
- `hooks/useGame.js` — central hook; owns all game state and Socket.io listeners
- `context/PlayerContext.jsx` — `guestId` (nanoid) and `nickname` persisted to `localStorage`; sent as Socket.io auth on connect
- `socket/socket.js` — Socket.io singleton connection

Phase-based components: `WaitingLobby` → `SetNumber` → `GameBoard` → `GameOver`

### Player Identity

Guest-only: `guestId` generated via `nanoid`, stored in `localStorage`, sent in Socket.io `auth`. No authentication yet — auth middleware stubs exist in `server/src/middleware/auth.middleware.ts` for future JWT integration. The `Player` model has `email`/`passwordHash` fields reserved for future use.
