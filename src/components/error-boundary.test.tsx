import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppErrorBoundary } from './error-boundary'

function Bomb(): never {
  throw new Error('boom')
}

describe('AppErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <p>all good</p>
      </AppErrorBoundary>,
    )

    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('renders the branded recovery screen instead of a blank page', () => {
    // React logs boundary-caught errors; keep the test output clean.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    )

    expect(screen.getByText(/couldn.t recover from/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'support@revenuepoint.com' })).toBeInTheDocument()

    consoleError.mockRestore()
  })
})
