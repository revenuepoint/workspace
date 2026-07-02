/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin. Defaults to http://localhost:3000 when unset; empty string = same-origin (mock mode). */
  readonly VITE_API_BASE_URL?: string
  /** 'true' starts the MSW browser worker before render. Default 'true' in `npm run dev` (.env.development). */
  readonly VITE_USE_MOCKS?: string
  /** Datadog RUM — both must be set for RUM to initialize. Empty in dev. */
  readonly VITE_DD_APP_ID?: string
  readonly VITE_DD_CLIENT_TOKEN?: string
  readonly VITE_DD_SITE?: string
  readonly VITE_DD_SERVICE?: string
  readonly VITE_DD_ENV?: string
  /** GA4 measurement id — optional; unset means no GA. */
  readonly VITE_GA_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
