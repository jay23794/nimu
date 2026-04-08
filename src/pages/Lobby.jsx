import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  Separator,
} from '@chakra-ui/react'
import { usePlayer } from '../context/PlayerContext'
import { initSocket } from '../socket/socket'
import { roomsApi } from '../services/rooms'

export default function Lobby() {
  const navigate = useNavigate()
  const { player, register } = usePlayer()
  const [handle, setHandle] = useState(player?.nickname || '')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(null) // 'create' | 'random' | 'join' | null
  const [error, setError] = useState(null)

  function ensurePlayer() {
    const trimmed = handle.trim()
    if (!trimmed) return null
    // If the typed name matches what's stored, reuse — otherwise re-register
    if (player?.nickname === trimmed) return player
    return register(trimmed)
  }

  async function call(apiFn, action) {
    const p = ensurePlayer()
    if (!p) return
    setLoading(action)
    setError(null)
    try {
      const { code } = await apiFn(p)
      initSocket(p.id, p.nickname)
      navigate(`/room/${code}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  const handleCreate = () =>
    call((p) => roomsApi.create({ guestId: p.id, nickname: p.nickname }), 'create')

  const handleRandom = () =>
    call((p) => roomsApi.random({ guestId: p.id, nickname: p.nickname }), 'random')

  const handleJoin = () => {
    if (!joinCode.trim()) return
    call(
      (p) => roomsApi.join({ code: joinCode.trim().toUpperCase(), guestId: p.id, nickname: p.nickname }),
      'join'
    )
  }

  const hasHandle = !!handle.trim()
  const isAnyLoading = loading !== null

  return (
    <Box
      minH="100vh"
      bg="gray.950"
      backgroundImage="repeating-linear-gradient(0deg, transparent, transparent 35px, rgba(255,255,255,0.04) 35px, rgba(255,255,255,0.04) 36px), repeating-linear-gradient(90deg, transparent, transparent 35px, rgba(255,255,255,0.04) 35px, rgba(255,255,255,0.04) 36px)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={4}
      py={10}
    >
      <VStack gap={6} w="full" maxW="380px" align="stretch">
        {/* Logo */}
        <VStack gap={1} align="center">
          <Text
            fontFamily="'Syne', sans-serif"
            fontSize="64px"
            fontWeight="800"
            color="brand.300"
            lineHeight="1"
            letterSpacing="-2px"
          >
            NIMU
          </Text>
          <Text color="gray.500" fontSize="sm" letterSpacing="4px" textTransform="uppercase">
            Number Minds
          </Text>
        </VStack>

        {/* Card */}
        <Box
          bg="gray.900"
          border="1px solid"
          borderColor="gray.800"
          borderRadius="xl"
          p={6}
        >
          <VStack gap={5} align="stretch">
            {/* Handle */}
            <VStack gap={2} align="stretch">
              <Text
                color="gray.500"
                fontSize="11px"
                fontWeight="700"
                letterSpacing="2px"
                textTransform="uppercase"
              >
                Your Handle
              </Text>
              <Input
                placeholder="enter nickname"
                value={handle}
                onChange={e => setHandle(e.target.value)}
                bg="gray.800"
                border="1px solid"
                borderColor="gray.700"
                color="gray.100"
                _placeholder={{ color: 'gray.600' }}
                _focus={{ borderColor: 'brand.300', boxShadow: 'none' }}
                borderRadius="lg"
                disabled={isAnyLoading}
              />
            </VStack>

            <HStack gap={3}>
              <Separator flex={1} borderColor="gray.800" />
              <Text color="gray.600" fontSize="11px" fontWeight="700" letterSpacing="3px">
                PLAY
              </Text>
              <Separator flex={1} borderColor="gray.800" />
            </HStack>

            {/* Create Room */}
            <Button
              w="full"
              bg="brand.300"
              color="gray.950"
              fontWeight="700"
              letterSpacing="1px"
              _hover={{ bg: 'brand.400' }}
              borderRadius="lg"
              disabled={!hasHandle || isAnyLoading}
              loading={loading === 'create'}
              onClick={handleCreate}
            >
              ＋ CREATE ROOM
            </Button>

            {/* Quick Match */}
            <Button
              w="full"
              variant="outline"
              borderColor="gray.700"
              color="gray.400"
              fontWeight="700"
              letterSpacing="1px"
              _hover={{ bg: 'gray.800', borderColor: 'gray.600' }}
              borderRadius="lg"
              disabled={!hasHandle || isAnyLoading}
              loading={loading === 'random'}
              onClick={handleRandom}
            >
              ⚡ QUICK MATCH
            </Button>

            {/* Join Room */}
            <HStack gap={2}>
              <Input
                flex={1}
                placeholder="ROOM CODE"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                bg="gray.800"
                border="1px solid"
                borderColor="gray.700"
                color="brand.300"
                _placeholder={{ color: 'gray.700' }}
                _focus={{ borderColor: 'brand.300', boxShadow: 'none' }}
                letterSpacing="4px"
                fontWeight="700"
                fontFamily="mono"
                borderRadius="lg"
                textTransform="uppercase"
                disabled={isAnyLoading}
              />
              <Button
                bg="brand.300"
                color="gray.950"
                fontWeight="700"
                px={5}
                _hover={{ bg: 'brand.400' }}
                borderRadius="lg"
                disabled={!hasHandle || !joinCode.trim() || isAnyLoading}
                loading={loading === 'join'}
                onClick={handleJoin}
              >
                JOIN →
              </Button>
            </HStack>

            {/* Error */}
            {error && (
              <Text color="red.400" fontSize="sm" fontWeight="600" textAlign="center">
                {error}
              </Text>
            )}
          </VStack>
        </Box>

        {/* How to play */}
        <VStack gap={1} align="center">
          <Text color="gray.600" fontSize="12px">Each player picks a secret 4-digit number.</Text>
          <Text color="gray.600" fontSize="12px">Take turns guessing — see how many digits match.</Text>
          <Text color="gray.600" fontSize="12px">First to crack the code wins.</Text>
        </VStack>
      </VStack>
    </Box>
  )
}
