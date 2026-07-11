import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/test-utils'
import { MOCK_SESSION_JWT } from '@/mocks/fixtures'
import { RETURN_TO_KEY, useSessionStore } from '@/stores/session'
import { LoginCallbackPage } from './callback-page'

function renderCallback(query: string) {
  return renderWithProviders(<LoginCallbackPage />, {
    route: `/login/callback${query}`,
    path: '/login/callback',
  })
}

describe('LoginCallbackPage', () => {
  it('completes the magic link, stores the session, and lands on the cases list', async () => {
    renderCallback('?token=demo')

    expect(await screen.findByText('stub:/cases')).toBeInTheDocument()
    expect(useSessionStore.getState().jwt).toBe(MOCK_SESSION_JWT)
    expect(useSessionStore.getState().contact?.email).toBe('dana.whitfield@acmecorp.com')
  })

  it('returns to the stored location after sign-in and consumes it', async () => {
    window.localStorage.setItem(RETURN_TO_KEY, '/cases/case-0001')
    renderCallback('?token=demo')

    expect(await screen.findByText('stub:/cases/:id')).toBeInTheDocument()
    expect(window.localStorage.getItem(RETURN_TO_KEY)).toBeNull()
  })

  it('stores the impersonated flag and actor from impersonation links', async () => {
    renderCallback('?token=impersonate-token')

    expect(await screen.findByText('stub:/cases')).toBeInTheDocument()
    expect(useSessionStore.getState().contact?.impersonated).toBe(true)
    expect(useSessionStore.getState().contact?.actorName).toBe('Devon Staff')
  })

  it('shows the expired-link state with a fresh-link CTA', async () => {
    renderCallback('?token=expired-token')

    expect(await screen.findByText('This link has expired.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Send a new link' })).toBeInTheDocument()
    expect(useSessionStore.getState().jwt).toBeNull()
  })

  it('shows the already-used state', async () => {
    renderCallback('?token=used-token')

    expect(await screen.findByText('This link was already used.')).toBeInTheDocument()
  })

  it('treats a missing token as an invalid link', () => {
    renderCallback('')

    expect(screen.getByText(/The sign-in token is missing/)).toBeInTheDocument()
  })

  it('treats an empty token as missing instead of spinning forever', () => {
    renderCallback('?token=')

    expect(screen.getByText(/The sign-in token is missing/)).toBeInTheDocument()
    expect(screen.queryByText('Signing you in…')).not.toBeInTheDocument()
  })
})
