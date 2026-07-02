import { defineConfig, devices } from '@playwright/test'

// e2e runs against `vite preview` serving a PRODUCTION build with the MSW
// browser worker enabled (VITE_USE_MOCKS=true, same-origin API). That means
// the journey exercises the real dist output — including the strict CSP meta
// tag — not the dev server.
const PORT = 4373
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run e2e:build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
