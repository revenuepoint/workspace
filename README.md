# RevenuePoint Workspace

Client-facing case management portal — see your cases, send updates, start new ones.
A Vite + React 19 SPA developed entirely against MSW mocks of the frozen `/v1/client` API contract, served in production by the Heroku api app at `workspace.revenuepoint.com`.

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
| `npm run build`     | Typecheck + production build (`dist/`)                              |
| `npm run preview`   | Serve the production build locally                                  |
| `npm run typecheck` | `tsc -b`                                                            |
| `npm run lint`      | ESLint                                                              |
| `npm test`          | Vitest + Testing Library (always MSW — never a live API)            |
| `npm run e2e`       | Playwright journey against `vite preview` + MSW browser mocks. First time: `npx playwright install chromium` |

## Environment

| Variable                                 | Default                 | Notes                                                                  |
| ---------------------------------------- | ----------------------- | ---------------------------------------------------------------------- |
| `VITE_API_BASE_URL`                      | `''` (same-origin)      | API origin. Same-origin is correct in prod (the api app serves the SPA); point at `http://localhost:3000` to hit a local API. |
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

Production is the Heroku api app (`revenuepoint-api`), which serves this SPA from its
`spa-dist/` directory alongside `/v1/*` — `workspace.revenuepoint.com` points there, so
API calls are same-origin. Push to `main` → `.github/workflows/ci.yml`:

1. **verify** — typecheck, lint, unit tests, then the Playwright journey against a
   production build (strict CSP included), then the real build with
   `VITE_API_BASE_URL=''` (same-origin) and `VITE_USE_MOCKS=false`.
2. **publish** — commits the fresh `dist/` into `revenuepoint/api:spa-dist/`
   (needs the `API_REPO_TOKEN` secret); the api repo's CI deploys to Heroku.

GitHub Pages hosting is retired (it hosted the launch until the 2026-07-02 Pages
incident; `CNAME`/`.nojekyll`/`404.html` are gone with it).

### CSP & security headers

`index.html` ships a strict Content-Security-Policy meta tag (`script-src 'self'`,
`font-src 'self'` — fonts are self-hosted via Fontsource, no CDNs). The dev server strips
the tag (react-refresh needs an inline preamble); builds keep it and the e2e suite runs
against it. The api app sends the same policy as a real header, plus what a meta tag
can't carry: `frame-ancestors 'none'` and HSTS.

- Datadog: `connect-src` includes `https://browser-intake-datadoghq.com`, the RUM SDK's
  default US1 intake, alongside `*.datadoghq.com`.
- GA4: enabling `VITE_GA_ID` requires adding `https://www.googletagmanager.com` to
  `script-src` and `https://*.google-analytics.com` to `connect-src`.

### Accepted session-security tradeoffs

The session JWT lives in `localStorage` (an XSS could read it) — accepted for the
magic-link/bearer contract because the CSP allows no third-party script and every
dependency is bundled; revisit if the CSP ever loosens. Datadog RUM identifies users by
email (no opaque contact id exists in the auth contract) with session replay masking
user input.
