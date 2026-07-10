import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    env: {
      // Node's fetch rejects relative URLs, so tests need an absolute API
      // base for MSW to intercept (the app default is same-origin '').
      VITE_API_BASE_URL: 'http://localhost:3000',
    },
  },
})
