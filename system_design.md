# Nimu — System Design

## Overview

Nimu is a real-time two-player number guessing game. Players secretly pick a 4-digit number and take turns guessing each other's number. Each guess returns how many digits are correct (no position info). First to guess all 4 wins.

The system uses two transports with strict separation of responsibility:
- **REST** handles room lifecycle (create, join, matchmake) — happens once before the game starts
- **WebSocket** handles everything in-game — stays open for the entire session

---

## Tech Stack

| Layer | Technology |
|---|---|
| Client | React 19, Vite 6, Chakra UI v3, socket.io-client, react-router-dom v6 |
| Server | Node.js, Express, Socket.io |
| Primary DB | MongoDB (via Mongoose) |
| Cache / Live State | Upstash Redis (via ioredis) |
| Identity | Guest-only for now — nanoid stored in localStorage |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Browser                          │
│                                                      │
│   React App (Vite dev :5173 / prod static)          │
│   ┌──────────────┐     ┌──────────────────────────┐ │
│   │  Lobby.jsx   │     │       Room.jsx            │ │
│   │  REST calls  │     │  useGame() socket only    │ │
│   └──────┬───────┘     └──────────────┬───────────┘ │
│          │ HTTP POST                  │ WebSocket    │
└──────────┼────────────────────────────┼─────────────┘
           │                            │
           ▼                            ▼
┌─────────────────────────────────────────────────────┐
│              Node.js Server (:3001)                  │
│                                                      │
│   Express (REST)          Socket.io (WS)            │
│   ┌────────────────┐      ┌──────────────────────┐  │
│   │ /api/rooms/    │      │  game.handler.js      │  │
│   │  create        │      │  join_room            │  │
│   │  join          │      │  set_number           │  │
│   │  random        │      │  make_guess           │  │
│   │  history       │      │  rematch              │  │
│   │  :code         │      │  disconnecting        │  │
│   └───────┬────────┘      └──────────┬───────────┘  │
│           │                          │               │
│   ┌───────▼──────────────────────────▼───────────┐  │
│   │              room.service.js                  │  │
│   │   createRoom / joinRoom / joinOrCreatePublic  │  │
│   │   getRedisRoom / setRedisRoom                 │  │
│   └───────┬──────────────────────────┬───────────┘  │
│           │                          │               │
└───────────┼──────────────────────────┼───────────────┘
            │                          │
            ▼                          ▼
┌───────────────────┐      ┌───────────────────────┐
│     MongoDB       │      │    Upstash Redis       │
│                   │      │                        │
│  rooms collection │      │  room:<code>  (2h TTL) │
│  - code           │      │  - code                │
│  - status         │      │  - status              │
│  - players        │      │  - players             │
│  - guesses        │      │  - secretNumbers ◄──── only here
│  - winnerGuestId  │      │  - currentTurn         │
│                   │      │  - guesses             │
│  players coll.    │      │  - turnCount           │
│  - guestId        │      │                        │
│  - nickname       │      │                        │
│  - gamesPlayed    │      │                        │
│  - gamesWon       │      │                        │
└───────────────────┘      └───────────────────────┘
```

---

## Client Architecture

```
src/
├── main.jsx                ChakraProvider + BrowserRouter + PlayerProvider
├── App.jsx                 Routes: / → Lobby, /room/:code → Room
├── theme.js                dark theme, brand green (#c8f060), Space Mono + Syne fonts
│
├── context/
│   ├── PlayerContext.jsx   player state (guestId + nickname) → localStorage
│   └── nanoid.js           crypto.getRandomValues ID generator
│
├── services/
│   └── rooms.js            REST API calls: create, join, random
│
├── socket/
│   └── socket.js           singleton io() — auth:{guestId,nickname}
│
├── hooks/
│   └── useGame.js          all socket listeners + action emitters
│
├── pages/
│   ├── Lobby.jsx           REST → initSocket → navigate (no socket here)
│   └── Room.jsx            phase-driven — delegates entirely to useGame
│
└── components/
    ├── WaitingLobby.jsx    phase: waiting
    ├── SetNumber.jsx       phase: set_number
    ├── GameBoard.jsx       phase: playing
    └── GameOver.jsx        phase: game_over
```

### Key Design Rules

1. **Lobby owns all HTTP.** It calls the API, gets a room code, calls `initSocket()`, then navigates. By the time Room.jsx mounts, the socket is already authenticated and connected.

2. **Room owns no HTTP.** It only calls `useGame()` which uses the existing socket. If no socket is found (direct URL navigation), it redirects to `/`.

3. **`useGame` is the single source of truth for game state.** All server events flow through it. Room.jsx is purely a phase router — it reads phase and renders the right component.

4. **Secrets never leave `useGame`.** The user's own secret is stored in local state (`mySecret`) after `setSecretNumber()` is called. It's never sent back by the server.

### Player Identity

```
First visit:
  nanoid() → localStorage["nimu_player"] = { id, nickname }

Every session:
  PlayerContext loads from localStorage
  Lobby registers if not found
  socket.io connection: io({ auth: { guestId, nickname } })
  Server upserts Player document on connect
```

No auth tokens, no sessions. Identity is purely client-side. Auth stubs exist in `middleware/auth.middleware.js` for a future JWT layer.

---

## Server Architecture

```
server/src/
├── index.js                boot: connectDB → getRedis → createApp → initSocket
│
├── config/
│   ├── app.js              Express setup, routes, error handler
│   ├── db.js               Mongoose connect
│   └── redis.js            ioredis singleton (Upstash, TLS)
│
├── models/
│   ├── Room.js             status, players[], guesses[], winnerGuestId
│   └── Player.js           guestId, nickname, gamesPlayed, gamesWon, auth stubs
│
├── repositories/
│   └── room.repository.js  all Mongoose queries (no business logic)
│
├── services/
│   └── room.service.js     business logic — creates rooms, manages Redis state
│
├── controllers/
│   └── room.controller.js  thin HTTP handlers — delegates to service
│
├── routes/
│   └── room.routes.js      POST create/join/random, GET :code, GET history/:guestId
│
├── socket/
│   ├── index.js            auth guard, Player upsert, registerGameHandlers
│   └── game.handler.js     all socket events
│
└── middleware/
    ├── auth.middleware.js  stubs: requireAuth, optionalAuth
    └── error.middleware.js AppError class + Express error handler
```

### Data Split: MongoDB vs Redis

| Concern | MongoDB | Redis |
|---|---|---|
| Room metadata | ✓ (code, players, status) | ✓ (synced copy) |
| Guess history | ✓ (permanent record) | ✓ (live copy) |
| Secret numbers | ✗ never | ✓ only here |
| Current turn | ✗ | ✓ |
| Winner | ✓ (on game end) | ✓ |
| Player stats | ✓ (incremented on game end) | ✗ |

**Why both?**
- Redis is the hot path — every socket event reads/writes Redis, not Mongo. This keeps game logic fast.
- MongoDB is the record of truth — survives Redis eviction, used for history and restoring state on server restart.

---

## REST API

All endpoints are under `/api/rooms`.

```
POST   /create            body: { guestId, nickname }
                          Creates a new private room. Returns { code }.

POST   /join              body: { code, guestId, nickname }
                          Joins an existing room by code. Returns { code }.

POST   /random            body: { guestId, nickname }
                          Quick match — atomically claims a waiting public
                          room or creates one. Returns { code }.

GET    /:code             Returns current Redis state for a room.

GET    /history/:guestId  Returns finished rooms for a player (MongoDB).
```

After any of the three POST calls, the client pattern is always:
```
{ code } = await roomsApi.X(...)
initSocket(guestId, nickname)
navigate(`/room/${code}`)
```

---

## Socket Contract

Socket connection carries identity in the handshake:
```js
io({ auth: { guestId, nickname } })
```

Server rejects connections without valid auth. On connect, it upserts the Player document and stores `{ guestId, nickname, code }` on `socket.data`.

### Client → Server Events

```
join_room({ code })
  Joins the socket room. If code = existing room → rejoin/reconnect.
  Server transitions LOBBY → SET_NUMBER when both players are present.

set_number({ code, number })
  Locks in the player's secret 4-digit number.
  Server transitions SET_NUMBER → GUESSING when both have submitted.

make_guess({ code, guess })
  Submit a 4-digit guess on your turn.
  Server evaluates, stores, flips turn or ends game.

rematch({ code })
  Reset the room back to SET_NUMBER. Both players re-enter secrets.
```

### Server → Client Events

```
room_update(state)
  Full room state snapshot. Sent on join and phase transitions.
  Client derives phase from state.status.

phase_change({ phase })
  Explicit phase notification: LOBBY | SET_NUMBER | GUESSING | FINISHED.
  Client maps to: waiting | set_number | playing | game_over.

your_turn({ guestId })
  Tells all clients whose turn it is.

number_set()
  Sent only to the player who just locked their number.

guess_result({ byGuestId, byNickname, guess, correctDigits, turnNumber })
  Broadcast to both players after every guess.

game_over({ winnerGuestId, winnerNickname, secret, totalTurns, reason? })
  Sent individually per socket — each player receives their opponent's secret.
  reason: 'opponent_disconnected' if via disconnect.

player_left({ guestId, nickname })
  Emitted before game_over when a player disconnects mid-game.
```

---

## Game Flow (End to End)

### 1. Lobby

```
Player A                         Server                        Player B
   │                               │                               │
   │── POST /api/rooms/create ────►│                               │
   │◄── { code: "X7K2A1" } ───────│                               │
   │                               │                               │
   │── initSocket(auth) ──────────►│                               │
   │── emit join_room({code}) ────►│                               │
   │                               │ 1 player in room              │
   │◄── room_update (LOBBY, 1p) ───│                               │
   │                               │                               │
   │                               │◄── POST /api/rooms/join ──────│
   │                               │──── { code: "X7K2A1" } ──────►│
   │                               │                               │
   │                               │◄── initSocket(auth) ──────────│
   │                               │◄── emit join_room({code}) ────│
   │                               │ 2 players → SET_NUMBER        │
   │◄── room_update (LOBBY, 2p) ───┼────────────────────────────── │
   │◄── phase_change(SET_NUMBER) ──┼──────────────────────────────►│
   │◄── room_update(SET_NUMBER) ───┼──────────────────────────────►│
```

### 2. Set Number

```
Player A                         Server                        Player B
   │                               │                               │
   │── emit set_number({code,"4821"})►│                            │
   │◄── number_set() ──────────────│                               │
   │                               │◄── emit set_number({code,"7390"})
   │                               │────────────── number_set() ──►│
   │                               │                               │
   │                               │  both set → GUESSING          │
   │◄── phase_change(GUESSING) ────┼──────────────────────────────►│
   │◄── room_update(GUESSING) ─────┼──────────────────────────────►│
   │◄── your_turn({guestId: A}) ───┼──────────────────────────────►│
```

### 3. Guessing (alternating turns)

```
Player A                         Server                        Player B
   │                               │                               │
   │── emit make_guess({code,"1234"})►│                            │
   │                               │ secret B = "7390"             │
   │                               │ correctDigits = 1 (digit "3") │
   │◄── guess_result({A,"1234",1}) ┼──────────────────────────────►│
   │◄── your_turn({guestId: B}) ───┼──────────────────────────────►│
   │                               │                               │
   │                               │◄── emit make_guess({code,"7821"})
   │                               │ secret A = "4821"             │
   │                               │ correctDigits = 3             │
   │◄── guess_result({B,"7821",3}) ┼──────────────────────────────►│
   │◄── your_turn({guestId: A}) ───┼──────────────────────────────►│
   │                               │                               │
   │── emit make_guess({code,"7390"})►│                            │
   │                               │ correctDigits = 4 → WIN       │
   │◄── guess_result(...) ─────────┼──────────────────────────────►│
   │◄── phase_change(FINISHED) ────┼──────────────────────────────►│
   │◄── game_over(win, secret="7390")                              │
   │                  game_over(lose, secret="4821") ─────────────►│
```

`game_over` is emitted individually per socket so each player only sees their opponent's secret.

### 4. Digit Evaluation

```js
// No position info — only count of matching digits
// secret="5189", guess="5100" → 2  (digits 5 and 1 appear in secret)
function countCorrectDigits(secret, guess) {
  const seen = new Set(secret.split(''))
  let count = 0
  for (const ch of guess) {
    if (seen.has(ch)) { count++; seen.delete(ch) }
  }
  return count
}
```

Each secret digit can only match once. No concept of "bulls and cows" — only total correct.

---

## Quick Match — Atomic Matchmaking

```
POST /api/rooms/random
         │
         ▼
atomicJoinPublic (single findOneAndUpdate)
  filter:
    status = LOBBY
    isPublic = true
    players has exactly 1 entry       ← host is waiting
    players[].guestId ≠ requesting    ← not your own room
  update:
    $push players ← add as guest
         │
    ┌────┴────┐
    │ found?  │
    └────┬────┘
    yes  │  no
         │         createRoom()
         ▼               ▼
   sync Redis      create + return code
   return code     host waits for Quick Match
```

Uses a single atomic MongoDB operation — no Redis locks, no race conditions. Two simultaneous Quick Match requests cannot claim the same room.

---

## Disconnect Handling

When a socket disconnects mid-game:

```
1. player_left emitted to remaining players
2. If status is GUESSING or SET_NUMBER:
   - opponent is declared winner
   - room status → FINISHED (MongoDB + Redis)
   - phase_change(FINISHED) emitted to room
   - game_over emitted to surviving players
     with the disconnected player's secret revealed
     and reason: 'opponent_disconnected'
```

---

## Phase State Machine

```
           ┌──────────────────────────────────────────────────┐
           │                                                  │
    LOBBY ──► SET_NUMBER ──► GUESSING ──► FINISHED ──► SET_NUMBER
    (wait)    (pick secret)  (take turns)  (winner)    (rematch)
                                │
                        player disconnects
                                │
                            FINISHED
```

Client-side mapping:
```
LOBBY      → 'waiting'
SET_NUMBER → 'set_number'
GUESSING   → 'playing'
FINISHED   → 'game_over'
```

---

## Redis State Shape

```js
{
  code: "X7K2A1",
  status: "GUESSING",            // LOBBY | SET_NUMBER | GUESSING | FINISHED
  players: [
    { guestId: "abc123", nickname: "ghost", isHost: true },
    { guestId: "def456", nickname: "cipher", isHost: false }
  ],
  secretNumbers: {               // ONLY in Redis, never in MongoDB
    "abc123": "4821",
    "def456": "7390"
  },
  currentTurn: "def456",
  guesses: [
    { byGuestId: "abc123", guessedNumber: "1234", correctDigits: 1, turnNumber: 1 },
    { byGuestId: "def456", guessedNumber: "7821", correctDigits: 3, turnNumber: 2 }
  ],
  turnCount: 2
}
```

TTL: 2 hours. Rooms not completed within 2 hours expire from Redis automatically. MongoDB record remains for history.

---

## MongoDB Schemas

### Room

```js
{
  code:          String   // unique 6-char, indexed
  status:        String   // LOBBY | SET_NUMBER | GUESSING | FINISHED
  players: [{
    guestId:     String
    nickname:    String
    isHost:      Boolean
  }]
  guesses: [{
    byGuestId:     String
    guessedNumber: String
    correctDigits: Number
    turnNumber:    Number
  }]
  winnerGuestId: String | null
  isPublic:      Boolean
  gameType:      String   // 'standard' for now
  timestamps:    createdAt, updatedAt
}
```

### Player

```js
{
  guestId:      String   // unique, indexed
  nickname:     String
  gamesPlayed:  Number
  gamesWon:     Number
  isGuest:      Boolean  // true until auth is added
  email:        String | null   // reserved for auth
  passwordHash: String | null   // reserved for auth
  timestamps:   createdAt, updatedAt
}
```

---

## What's Not Built Yet

| Feature | Status | Notes |
|---|---|---|
| Authentication | Stubs only | `requireAuth`, `optionalAuth` in middleware. Player model has `email` + `passwordHash` fields ready. |
| History UI | API exists | `GET /api/rooms/history/:guestId` works, no frontend page yet. |
| Mid-game reconnect | Partial | Redis state survives. On rejoin, `room_update` rehydrates client. But if the tab refreshes during `set_number` phase, `mySecret` local state is lost — client would need to re-set. |
| Stale room cleanup | Partial | Redis TTL handles expiry. MongoDB LOBBY rooms with no Redis key are ghost rooms — needs a periodic cleanup job. |
| Spectator mode | Not started | — |
| Room privacy (invite-only) | Partial | `isPublic` field exists, Quick Match already filters by it. No UI for private rooms beyond code sharing. |
