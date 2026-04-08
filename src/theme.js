import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const customConfig = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          300: { value: '#c8f060' },
          400: { value: '#b0d94e' },
        },
      },
      fonts: {
        syne: { value: "'Syne', sans-serif" },
        mono: { value: "'Space Mono', monospace" },
      },
    },
    semanticTokens: {
      colors: {
        bg: { value: '{colors.gray.950}' },
        surface: { value: '{colors.gray.900}' },
        muted: { value: '{colors.gray.800}' },
        accent: { value: '{colors.brand.300}' },
        'accent.hover': { value: '{colors.brand.400}' },
      },
    },
  },
})

export const system = createSystem(defaultConfig, customConfig)
