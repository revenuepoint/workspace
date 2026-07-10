import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, seedImpersonatedSession, seedSession } from '@/test/test-utils'
import { useSessionStore } from '@/stores/session'
import { AppShell } from './app-shell'

describe('AppShell', () => {
  it('shows the account name and no banner on a normal session', () => {
    seedSession()
    renderWithProviders(<AppShell />, { route: '/cases', path: '/cases' })

    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.queryByText(/read-only/)).not.toBeInTheDocument()
  })

  it('shows the read-only banner on impersonated sessions', () => {
    seedImpersonatedSession()
    renderWithProviders(<AppShell />, { route: '/cases', path: '/cases' })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Viewing as Dana Whitfield (Acme Corp) — read-only',
    )
  })

  it('sign out clears the session and lands on /login', async () => {
    seedSession()
    const user = userEvent.setup()
    renderWithProviders(<AppShell />, { route: '/cases', path: '/cases' })

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(useSessionStore.getState().jwt).toBeNull()
    expect(useSessionStore.getState().contact).toBeNull()
    expect(screen.getByText('stub:/login')).toBeInTheDocument()
  })
})
