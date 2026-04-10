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
    phase, roomCode, gameMode, amHost, currentTurn, players, turnOrder, targetMap, secretsSetCount,
    guesses, numberSet, mySecret, gameOver, error,
    joinRoom, startGame, setSecretNumber, makeGuess, rematch,
  } = game

  // Redirect to lobby if no player registered or socket not initialized
  useEffect(() => {
    if (!player) { navigate('/', { replace: true, state: { joinCode: code } }); return }
    const ok = joinRoom(code)
    if (!ok) navigate('/', { replace: true, state: { joinCode: code } })
  }, [])

  // Warn before reload/close during an active game
  useEffect(() => {
    if (phase === 'game_over') return
    const guard = (e) => {
      e.preventDefault()
      e.returnValue = 'If you leave, the game will end.'
      return e.returnValue
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [phase])

  const myGuestId = player?.id
  const me = player?.nickname
  // amHost comes from room_update: server confirmed this socket's player has isHost:true
  const isHost = amHost

  // Who is the current turn player (full object)
  const currentTurnPlayer = players.find((p) => p.guestId === currentTurn) ?? null
  const isMyTurn = currentTurn === myGuestId

  // My target (whose secret I'm guessing)
  const myTargetGuestId = targetMap[myGuestId]
  const myTargetName = players.find((p) => p.guestId === myTargetGuestId)?.nickname ?? null

  // Stats
  const myGuesses = guesses.filter((g) => g.byGuestId === myGuestId).length
  const totalPlayers = turnOrder.length || players.length

  if (phase === 'waiting') {
    return (
      <WaitingLobby
        roomCode={roomCode || code || '…'}
        playerName={me}
        players={players}
        myGuestId={myGuestId}
        isHost={isHost}
        gameMode={gameMode}
        onStartGame={startGame}
        error={error}
      />
    )
  }

  if (phase === 'set_number') {
    return (
      <SetNumber
        numberSet={numberSet}
        onLock={setSecretNumber}
        playersReady={secretsSetCount}
        totalPlayers={totalPlayers}
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
        currentTurnPlayer={currentTurnPlayer}
        myTargetName={gameMode === 'shared' ? null : myTargetName}
        isSharedMode={gameMode === 'shared'}
        guesses={guesses}
        onGuess={makeGuess}
      />
    )
  }

  if (phase === 'game_over' && gameOver) {
    const isDisconnect = gameOver.reason === 'player_disconnected'
    const result = isDisconnect
      ? 'disconnect'
      : gameOver.winnerGuestId === myGuestId
      ? 'win'
      : 'lose'

    // In shared mode everyone sees the same revealed number; no personal "your number" reveal
    const showMyNumber = gameMode === 'standard' && !isDisconnect && gameOver.winnerGuestId !== myGuestId

    return (
      <GameOver
        result={result}
        isSharedMode={gameMode === 'shared'}
        winnerName={gameOver.winnerNickname}
        crackedPlayerName={gameOver.crackedNickname}
        theirNumber={gameOver.secret}
        myNumber={showMyNumber ? mySecret : null}
        totalTurns={gameOver.totalTurns || 0}
        myGuesses={myGuesses}
        totalPlayers={totalPlayers}
        onRematch={rematch}
        onLeave={() => navigate('/')}
      />
    )
  }

  return null
}
