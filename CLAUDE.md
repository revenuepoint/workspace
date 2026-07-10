# RevenuePoint Workspace — conventions

Client-facing case portal. Vite + React 19 + TS strict + Tailwind 4 + react-router v7 +
TanStack Query v5 + zustand + MSW v2. Node 22.

## Hard rules

- **Brand tokens only.** Every color comes from the `@theme` tokens in `src/index.css`
  (crimson, navy, ink, snow, paper, rule, amber, rust, …). No ad-hoc hex, no Tailwind
  default palette colors. **Never green** — positive/on-track signals use navy; amber is
  reserved for "waiting on you"; rust for errors.
- **Status mapping has one source:** `src/lib/status.ts`. Never map raw statuses or pick
  chip colors anywhere else.
- **`src/lib/api.ts` is the only fetch path.** It attaches the bearer token, captures
  `X-Session-Refresh`, and owns the 401 → session-expired flow. No stray `fetch()`.
- **The API contract is frozen** (`src/lib/api-types.ts` + `src/mocks/handlers.ts`).
  Don't reshape responses client-side; don't invent endpoints.
- **Typography:** Geist for all product UI (headings included), JetBrains Mono for case
  numbers/timestamps/status chips/micro-labels (tabular nums), Fraunces ONLY for the
  wordmark and the /login hero. Fonts are self-hosted (CSP `font-src 'self'`).
- **Buttons are bordered crimson** — never solid-fill. Labels Geist 600, verb-first
  (never "Submit"/"Learn more"). Banned words: "seamless", "leverage", "transform",
  "real-time" (say "live").
- **a11y:** every interactive element keyboard-reachable and a real `<button>`/`<a>`;
  every input labeled (mono micro-label via `MicroLabel`); focus-visible = 2px crimson
  ring, 2px offset; tables use proper `<th scope="col">`; honor `prefers-reduced-motion`.

## Working here

- `npm run dev` = MSW mock mode (default). Tests always use MSW node — never mock
  `fetch` by hand; override behavior with `server.use(...)` per test.
- Motion: `ease-editorial` token; 180ms hover / 320ms panel / 600ms page; 2px hover-lift.
- Verify before finishing: `npm run typecheck && npm run lint && npm test && npm run build`.

## Deploy (rewired 2026-07-10 — Heroku is permanent)

Production = the Heroku api app (`revenuepoint-api`) serving `spa-dist/` from the
`revenuepoint/api` repo; `workspace.revenuepoint.com` points there and API calls
are same-origin (`VITE_API_BASE_URL=''`). Push to `main` here → `ci.yml` verifies
(typecheck/lint/unit/e2e) → commits `dist/` into `revenuepoint/api:spa-dist/` →
the api repo's CI deploys to Heroku. GitHub Pages hosting is retired; the old
"check githubstatus.com first" gotcha only matters if Pages ever returns.
