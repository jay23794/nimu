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
    guess_result({ byGuestId, byNickname, targetGuestId, targetNickname, guess, correctDigits, turnNumber })
    game_over({ winnerGuestId, winnerNickname, crackedGuestId, crackedNickname, secret, totalTurns, reason? })
    player_left({ guestId, nickname })
    error({ message })

  Client → Server:
    join_room({ code })
    start_game({ code })
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
  const [phase, setPhase]             = useState('waiting')
  const [roomCode, setRoomCode]       = useState(null)
  const [gameMode, setGameMode]       = useState('standard') // 'standard' | 'shared'
  const [currentTurn, setTurn]        = useState(null)
  const [players, setPlayers]         = useState([])
  const [amHost, setAmHost]           = useState(false)  // whether the local player is the host
  const [turnOrder, setTurnOrder]     = useState([])
  const [targetMap, setTargetMap]     = useState({})
  const [secretsSetCount, setSecretsSetCount] = useState(0)
  const [guesses, setGuesses]         = useState([])
  const [numberSet, setNumberSet]     = useState(false)
  const [mySecret, setMySecret]       = useState(null)
  const [gameOver, setGameOver]       = useState(null)
  const [error, setError]             = useState(null)

  const codeRef    = useRef(null)
  const attachedTo = useRef(null)   // tracks which socket already has listeners

  useEffect(() => () => disconnectSocket(), [])

  function _attach(sock) {
    if (attachedTo.current === sock) return   // already listening on this socket
    attachedTo.current = sock
    // Re-join the socket.io room on every reconnect
    sock.on('connect', () => {
      if (codeRef.current) {
        sock.emit('join_room', { code: codeRef.current })
      }
    })

    sock.on('room_update', (state) => {
      setRoomCode(state.code)
      setGameMode(state.gameMode ?? 'standard')
      setPlayers(state.players ?? [])
      setTurn(state.currentTurn ?? null)
      setTurnOrder(state.turnOrder ?? [])
      setTargetMap(state.targetMap ?? {})
      setPhase(mapPhase(state.status))
      codeRef.current = state.code
      setError(null)
      // Track whether the local socket's player is the host
      const myGuestId = sock.auth?.guestId
      const meInRoom = (state.players ?? []).find(p => p.guestId === myGuestId)
      if (meInRoom) setAmHost(!!meInRoom.isHost)
      // In standard mode count secrets set (exclude the __shared__ key)
      const secretKeys = Object.keys(state.secretNumbers ?? {}).filter(k => k !== '__shared__')
      setSecretsSetCount(secretKeys.length)
    })

    sock.on('phase_change', ({ phase: p }) => {
      setPhase(mapPhase(p))
      if (p === 'SET_NUMBER') {
        setNumberSet(false)
        setMySecret(null)
        setGuesses([])
        setGameOver(null)
        setSecretsSetCount(0)
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
      // room_update follows to reflect updated player list
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
    if (sock.connected) {
      sock.emit('join_room', { code })
    }
    return true
  }

  function startGame() {
    const sock = getSocket()
    if (!sock) return
    sock.emit('start_game', { code: codeRef.current })
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
    gameMode,
    amHost,
    currentTurn,
    players,
    turnOrder,
    targetMap,
    secretsSetCount,
    guesses,
    numberSet,
    mySecret,
    gameOver,
    error,
    joinRoom,
    startGame,
    setSecretNumber,
    makeGuess,
    rematch,
  }
}
