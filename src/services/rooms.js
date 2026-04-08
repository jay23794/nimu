async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

export const roomsApi = {
  create: ({ guestId, nickname }) =>
    post('/api/rooms/create', { guestId, nickname }),

  join: ({ code, guestId, nickname }) =>
    post('/api/rooms/join', { code, guestId, nickname }),

  random: ({ guestId, nickname }) =>
    post('/api/rooms/random', { guestId, nickname }),
}
