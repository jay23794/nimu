import React, { useEffect, useRef, useState } from 'react'
import {
  Box,
  VStack,
  HStack,
  Button,
  Text,
  Input,
} from '@chakra-ui/react'

const slideInKeyframes = `
@keyframes slideIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
`

function badgeColor(n) {
  if (n === 4) return 'brand.300'
  if (n >= 2) return '#f0b840'
  if (n === 1) return '#a0aec0'  // gray.400 — visible but muted
  return '#fc8181'               // red.300 — 0 correct, clearly wrong
}

// guess shape: { byGuestId, byNickname, targetNickname, guess, correctDigits, turnNumber }
function GuessRow({ guess, index, isMe, hideTarget = false }) {
  return (
    <HStack
      bg={isMe ? 'rgba(200, 240, 96, 0.08)' : 'gray.800'}
      border="1px solid"
      borderColor={isMe ? 'brand.300' : 'gray.700'}
      borderRadius="md"
      px={3}
      py={2}
      gap={3}
      style={{ animation: 'slideIn 0.25s ease forwards' }}
    >
      <Text color="gray.600" fontSize="11px" w="24px" flexShrink={0}>
        #{index + 1}
      </Text>
      <VStack gap={0} flex={1} align="start">
        <Text color="gray.500" fontSize="sm">
          {guess.byNickname}
        </Text>
        {!hideTarget && guess.targetNickname && (
          <Text color="gray.700" fontSize="10px">
            → {guess.targetNickname}
          </Text>
        )}
      </VStack>
      <Text
        fontFamily="mono"
        fontSize="15px"
        fontWeight="700"
        letterSpacing="3px"
        color="gray.100"
      >
        {guess.guess}
      </Text>
      <Box
        px={2}
        py={0.5}
        borderRadius="md"
        bg="gray.900"
        border="1px solid"
        borderColor={badgeColor(guess.correctDigits)}
        minW="36px"
        textAlign="center"
      >
        <Text
          color={badgeColor(guess.correctDigits)}
          fontSize="11px"
          fontWeight="700"
          fontFamily="mono"
        >
          {guess.correctDigits}/4
        </Text>
      </Box>
    </HStack>
  )
}

export default function GameBoard({
  isMyTurn = true,
  myName = 'ghost',
  myGuestId = null,
  mySecret = null,
  currentTurnPlayer = null,
  myTargetName = null,
  isSharedMode = false,
  guesses = [],
  onGuess,
}) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const refs = [useRef(), useRef(), useRef(), useRef()]
  const logRef = useRef()

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [guesses])

  // round-robin auto-focus commented out
  // useEffect(() => {
  //   if (isMyTurn) {
  //     setTimeout(() => refs[0].current?.focus(), 50)
  //   }
  // }, [isMyTurn])

  const handleChange = (i, val) => {
    const ch = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = ch
    setDigits(next)
    if (ch && i < 3) refs[i + 1].current?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs[i - 1].current?.focus()
    }
  }

  const allFilled = digits.every(d => d !== '')

  const handleGuess = () => {
    if (!allFilled) return
    onGuess?.(digits.join(''))
    setDigits(['', '', '', ''])
    refs[0].current?.focus()
  }

  const activePlayerName = isMyTurn ? myName : (currentTurnPlayer?.nickname || '…')

  return (
    <>
      <style>{slideInKeyframes}</style>
      <Box
        minH="100vh"
        bg="gray.950"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px={4}
        py={10}
      >
        <VStack gap={4} w="full" maxW="480px" align="stretch">
          {/* Turn banner — commented out (round-robin UI hidden)
          <Box
            bg={isMyTurn ? 'rgba(200, 240, 96, 0.08)' : 'gray.900'}
            border="1px solid"
            borderColor={isMyTurn ? 'brand.300' : 'gray.800'}
            borderRadius="lg"
            px={4}
            py={3}
            textAlign="center"
          >
            <Text
              color={isMyTurn ? 'brand.300' : 'gray.500'}
              fontWeight="700"
              fontSize="sm"
              letterSpacing="2px"
              textTransform="uppercase"
            >
              {isMyTurn
                ? isSharedMode
                  ? '⚡ Your Turn — Guess the secret!'
                  : `⚡ Your Turn — Guessing ${myTargetName || '…'}'s number`
                : `${activePlayerName}'s Turn…`}
            </Text>
          </Box>
          */}

          {/* My secret number */}
          {mySecret && (
            <HStack
              bg="gray.900"
              border="1px solid"
              borderColor="gray.800"
              borderRadius="lg"
              px={4}
              py={2}
              justify="space-between"
              align="center"
            >
              <Text color="gray.600" fontSize="11px" fontWeight="700" letterSpacing="2px" textTransform="uppercase">
                Your Number
              </Text>
              <Text fontFamily="mono" fontSize="18px" fontWeight="700" letterSpacing="8px" color="gray.400">
                {mySecret}
              </Text>
            </HStack>
          )}

          {/* Guess log */}
          <Box
            ref={logRef}
            bg="gray.900"
            border="1px solid"
            borderColor="gray.800"
            borderRadius="xl"
            p={4}
            minH="220px"
            maxH="300px"
            overflowY="auto"
          >
            {guesses.length === 0 ? (
              <Text color="gray.700" fontSize="sm" textAlign="center" mt={8}>
                No guesses yet. Make your move!
              </Text>
            ) : (
              <VStack gap={2} align="stretch">
                {guesses.map((g, i) => (
                  <GuessRow
                    key={i}
                    guess={g}
                    index={i}
                    isMe={myGuestId ? g.byGuestId === myGuestId : g.byNickname === myName}
                    hideTarget={isSharedMode}
                  />
                ))}
              </VStack>
            )}
          </Box>

          {/* Guess input */}
          <Box
            bg="gray.900"
            border="1px solid"
            borderColor={isMyTurn ? 'gray.800' : 'gray.900'}
            borderRadius="xl"
            p={5}
            opacity={isMyTurn ? 1 : 0.4}
          >
            <VStack gap={4} align="stretch">
              <Text
                color={isMyTurn ? 'gray.500' : 'gray.700'}
                fontSize="11px"
                fontWeight="700"
                letterSpacing="2px"
                textTransform="uppercase"
                textAlign="center"
              >
                {isMyTurn ? 'Your Guess' : `Waiting for ${currentTurnPlayer?.nickname ?? '…'}`}
              </Text>
              <HStack justify="center" gap={3}>
                {digits.map((d, i) => (
                  <Input
                    key={i}
                    ref={refs[i]}
                    value={d}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    maxLength={1}
                    inputMode="numeric"
                    w="58px"
                    h="68px"
                    bg="gray.800"
                    border="2px solid"
                    borderColor={d ? 'brand.300' : 'gray.700'}
                    _focus={{ borderColor: 'brand.300', boxShadow: 'none' }}
                    borderRadius="xl"
                    color="brand.300"
                    fontSize="2xl"
                    fontWeight="700"
                    textAlign="center"
                    _placeholder={{ color: 'gray.700' }}
                    disabled={!isMyTurn}
                  />
                ))}
              </HStack>
              <Button
                bg={allFilled && isMyTurn ? 'brand.300' : 'gray.800'}
                color={allFilled && isMyTurn ? 'gray.950' : 'gray.600'}
                fontWeight="700"
                letterSpacing="1px"
                w="full"
                _hover={allFilled && isMyTurn ? { bg: 'brand.400' } : {}}
                borderRadius="lg"
                disabled={!allFilled || !isMyTurn}
                onClick={handleGuess}
              >
                GUESS →
              </Button>
            </VStack>
          </Box>
        </VStack>
      </Box>
    </>
  )
}
