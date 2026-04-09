import { useEffect, useRef, useState } from 'react'
import { getSocket, disconnectSocket } from '../socket/socket'

/*
  Server phases:  LOBBY | SET_NUMBER | GUESSING | FINISHED
  Client phases:  waiting | set_number | playing | game_over

  Server → Client:
    room_update(state)
    phase_change({ phase })
    your_turn({ guestId })
    number_set()
    guess_result({ byGuestId, byNickname, guess, correctDigits, turnNumber })
    game_over({ winnerGuestId, winnerNickname, secret, totalTurns, reason? })
    player_left({ guestId, nickname })
    error({ message })

  Client → Server:
    join_room({ code })
    set_number({ code, number })
    make_guess({ code, guess })
    rematch({ code })
*/

function mapPhase(serverPhase) {
  switch (serverPhase) {
    case 'LOBBY':      return 'waiting'
    case 'SET_NUMBER': return 'set_number'
    case 'GUESSING':   return 'playing'
    case 'FINISHED':   return 'game_over'
    default:           return 'waiting'
  }
}

export function useGame() {
  const [phase, setPhase]         = useState('waiting')
  const [roomCode, setRoomCode]   = useState(null)
  const [currentTurn, setTurn]    = useState(null)  // guestId of whose turn it is
  const [players, setPlayers]     = useState([])
  const [guesses, setGuesses]     = useState([])
  const [numberSet, setNumberSet] = useState(false)
  const [mySecret, setMySecret]   = useState(null)
  const [gameOver, setGameOver]   = useState(null)
  const [error, setError]         = useState(null)

  const codeRef = useRef(null)

  useEffect(() => () => disconnectSocket(), [])

  function _attach(sock) {
    // Re-join the socket.io room on every reconnect (handles Render's proxy
    // timeouts and server restarts that drop the WebSocket connection)
    sock.on('connect', () => {
      if (codeRef.current) {
        sock.emit('join_room', { code: codeRef.current })
      }
    })

    sock.on('room_update', (state) => {
      setRoomCode(state.code)
      setPlayers(state.players ?? [])
      setTurn(state.currentTurn ?? null)
      setPhase(mapPhase(state.status))
      codeRef.current = state.code
      setError(null)
    })

    sock.on('phase_change', ({ phase: p }) => {
      setPhase(mapPhase(p))
      if (p === 'SET_NUMBER') {
        setNumberSet(false)
        setMySecret(null)
        setGuesses([])
        setGameOver(null)
      }
    })

    sock.on('your_turn', ({ guestId }) => {
      setTurn(guestId)
    })

    sock.on('number_set', () => {
      setNumberSet(true)
    })

    sock.on('guess_result', (entry) => {
      setGuesses((prev) => [...prev, entry])
    })

    sock.on('game_over', (data) => {
      setGameOver(data)
      setPhase('game_over')
    })

    sock.on('player_left', () => {
      // game_over follows immediately when game was live
    })

    sock.on('error', ({ message }) => {
      setError(message)
    })
  }

  // Returns false if socket is not initialized (user navigated directly without lobby)
  function joinRoom(code) {
    const sock = getSocket()
    if (!sock) return false
    codeRef.current = code
    _attach(sock)
    // If already connected emit now; if not, the 'connect' handler will emit once connected
    if (sock.connected) {
      sock.emit('join_room', { code })
    }
    return true
  }

  function setSecretNumber(number) {
    const sock = getSocket()
    if (!sock) return
    setMySecret(number)
    sock.emit('set_number', { code: codeRef.current, number })
  }

  function makeGuess(guess) {
    const sock = getSocket()
    if (!sock) return
    sock.emit('make_guess', { code: codeRef.current, guess })
  }

  function rematch() {
    const sock = getSocket()
    if (!sock) return
    sock.emit('rematch', { code: codeRef.current })
  }

  return {
    phase,
    roomCode,
    currentTurn,
    players,
    guesses,
    numberSet,
    mySecret,
    gameOver,
    error,
    joinRoom,
    setSecretNumber,
    makeGuess,
    rematch,
  }
}
