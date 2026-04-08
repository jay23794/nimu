import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter } from 'react-router-dom'
import { system } from './theme'
import { PlayerProvider } from './context/PlayerContext'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ChakraProvider value={system}>
    <BrowserRouter>
      <PlayerProvider>
        <App />
      </PlayerProvider>
    </BrowserRouter>
  </ChakraProvider>
)
