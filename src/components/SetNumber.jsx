import React, { useRef, useState } from 'react'
import {
  Box,
  VStack,
  HStack,
  Button,
  Text,
  Input,
} from '@chakra-ui/react'

export default function SetNumber({ numberSet = false, onLock }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const refs = [useRef(), useRef(), useRef(), useRef()]

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

  const handleLock = () => {
    if (!allFilled) return
    onLock?.(digits.join(''))
  }

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
      <VStack gap={8} w="full" maxW="380px" align="center">
        <VStack gap={2} align="center">
          <Text
            fontFamily="'Syne', sans-serif"
            fontWeight="700"
            fontSize="2xl"
            color="gray.100"
            letterSpacing="2px"
            textTransform="uppercase"
          >
            Pick Your Number
          </Text>
          <Text color="gray.500" fontSize="sm" textAlign="center">
            Choose a secret 4-digit number. Your opponent will try to crack it.
          </Text>
        </VStack>

        {!numberSet ? (
          <VStack gap={6} w="full" align="center">
            <HStack gap={3} justify="center">
              {digits.map((d, i) => (
                <Input
                  key={i}
                  ref={refs[i]}
                  value={d}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  maxLength={1}
                  inputMode="numeric"
                  w="62px"
                  h="76px"
                  bg="gray.900"
                  border="2px solid"
                  borderColor={d ? 'brand.300' : 'gray.700'}
                  _focus={{ borderColor: 'brand.300', boxShadow: 'none' }}
                  borderRadius="xl"
                  color="brand.300"
                  fontSize="2xl"
                  fontWeight="700"
                  textAlign="center"
                  _placeholder={{ color: 'gray.700' }}
                  autoFocus={i === 0}
                />
              ))}
            </HStack>

            <Button
              w="full"
              bg={allFilled ? 'brand.300' : 'gray.800'}
              color={allFilled ? 'gray.950' : 'gray.600'}
              fontWeight="700"
              letterSpacing="1px"
              _hover={allFilled ? { bg: 'brand.400' } : {}}
              borderRadius="lg"
              disabled={!allFilled}
              onClick={handleLock}
            >
              LOCK IT IN →
            </Button>
          </VStack>
        ) : (
          <VStack gap={4} w="full" align="center">
            <HStack
              bg="rgba(200, 240, 96, 0.08)"
              border="1px solid"
              borderColor="brand.300"
              borderRadius="lg"
              px={6}
              py={4}
              gap={3}
            >
              <Text color="brand.300" fontWeight="700" fontSize="lg">✓ NUMBER LOCKED</Text>
            </HStack>
            <Text color="gray.500" fontSize="sm">Waiting for opponent…</Text>
          </VStack>
        )}
      </VStack>
    </Box>
  )
}
