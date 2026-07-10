import { datadogRum } from '@datadog/browser-rum'
import { reactPlugin } from '@datadog/browser-rum-react'
import type { Contact } from '@/lib/api-types'

let rumInitialized = false

/**
 * Datadog RUM — only initializes when both VITE_DD_APP_ID and
 * VITE_DD_CLIENT_TOKEN are set (they're empty in dev and mock builds).
 * CSP note: connect-src allows *.datadoghq.com AND the SDK's default US1
 * intake, browser-intake-datadoghq.com (index.html + the api app's header).
 */
export function initObservability(): boolean {
  if (rumInitialized) return true

  const applicationId = import.meta.env.VITE_DD_APP_ID
  const clientToken = import.meta.env.VITE_DD_CLIENT_TOKEN
  if (!applicationId || !clientToken) return false

  datadogRum.init({
    applicationId,
    clientToken,
    site: import.meta.env.VITE_DD_SITE ?? 'datadoghq.com',
    service: import.meta.env.VITE_DD_SERVICE ?? 'workspace',
    env: import.meta.env.VITE_DD_ENV ?? (import.meta.env.PROD ? 'production' : 'development'),
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackResources: true,
    trackUserInteractions: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
    plugins: [reactPlugin({ router: true })],
  })

  rumInitialized = true
  return true
}

/**
 * Called after a successful magic-link sign-in. The auth contract exposes
 * no contact id, so the (unique, stable) email doubles as the RUM user id.
 */
export function identifyUser(contact: Contact): void {
  if (!rumInitialized) return
  datadogRum.setUser({
    id: contact.email,
    email: contact.email,
    name: `${contact.firstName} ${contact.lastName}`.trim(),
    accountId: contact.accountId,
    accountName: contact.accountName,
  })
}

export function clearUser(): void {
  if (!rumInitialized) return
  datadogRum.clearUser()
}

/**
 * GA4 — optional, gated on VITE_GA_ID. Off by default; enabling it in
 * production also requires adding googletagmanager.com to script-src and
 * google-analytics.com to connect-src in the CSP (index.html).
 */
export function initAnalytics(): void {
  const gaId = import.meta.env.VITE_GA_ID
  if (!gaId) return

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`
  document.head.appendChild(script)

  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }
  w.dataLayer = w.dataLayer ?? []
  w.gtag = function gtag(...args: unknown[]) {
    w.dataLayer?.push(args)
  }
  w.gtag('js', new Date())
  w.gtag('config', gaId, { anonymize_ip: true })
}
