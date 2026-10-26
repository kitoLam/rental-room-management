import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Cho phép truy cập dev server qua tên miền ngrok (dấu chấm đầu = mọi subdomain)
    allowedHosts: ['.ngrok-free.app'],
    proxy: {
      '/api': {
        target:
          loadEnv(mode, process.cwd(), '').VITE_BACKEND_PROXY_TARGET || 'https://44d1-118-69-182-149.ngrok-free.app', //'http://localhost:8080',
        changeOrigin: true,
        // Bỏ qua trang cảnh báo của ngrok free (ERR_NGROK_6024) khi target là URL ngrok
        headers: { 'ngrok-skip-browser-warning': 'true' },
      },
    },
  },
}))
