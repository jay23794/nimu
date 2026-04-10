import React, { useState } from 'react'
import {
  Box,
  VStack,
  HStack,
  Button,
  Text,
} from '@chakra-ui/react'

const rippleKeyframes = `
@keyframes ripple {
  0%   { transform: scale(0.8); opacity: 0.7; }
  100% { transform: scale(2.2); opacity: 0; }
}
`

export default function WaitingLobby({
  roomCode = '…',
  playerName = 'ghost',
  players = [],
  myGuestId = null,
  isHost = false,
  gameMode = 'standard',
  onStartGame,
  error = null,
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const playerCount = players.length
  const canStart = isHost && playerCount >= 2

  return (
    <>
      <style>{rippleKeyframes}</style>
      <Box
        minH="100vh"
        bg="gray.950"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
        py={10}
      >
        <VStack gap={6} w="full" maxW="420px" align="center">
          {/* Pulsing ring */}
          <Box position="relative" w="100px" h="100px" display="flex" alignItems="center" justifyContent="center">
            <Box
              position="absolute"
              inset={0}
              borderRadius="full"
              border="2px solid"
              borderColor="brand.300"
              style={{ animation: 'ripple 2s ease-out infinite' }}
            />
            <Box
              position="absolute"
              inset={0}
              borderRadius="full"
              border="2px solid"
              borderColor="brand.300"
              style={{ animation: 'ripple 2s ease-out infinite', animationDelay: '1s' }}
            />
            <Box
              w="40px"
              h="40px"
              borderRadius="full"
              bg="gray.900"
              border="2px solid"
              borderColor="brand.300"
            />
          </Box>

          {/* Heading */}
          <VStack gap={2} align="center">
            <Text
              fontFamily="'Syne', sans-serif"
              fontWeight="700"
              fontSize="xl"
              color="gray.100"
              letterSpacing="2px"
              textTransform="uppercase"
              textAlign="center"
            >
              Waiting Room
            </Text>
            <Text color="gray.600" fontSize="sm">
              {playerCount}/15 players joined
            </Text>
            {/* Mode badge */}
            <Box
              px={3}
              py={1}
              borderRadius="full"
              bg={gameMode === 'shared' ? 'rgba(200, 240, 96, 0.08)' : 'gray.800'}
              border="1px solid"
              borderColor={gameMode === 'shared' ? 'brand.300' : 'gray.700'}
            >
              <Text
                color={gameMode === 'shared' ? 'brand.300' : 'gray.500'}
                fontSize="10px"
                fontWeight="700"
                letterSpacing="2px"
                textTransform="uppercase"
              >
                {gameMode === 'shared' ? '⚡ Shared Secret' : '↺ Round Robin'}
              </Text>
            </Box>
          </VStack>

          {/* Code card */}
          <Box
            bg="gray.900"
            border="1px solid"
            borderColor="gray.800"
            borderRadius="xl"
            p={5}
            w="full"
          >
            <VStack gap={3} align="center">
              <Text
                color="gray.500"
                fontSize="11px"
                fontWeight="700"
                letterSpacing="2px"
                textTransform="uppercase"
              >
                Share This Code
              </Text>
              <Text
                fontFamily="mono"
                fontSize="30px"
                fontWeight="700"
                letterSpacing="10px"
                color="brand.300"
              >
                {roomCode}
              </Text>
              <Text
                as="button"
                color={copied ? 'brand.300' : 'gray.400'}
                fontSize="sm"
                fontWeight="700"
                letterSpacing="1px"
                cursor="pointer"
                _hover={{ color: 'brand.300' }}
                onClick={handleCopy}
                bg="transparent"
                border="none"
              >
                {copied ? '✓ COPIED' : 'COPY CODE'}
              </Text>
            </VStack>
          </Box>

          {/* Player list */}
          <Box w="full">
            <Text
              color="gray.600"
              fontSize="11px"
              fontWeight="700"
              letterSpacing="2px"
              textTransform="uppercase"
              mb={2}
            >
              Players
            </Text>
            <VStack gap={2} align="stretch">
              {players.map((p) => (
                <HStack
                  key={p.guestId}
                  bg="gray.900"
                  border="1px solid"
                  borderColor={p.guestId === myGuestId ? 'brand.300' : 'gray.700'}
                  borderRadius="lg"
                  p={3}
                  gap={3}
                >
                  <Box
                    w="8px"
                    h="8px"
                    borderRadius="full"
                    bg="brand.300"
                    flexShrink={0}
                  />
                  <Text
                    color={p.guestId === myGuestId ? 'brand.300' : 'gray.100'}
                    fontWeight="700"
                    fontSize="sm"
                    letterSpacing="1px"
                    flex={1}
                  >
                    {p.nickname}
                  </Text>
                  {p.isHost && (
                    <Text color="gray.600" fontSize="10px" fontWeight="700" letterSpacing="1px">
                      HOST
                    </Text>
                  )}
                  {p.guestId === myGuestId && !p.isHost && (
                    <Text color="gray.600" fontSize="10px" fontWeight="700" letterSpacing="1px">
                      YOU
                    </Text>
                  )}
                </HStack>
              ))}

              {/* Empty slots indicator */}
              {playerCount < 15 && (
                <HStack
                  bg="transparent"
                  border="1px dashed"
                  borderColor="gray.800"
                  borderRadius="lg"
                  p={3}
                  gap={3}
                >
                  <Box
                    w="8px"
                    h="8px"
                    borderRadius="full"
                    border="1px solid"
                    borderColor="gray.700"
                    flexShrink={0}
                  />
                  <Text color="gray.700" fontWeight="700" fontSize="sm" letterSpacing="1px">
                    waiting for players…
                  </Text>
                </HStack>
              )}
            </VStack>
          </Box>

          {/* Start Game button (host only) */}
          {isHost && (
            <Box w="full">
              <Button
                w="full"
                bg={canStart ? 'brand.300' : 'gray.800'}
                color={canStart ? 'gray.950' : 'gray.600'}
                fontWeight="700"
                letterSpacing="1px"
                _hover={canStart ? { bg: 'brand.400' } : {}}
                borderRadius="lg"
                disabled={!canStart}
                onClick={onStartGame}
              >
                {canStart ? '▶ START GAME' : `Need at least 2 players`}
              </Button>
              {canStart && (
                <Text color="gray.600" fontSize="11px" textAlign="center" mt={2}>
                  {playerCount} player{playerCount !== 1 ? 's' : ''} will play
                </Text>
              )}
            </Box>
          )}

          {!isHost && (
            <Text color="gray.600" fontSize="sm" textAlign="center">
              Waiting for host to start the game…
            </Text>
          )}

          {error && (
            <Text color="red.400" fontSize="sm" fontWeight="700" textAlign="center">
              {error}
            </Text>
          )}
        </VStack>
      </Box>
    </>
  )
}
