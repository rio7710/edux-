import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/sse': {
        target: 'http://localhost:7777',
        changeOrigin: true,
      },
      '/messages': {
        target: 'http://localhost:7777',
        changeOrigin: true,
      },
      '/pdf': {
        target: 'http://localhost:7777',
        changeOrigin: true,
      },
    },
  },
})
