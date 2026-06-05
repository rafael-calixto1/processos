import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Processo Audit',
        short_name: 'AuditApp',
        description: 'Sistema de Gerenciamento e Auditoria de Processos',
        theme_color: '#007bff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 3004,
    host: '0.0.0.0',
    https: {
      key: fs.readFileSync(path.resolve('../certs/key.pem')),
      cert: fs.readFileSync(path.resolve('../certs/cert.pem')),
    },
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
