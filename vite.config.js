import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // tailwindcss(): ENDAST för Tremor-diagramkomponenterna (src/components/
  // tremor/) — appens ~100 övriga komponenter är handstylade med inline
  // style-objekt och egna CSS-variabler (index.css) sedan tidigare, det
  // rörs inte. Tailwinds "preflight"-reset (som annars nollställer
  // marginaler/kantlinjer/rubrikstilar GLOBALT) är medvetet AVSTÄNGD, se
  // src/tremor.css — utan det skulle hela resten av appen kunna se
  // annorlunda ut efter den här installationen.
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
})
