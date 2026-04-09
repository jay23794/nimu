import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { useGame } from '../hooks/useGame'
import WaitingLobby from '../components/WaitingLobby'
import SetNumber from '../components/SetNumber'
import GameBoard from '../components/GameBoard'
import GameOver from '../components/GameOver'

export default function Room() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { player } = usePlayer()
  const game = useGame()

  const {
    phase, roomCode, currentTurn, players, guesses,
    numberSet, mySecret, gameOver, error,
    joinRoom, setSecretNumber, makeGuess, rematch,
  } = game

  // Redirect to lobby if no player registered or socket not initialized
  useEffect(() => {
    if (!player) { navigate('/', { replace: true }); return }
    const ok = joinRoom(code)
    if (!ok) navigate('/', { replace: true })
  }, [])

  // Warn before reload/close during an active game
  useEffect(() => {
    if (phase === 'game_over') return
    const guard = (e) => {
      e.preventDefault()
      // Safari requires a non-empty string assigned to returnValue AND returned
      // from the handler; Chrome/Firefox only need preventDefault()
      e.returnValue = 'If you leave, the game will end and your opponent wins.'
      return e.returnValue
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [phase])

  const me = player?.nickname
  const myGuestId = player?.id
  const opponent = players.find((p) => p.guestId !== myGuestId)
  const isMyTurn = currentTurn === myGuestId

  // Derive stats from guesses
  const myGuesses = guesses.filter((g) => g.byGuestId === myGuestId).length
  const theirGuesses = guesses.filter((g) => g.byGuestId !== myGuestId).length

  if (phase === 'waiting') {
    return (
      <WaitingLobby
        roomCode={roomCode || code || '…'}
        playerName={me}
        opponentName={opponent?.nickname || null}
        error={error}
      />
    )
  }

  if (phase === 'set_number') {
    return (
      <SetNumber
        numberSet={numberSet}
        onLock={setSecretNumber}
      />
    )
  }

  if (phase === 'playing') {
    return (
      <GameBoard
        isMyTurn={isMyTurn}
        myName={me}
        myGuestId={myGuestId}
        mySecret={mySecret}
        opponentName={opponent?.nickname || ''}
        guesses={guesses}
        onGuess={makeGuess}
      />
    )
  }

  if (phase === 'game_over' && gameOver) {
    const isDisconnect = gameOver.reason === 'opponent_disconnected'
    const result = isDisconnect
      ? 'disconnect'
      : gameOver.winnerGuestId === myGuestId
      ? 'win'
      : 'lose'

    return (
      <GameOver
        result={result}
        theirNumber={gameOver.secret}
        totalTurns={gameOver.totalTurns || 0}
        myGuesses={myGuesses}
        theirGuesses={theirGuesses}
        onRematch={rematch}
        onLeave={() => navigate('/')}
      />
    )
  }

  return null
}
