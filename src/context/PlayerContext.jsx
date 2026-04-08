import React, { createContext, useContext, useState } from 'react'
import { nanoid } from './nanoid'

const PlayerContext = createContext(null)

const STORAGE_KEY = 'nimu_player'

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(() => loadStored())

  function register(nickname) {
    const p = { id: nanoid(), nickname: nickname.trim() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    setPlayer(p)
    return p
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY)
    setPlayer(null)
  }

  return (
    <PlayerContext.Provider value={{ player, register, clear }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider')
  return ctx
}
