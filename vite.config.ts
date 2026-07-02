import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/**
 * index.html carries the production CSP meta tag (charter-locked). In dev,
 * @vitejs/plugin-react injects an inline react-refresh preamble that
 * `script-src 'self'` would block, so we strip the tag from the dev server
 * only. `vite build` / `vite preview` keep the CSP intact — the e2e journey
 * runs against preview to prove the app works under it.
 */
function stripCspInDev(): Plugin {
  return {
    name: 'rp-strip-csp-in-dev',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(
        /<meta[^>]*http-equiv="Content-Security-Policy"[\s\S]*?\/>/,
        '<!-- CSP removed by dev server (react-refresh inline preamble); production builds keep it -->',
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stripCspInDev()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
