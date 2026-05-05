import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3004,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        xfwd: true,
      },
      '/uploads': {
        target: 'http://localhost:5002',
        changeOrigin: true,
      }
    }
  }
})
