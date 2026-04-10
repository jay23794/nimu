import React from 'react'
import {
  Box,
  VStack,
  HStack,
  Button,
  Text,
} from '@chakra-ui/react'

export default function GameOver({
  result = 'win',
  isSharedMode = false,
  winnerName = null,
  crackedPlayerName = null,
  theirNumber,
  myNumber,
  totalTurns = 0,
  myGuesses = 0,
  totalPlayers = 2,
  onRematch,
  onLeave,
}) {
  const isWin = result === 'win'
  const isDisconnect = result === 'disconnect'

  const emoji = isDisconnect ? '🔌' : isWin ? '🏆' : '💀'
  const headingColor = isWin ? 'brand.300' : isDisconnect ? 'gray.400' : 'red.400'
  const heading = isDisconnect
    ? 'PLAYER LEFT'
    : isWin
    ? 'YOU CRACKED IT'
    : isSharedMode
    ? `${winnerName || 'SOMEONE'} CRACKED IT`
    : `${winnerName || 'SOMEONE'} WINS`

  const numberColor = isWin ? 'brand.300' : 'red.400'

  return (
    <Box
      minH="100vh"
      bg="gray.950"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={4}
      py={10}
    >
      <VStack gap={6} w="full" maxW="380px" align="center">
        <VStack gap={3} align="center">
          <Text fontSize="48px" lineHeight="1">{emoji}</Text>
          <Text
            fontFamily="'Syne', sans-serif"
            fontWeight="800"
            fontSize="26px"
            color={headingColor}
            letterSpacing="2px"
            textTransform="uppercase"
            textAlign="center"
          >
            {heading}
          </Text>
          {!isWin && !isDisconnect && !isSharedMode && crackedPlayerName && (
            <Text color="gray.500" fontSize="sm">
              {winnerName} cracked {crackedPlayerName}'s number
            </Text>
          )}
        </VStack>

        <VStack gap={3} w="full" align="stretch">
          {theirNumber && (
            <Box
              bg="gray.900"
              border="1px solid"
              borderColor="gray.800"
              borderRadius="xl"
              p={5}
              textAlign="center"
            >
              <Text
                color="gray.500"
                fontSize="11px"
                fontWeight="700"
                letterSpacing="2px"
                textTransform="uppercase"
                mb={3}
              >
                {isSharedMode
                  ? 'The Secret Number Was'
                  : isWin
                  ? 'The Number Was'
                  : `${crackedPlayerName || 'Their'}'s Number`}
              </Text>
              <Text
                fontFamily="mono"
                fontSize="36px"
                fontWeight="700"
                letterSpacing="10px"
                color={numberColor}
              >
                {theirNumber}
              </Text>
            </Box>
          )}

          {myNumber && (
            <Box
              bg="gray.900"
              border="1px solid"
              borderColor="gray.800"
              borderRadius="xl"
              p={5}
              textAlign="center"
            >
              <Text
                color="gray.500"
                fontSize="11px"
                fontWeight="700"
                letterSpacing="2px"
                textTransform="uppercase"
                mb={3}
              >
                Your Number Was
              </Text>
              <Text
                fontFamily="mono"
                fontSize="36px"
                fontWeight="700"
                letterSpacing="10px"
                color="gray.400"
              >
                {myNumber}
              </Text>
            </Box>
          )}
        </VStack>

        <HStack
          w="full"
          bg="gray.900"
          border="1px solid"
          borderColor="gray.800"
          borderRadius="xl"
          divide="1px solid"
          divideColor="gray.800"
          overflow="hidden"
        >
          {[
            { label: 'TOTAL TURNS', value: totalTurns },
            { label: 'YOUR GUESSES', value: myGuesses },
            { label: 'PLAYERS', value: totalPlayers },
          ].map(({ label, value }) => (
            <VStack key={label} flex={1} gap={1} py={4} px={2} align="center">
              <Text fontFamily="mono" fontSize="22px" fontWeight="700" color="gray.100">
                {value}
              </Text>
              <Text
                color="gray.600"
                fontSize="9px"
                fontWeight="700"
                letterSpacing="1px"
                textTransform="uppercase"
                textAlign="center"
              >
                {label}
              </Text>
            </VStack>
          ))}
        </HStack>

        <VStack gap={3} w="full" align="stretch">
          <Button
            w="full"
            bg="brand.300"
            color="gray.950"
            fontWeight="700"
            letterSpacing="1px"
            _hover={{ bg: 'brand.400' }}
            borderRadius="lg"
            onClick={onRematch}
          >
            ↺ REMATCH
          </Button>
          <Button
            w="full"
            variant="outline"
            borderColor="gray.700"
            color="gray.400"
            fontWeight="700"
            letterSpacing="1px"
            _hover={{ bg: 'gray.800', borderColor: 'gray.600' }}
            borderRadius="lg"
            onClick={onLeave}
          >
            BACK TO LOBBY
          </Button>
        </VStack>
      </VStack>
    </Box>
  )
}
