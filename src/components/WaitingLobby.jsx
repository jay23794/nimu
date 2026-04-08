import React, { useState } from 'react'
import {
  Box,
  VStack,
  HStack,
  Text,
} from '@chakra-ui/react'

const rippleKeyframes = `
@keyframes ripple {
  0%   { transform: scale(0.8); opacity: 0.7; }
  100% { transform: scale(2.2); opacity: 0; }
}
`

export default function WaitingLobby({ roomCode = '…', playerName = 'ghost', opponentName = null, error = null }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const opponentJoined = !!opponentName

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
        <VStack gap={8} w="full" maxW="380px" align="center">
          {/* Pulsing ring */}
          <Box position="relative" w="120px" h="120px" display="flex" alignItems="center" justifyContent="center">
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
              w="48px"
              h="48px"
              borderRadius="full"
              bg="gray.900"
              border="2px solid"
              borderColor="brand.300"
            />
          </Box>

          {/* Heading */}
          <Text
            fontFamily="'Syne', sans-serif"
            fontWeight="700"
            fontSize="xl"
            color="gray.100"
            letterSpacing="2px"
            textTransform="uppercase"
            textAlign="center"
          >
            {opponentJoined ? 'Opponent Joined!' : 'Waiting for Opponent'}
          </Text>

          {/* Code card */}
          <Box
            bg="gray.900"
            border="1px solid"
            borderColor="gray.800"
            borderRadius="xl"
            p={6}
            w="full"
          >
            <VStack gap={4} align="center">
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
                fontSize="32px"
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

          {/* Player slots */}
          <VStack gap={3} w="full" align="stretch">
            <HStack
              bg="gray.900"
              border="1px solid"
              borderColor="gray.700"
              borderRadius="lg"
              p={4}
              gap={3}
            >
              <Box w="8px" h="8px" borderRadius="full" bg="brand.300" flexShrink={0} />
              <Text color="gray.100" fontWeight="700" fontSize="sm" letterSpacing="1px">
                {playerName}
              </Text>
              <Text color="gray.600" fontSize="11px" ml="auto">YOU</Text>
            </HStack>

            <HStack
              bg={opponentJoined ? 'gray.900' : 'transparent'}
              border="1px dashed"
              borderColor={opponentJoined ? 'gray.700' : 'gray.800'}
              borderRadius="lg"
              p={4}
              gap={3}
            >
              <Box
                w="8px"
                h="8px"
                borderRadius="full"
                bg={opponentJoined ? 'brand.300' : 'transparent'}
                border={opponentJoined ? 'none' : '1px solid'}
                borderColor="gray.600"
                flexShrink={0}
              />
              <Text
                color={opponentJoined ? 'gray.100' : 'gray.700'}
                fontWeight="700"
                fontSize="sm"
                letterSpacing="1px"
              >
                {opponentJoined ? opponentName : 'waiting…'}
              </Text>
            </HStack>
          </VStack>

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
