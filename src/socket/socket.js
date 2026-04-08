import { io } from 'socket.io-client'

let socket = null

export function initSocket(guestId, nickname) {
  if (socket) socket.disconnect()
  socket = io({ auth: { guestId, nickname }, autoConnect: true })
  return socket
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
