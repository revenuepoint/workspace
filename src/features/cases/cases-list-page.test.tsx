import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { renderWithProviders, seedImpersonatedSession, seedSession } from '@/test/test-utils'
import { CasesListPage } from './cases-list-page'

function renderList() {
  seedSession()
  return renderWithProviders(<CasesListPage />, { route: '/cases', path: '/cases' })
}

describe('CasesListPage', () => {
  it('defaults to the signed-in contact’s own cases with scoped counts', async () => {
    renderList()

    expect(await screen.findByRole('heading', { name: 'Acme Corp · Cases' })).toBeInTheDocument()
    // Dana's own open case shows…
    expect(await screen.findByText('Quarterly invoice shows duplicate line items')).toBeInTheDocument()
    // …a colleague's case (Marcus Feld) does NOT, in the default "My cases" view.
    expect(screen.queryByText('Payment webhook retries failing since Friday')).not.toBeInTheDocument()

    // "My cases" scope active; status pills show Dana's counts (4 open / 3 closed).
    expect(screen.getByRole('button', { name: /My cases/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Open \(4\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Closed \(3\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All \(7\)/ })).toBeInTheDocument()

    expect(screen.getByRole('columnheader', { name: /Case #/ })).toBeInTheDocument()
  })

  it('reveals colleagues’ cases when switched to "All cases"', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Quarterly invoice shows duplicate line items')

    await user.click(screen.getByRole('button', { name: /All cases/ }))

    // Marcus Feld's case now appears; counts jump to the account-wide totals.
    expect(await screen.findByText('Payment webhook retries failing since Friday')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open \(6\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All \(10\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All cases/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('pins waiting-on-you cases to the top and announces the count', async () => {
    renderList()

    expect(await screen.findByText('1 case is waiting on you.')).toBeInTheDocument()

    // The waiting case leads despite other cases having newer activity.
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Read-only access for our external auditors')
  })

  it('renders tappable cards instead of the table on narrow screens', async () => {
    const mql = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue(mql as unknown as MediaQueryList),
    )
    try {
      renderList()

      const card = await screen.findByRole('link', { name: /Quarterly invoice shows duplicate line items/ })
      expect(card).toHaveTextContent('00012341')
      expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('marks waiting-on-you rows with the amber left edge', async () => {
    renderList()

    const subject = await screen.findByText('Read-only access for our external auditors')
    const row = subject.closest('tr')
    expect(row).not.toBeNull()
    expect(row!.className).toContain('border-l-amber')

    const calmRow = screen.getByText('Quarterly invoice shows duplicate line items').closest('tr')
    expect(calmRow!.className).not.toContain('border-l-amber')
  })

  it('switches to closed cases via the filter pills', async () => {
    const user = userEvent.setup()
    renderList()

    // Default "My cases" → 3 of Dana's cases are closed.
    await user.click(await screen.findByRole('button', { name: /Closed \(3\)/ }))

    expect(await screen.findByText('Reset MFA for the finance team lead')).toBeInTheDocument()
    expect(screen.queryByText('Quarterly invoice shows duplicate line items')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Closed \(3\)/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers "see all cases" when the contact has none of their own', async () => {
    server.use(
      http.get('*/v1/client/cases', () =>
        HttpResponse.json({
          cases: [],
          counts: { open: 5, closed: 2 },
          mineCounts: { open: 0, closed: 0 },
        }),
      ),
    )
    const user = userEvent.setup()
    renderList()

    expect(await screen.findByText(/You don.t have any cases yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /See all cases at your account/ }))
    expect(screen.getByRole('button', { name: /All cases/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the no-open-cases empty state with a create link', async () => {
    server.use(
      http.get('*/v1/client/cases', () =>
        HttpResponse.json({ cases: [], counts: { open: 0, closed: 4 } }),
      ),
    )
    renderList()

    expect(await screen.findByText(/No open cases\. Need to start one\?/)).toBeInTheDocument()
    // Both the header button and the empty-state link say "Create a case"
    expect(screen.getAllByRole('link', { name: /Create a case/ }).length).toBeGreaterThanOrEqual(2)
  })

  it('keeps the create affordances for impersonated (acting) sessions', async () => {
    seedImpersonatedSession()
    renderWithProviders(<CasesListPage />, { route: '/cases', path: '/cases' })

    await screen.findByRole('heading', { name: 'Acme Corp · Cases' })
    expect(screen.getByRole('link', { name: /Create a case/ })).toBeInTheDocument()
  })

  it('shows the nothing-here-yet empty state when the account has no cases at all', async () => {
    server.use(
      http.get('*/v1/client/cases', () =>
        HttpResponse.json({ cases: [], counts: { open: 0, closed: 0 } }),
      ),
    )
    renderList()

    expect(
      await screen.findByText(/Nothing here yet\. When your team creates a case, it.ll show up here\./),
    ).toBeInTheDocument()
  })
})
