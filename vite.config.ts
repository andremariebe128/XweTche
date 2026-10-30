import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En développement, /api est renvoyé vers le serveur d'API local (npm run api:dev).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3001' } },
})
