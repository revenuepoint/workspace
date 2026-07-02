# RevenuePoint Workspace

Client-facing case management portal — see your cases, send updates, start new ones.
A Vite + React 19 SPA developed entirely against MSW mocks of the frozen `/v1/client` API contract, deployed to GitHub Pages at `workspace.revenuepoint.com`.

## Quickstart

```bash
npm install
npm run dev        # http://localhost:5173 — MSW mocks on by default
```

Sign in with any email. In mock mode every magic-link token works — after
requesting a link, just visit:

```
http://localhost:5173/login/callback?token=demo
```

Special mock tokens for the error states: `expired-token`, `invalid-token`, `used-token`.

## Scripts

| Script              | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | Dev server with MSW mocks (`.env.development` sets `VITE_USE_MOCKS=true`) |
| `npm run build`     | Typecheck + production build + `404.html` SPA fallback for GH Pages |
| `npm run preview`   | Serve the production build locally                                  |
| `npm run typecheck` | `tsc -b`                                                            |
| `npm run lint`      | ESLint                                                              |
| `npm test`          | Vitest + Testing Library (always MSW — never a live API)            |
| `npm run e2e`       | Playwright journey against `vite preview` + MSW browser mocks. First time: `npx playwright install chromium` |

## Environment

| Variable                                 | Default                 | Notes                                                                  |
| ---------------------------------------- | ----------------------- | ---------------------------------------------------------------------- |
| `VITE_API_BASE_URL`                      | `http://localhost:3000` | API origin. Empty string = same-origin (required for mock/CSP mode).   |
| `VITE_USE_MOCKS`                         | unset (`true` in dev)   | `true` starts the MSW browser worker before render.                    |
| `VITE_DD_APP_ID` / `VITE_DD_CLIENT_TOKEN`| unset                   | Datadog RUM initializes only when **both** are set. Empty in dev.      |
| `VITE_DD_SITE` / `VITE_DD_SERVICE` / `VITE_DD_ENV` | sensible defaults | Optional RUM tuning.                                        |
| `VITE_GA_ID`                             | unset                   | GA4, optional. Enabling it also requires widening the CSP (see below). |

Local overrides go in `.env.local` (gitignored). To point dev at a real API:
`VITE_USE_MOCKS=false` and `VITE_API_BASE_URL=http://localhost:3000`.

## Mock mode

- Handlers implement the frozen contract exactly: `src/mocks/handlers.ts`; typed in `src/lib/api-types.ts`.
- Fixtures: `src/mocks/fixtures.ts` — Acme Corp, 6 open + 4 closed cases, one waiting-on-you, one rich timeline, one empty timeline.
- Unit/component tests always run against `msw/node` (`src/test/setup.ts`).
- e2e builds with `VITE_USE_MOCKS=true VITE_API_BASE_URL=` so `vite preview` serves the real dist (strict CSP included) with the service worker intercepting.

## Deploy

Push to `main` → `.github/workflows/deploy.yml` runs typecheck/lint/test, builds with
`VITE_API_BASE_URL=https://api.revenuepoint.com` and `VITE_USE_MOCKS=false`, and publishes
`dist/` to GitHub Pages (`public/CNAME` pins the custom domain; `404.html` handles SPA deep links).

### CSP

`index.html` ships a strict Content-Security-Policy meta tag (`script-src 'self'`,
`font-src 'self'` — fonts are self-hosted via Fontsource, no CDNs). The dev server strips
the tag (react-refresh needs an inline preamble); builds keep it and the e2e suite runs
against it. Two watch-outs, deliberately left as-is per the charter:

- Datadog: if your org's RUM intake resolves to `browser-intake-datadoghq.com` (not
  `*.datadoghq.com`), add it to `connect-src` before enabling RUM in production.
- GA4: enabling `VITE_GA_ID` requires adding `https://www.googletagmanager.com` to
  `script-src` and `https://*.google-analytics.com` to `connect-src`.
