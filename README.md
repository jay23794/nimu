# NIMU

A real-time multiplayer number-guessing game for 2–15 players. Players try to crack each other's secret 4-digit numbers. The first to guess all 4 digits correctly wins.

---

## Game Modes

| Mode | Description |
|------|-------------|
| **Standard** | Each player picks a secret number; players take turns guessing opponents' numbers in round-robin order |
| **Shared Secret** | One auto-generated secret number; all players race to guess it |

**Digit matching rule:** Only the count of matching digits is revealed — no position info. Each digit in the secret matches at most once.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, Chakra UI v3 |
| Routing | React Router v7 |
| Real-time | Socket.io (client + server) |
| Backend | Node.js, Express 4 |
| Database | MongoDB (Mongoose 8) |
| Cache / Live State | Upstash Redis (ioredis 5) |
| Language | TypeScript (ESM, strict mode) |
| Identity | Guest-only via `localStorage` + nanoid |

---

## System Architecture

```
Browser (React SPA)
  │
  ├── REST  /api/rooms/*  ──────────────────┐
  └── WebSocket  /socket.io  ───────────────┤
                                            ▼
                                     Express Server
                                      (:3001)
                                    ┌──────────────┐
                                    │  REST Layer  │
                                    │  Routes →    │
                                    │  Controllers │
                                    │  → Services  │
                                    │  → Repos     │
                                    ├──────────────┤
                                    │  Socket.io   │
                                    │  Handler     │
                                    └──────┬───────┘
                                           │
                             ┌─────────────┴─────────────┐
                             ▼                           ▼
                          MongoDB                      Redis
                       (Persistent)               (Hot game state)
                    Room records, guesses,        Secrets, turn order,
                    player stats, history         live room state (2h TTL)
```

### Dual Transport Design

- **REST** handles room lifecycle only: create, join, matchmake. Runs once before gameplay.
- **WebSocket** handles all in-game events: guesses, turns, phase changes. Stays open for the session.

### Dual Storage Design

| Data | MongoDB | Redis |
|------|---------|-------|
| Room metadata | Persistent | Synced copy |
| Guess history | Permanent | Live copy |
| Secret numbers | **Never** | **Only here** |
| Current turn / turn order | No | Yes |
| Player stats (wins/games) | Incremented on game end | No |

Secrets are never sent back to clients. Each client stores only its own secret locally after submission.

---

## Project Structure

```
nimu/
├── src/                        # React frontend
│   ├── context/PlayerContext   # guestId + nickname (localStorage)
│   ├── services/rooms.js       # REST API calls
│   ├── socket/socket.js        # Socket.io singleton
│   ├── hooks/useGame.js        # All game state + socket listeners
│   ├── pages/
│   │   ├── Lobby.jsx           # Room creation/joining + REST calls
│   │   └── Room.jsx            # Phase-driven game UI
│   └── components/
│       ├── WaitingLobby.jsx    # LOBBY phase
│       ├── SetNumber.jsx       # SET_NUMBER phase
│       ├── GameBoard.jsx       # GUESSING phase
│       └── GameOver.jsx        # FINISHED phase
│
├── server/src/
│   ├── index.ts                # Boot: DB → Redis → Express → Socket.io
│   ├── config/                 # Express app, DB, Redis setup
│   ├── models/                 # Mongoose: Room, Player
│   ├── repositories/           # MongoDB queries (no business logic)
│   ├── services/               # Business logic, Redis state management
│   ├── controllers/            # Thin HTTP handlers
│   ├── routes/                 # Express route definitions
│   ├── socket/                 # Socket.io auth guard + game handler
│   ├── middleware/             # Error handling, auth stubs
│   └── types/                  # Shared TypeScript types
│
├── vite.config.js              # Proxies /api and /socket.io → :3001
└── package.json                # Root: React frontend scripts
```

---

## REST API

Base path: `/api/rooms`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/create` | Create a private room. Body: `{ guestId, nickname, gameMode? }` |
| POST | `/join` | Join an existing room. Body: `{ code, guestId, nickname }` |
| POST | `/random` | Quick match — atomically claim a waiting room or create one. Body: `{ guestId, nickname }` |
| GET | `/:code` | Get current Redis room state |
| GET | `/history/:guestId` | Get finished games for a player (from MongoDB) |
| GET | `/health` | Health check |

---

## Socket.io Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `{ code }` | Join/rejoin a socket room |
| `start_game` | `{ code }` | Host starts the game (requires 2+ players) |
| `set_number` | `{ code, number }` | Lock in your 4-digit secret |
| `make_guess` | `{ code, guess }` | Submit a guess on your turn |
| `rematch` | `{ code }` | Reset room for another round |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room_update` | `RedisRoomState` | Full state snapshot on join or phase change |
| `phase_change` | `{ phase }` | Explicit phase notification |
| `your_turn` | `{ guestId }` | Whose turn it is |
| `number_set` | — | Confirms your secret was accepted |
| `guess_result` | `{ byGuestId, guess, correctDigits }` | Broadcast after every guess |
| `game_over` | `GameOverPayload` | Sent per-socket with opponent's secret revealed |
| `player_left` | `{ guestId, nickname }` | Player disconnected mid-game |
| `error` | `{ message }` | Error details |

---

## Game State Machine

```
LOBBY
  └─ host starts (2–15 players) ──→ SET_NUMBER
                                        └─ all players set secret ──→ GUESSING
                                                                          └─ player guesses correctly ──→ FINISHED
                                                                          └─ player disconnects ────────→ FINISHED
                                                                                                              └─ rematch ──→ SET_NUMBER
```

Shared mode skips SET_NUMBER — server generates the secret and jumps directly to GUESSING.

---

## Identity & Auth

Identity is **guest-only**. No login required.

- Client generates a `guestId` with `nanoid` (crypto.getRandomValues) on first visit
- Stored in `localStorage` alongside `nickname`
- Sent as Socket.io `auth: { guestId, nickname }` on connect
- Server trusts this value (no verification currently)

Auth middleware stubs and Player model fields (`email`, `passwordHash`) exist for a future JWT layer.

---

## Atomic Matchmaking

The `/random` endpoint uses a single atomic MongoDB `findOneAndUpdate` to claim a waiting room without race conditions:

```js
Room.findOneAndUpdate(
  {
    status: 'LOBBY',
    isPublic: true,
    'players.0': { $exists: true },     // at least 1 player
    'players.1': { $exists: false },    // room not yet full
    'players.guestId': { $ne: guestId } // not already joined
  },
  { $push: { players: { guestId, nickname, isHost: false } } },
  { new: true, sort: { createdAt: 1 } }
)
```

If no room is found, a new public room is created and waits for the next player.

---

## Development

**Prerequisites:** Node.js 20+, MongoDB, Redis (or Upstash)

**Frontend (port 5173):**
```bash
npm install
npm run dev
```

**Backend (port 3001):**
```bash
cd server
cp .env.example .env   # fill in MONGODB_URI and REDIS_URL
npm install
npm run dev
```

Vite proxies `/api` and `/socket.io` to `localhost:3001` automatically.

**Production build:**
```bash
npm run build    # builds React + compiles server TypeScript
npm start        # runs server, serves static files from dist/
```

---

## Environment Variables (server/.env)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3001) |
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis URL — use `rediss://` for Upstash TLS |

---

## Not Yet Implemented

| Feature | Notes |
|---------|-------|
| Authentication | Stubs exist; needs JWT + login flow |
| Game history UI | API (`/history/:guestId`) works; no frontend page |
| Reconnection recovery | Redis state survives reconnect, but `mySecret` is lost on page refresh during SET_NUMBER |
| Stale room cleanup | Redis TTL handles expiry; orphaned MongoDB LOBBY rooms need a cleanup job |
| Spectator mode | Not started |
