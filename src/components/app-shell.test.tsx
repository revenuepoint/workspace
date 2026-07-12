import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, seedImpersonatedSession, seedSession } from '@/test/test-utils'
import { useSessionStore } from '@/stores/session'
import { AppShell } from './app-shell'

describe('AppShell', () => {
  it('shows the signed-in contact name, account, and no banner on a normal session', () => {
    seedSession()
    renderWithProviders(<AppShell />, { route: '/cases', path: '/cases' })

    expect(screen.getByText('Dana Whitfield')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.queryByText(/Acting as/)).not.toBeInTheDocument()
  })

  it('shows the acting-as banner and the actor name on impersonated sessions', () => {
    seedImpersonatedSession()
    renderWithProviders(<AppShell />, { route: '/cases', path: '/cases' })

    expect(screen.getByRole('status')).toHaveTextContent('Acting as Dana Whitfield (Acme Corp)')
    expect(screen.getByRole('status')).not.toHaveTextContent('actions are recorded')
    // Top-right shows who's really signed in — the staff actor, not the contact.
    expect(screen.getByText('Devon Staff')).toBeInTheDocument()
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
