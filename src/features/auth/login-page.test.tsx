import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { LoginPage } from './login-page'

describe('LoginPage', () => {
  it('shows the magic-link hero copy', () => {
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' })

    expect(screen.getByRole('heading', { name: 'Sign in to your workspace' })).toBeInTheDocument()
    expect(screen.getByText(/We.ll email you a link to sign in\. No password needed\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send link' })).toBeInTheDocument()
  })

  it('submits the email and shows the check-your-inbox confirmation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' })

    await user.type(screen.getByLabelText(/email/i), 'dana.whitfield@acmecorp.com')
    await user.click(screen.getByRole('button', { name: 'Send link' }))

    expect(await screen.findByText(/Check your inbox at/)).toBeInTheDocument()
    expect(screen.getByText('dana.whitfield@acmecorp.com')).toBeInTheDocument()
    expect(screen.getByText('The link expires in 15 minutes.')).toBeInTheDocument()
    expect(screen.getByText(/Didn.t get it\?/)).toBeInTheDocument()
  })

  it('rejects an invalid email before hitting the network', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' })

    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Send link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Enter your work email/)
    expect(screen.queryByText(/Check your inbox/)).not.toBeInTheDocument()
  })

  it('re-triggering "Send another link" keeps showing the same confirmation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' })

    await user.type(screen.getByLabelText(/email/i), 'dana.whitfield@acmecorp.com')
    await user.click(screen.getByRole('button', { name: 'Send link' }))
    await screen.findByText(/Check your inbox at/)

    await user.click(screen.getByRole('button', { name: 'Send another link' }))

    // Rate-limit tolerant: identical confirmation, no state change.
    expect(await screen.findByText(/Check your inbox at/)).toBeInTheDocument()
    expect(screen.getByText('The link expires in 15 minutes.')).toBeInTheDocument()
  })
})
