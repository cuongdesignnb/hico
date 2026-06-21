import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dynamically target the HICO Backend server (useful in Docker environment)
const backendTarget = process.env.VITE_BACKEND_URL || 'http://localhost:5000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Necessary for Docker container port mapping
    port: 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
        secure: false
      }
    }
  }
})

