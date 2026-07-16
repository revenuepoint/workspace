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
  it('defaults to the signed-in contact’s own cases (submitted or participant)', async () => {
    renderList()

    expect(await screen.findByRole('heading', { name: 'Acme Corp · Cases' })).toBeInTheDocument()
    // Dana's own submitted case shows…
    expect(await screen.findByText('Quarterly invoice shows duplicate line items')).toBeInTheDocument()
    // …and a colleague's case she's a PARTICIPANT on also shows (mine includes CC'd)…
    expect(screen.getByText('Dashboard totals off by a day for UTC+ users')).toBeInTheDocument()
    // …but a colleague's case she's not on does NOT.
    expect(screen.queryByText('Payment webhook retries failing since Friday')).not.toBeInTheDocument()

    // "My cases" scope active; counts = Dana's 6 open (4 submitted + 2 participant,
    // one of them sensitive) / 3 closed.
    expect(screen.getByRole('button', { name: /My cases/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Open \(6\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Closed \(3\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All \(9\)/ })).toBeInTheDocument()

    expect(screen.getByRole('columnheader', { name: /Case #/ })).toBeInTheDocument()
  })

  it('reveals colleagues’ cases when switched to "All cases"', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Quarterly invoice shows duplicate line items')

    await user.click(screen.getByRole('button', { name: /All cases/ }))

    // Marcus Feld's case now appears; counts jump to the account-wide totals
    // (which already exclude the sensitive case Dana isn't on).
    expect(await screen.findByText('Payment webhook retries failing since Friday')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open \(7\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All \(11\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All cases/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('hides sensitive cases outside your circle, even under "All cases"', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Quarterly invoice shows duplicate line items')

    await user.click(screen.getByRole('button', { name: /All cases/ }))
    await screen.findByText('Payment webhook retries failing since Friday')

    // Dana participates on this sensitive case → visible under All too…
    expect(
      screen.getByText('Payroll export includes former-employee salary lines'),
    ).toBeInTheDocument()
    // …but Marcus's sensitive case leaves no trace for her (the mock, like the
    // real API, filters it server-side — nothing for the SPA to even hide).
    expect(
      screen.queryByText('Access review for the finance director transition'),
    ).not.toBeInTheDocument()
  })

  it('marks visible sensitive cases with the Sensitive chip', async () => {
    renderList()

    const subject = await screen.findByText('Payroll export includes former-employee salary lines')
    const row = subject.closest('tr')
    expect(row).not.toBeNull()
    expect(row!).toHaveTextContent('Sensitive')

    // Ordinary cases carry no such marker.
    const calmRow = screen.getByText('Quarterly invoice shows duplicate line items').closest('tr')
    expect(calmRow!).not.toHaveTextContent('Sensitive')
  })

  it('adds a Contact column on "All cases" and drops it on "My cases"', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Quarterly invoice shows duplicate line items')

    // "My cases" — every row is the signed-in person, so no Contact column.
    expect(screen.queryByRole('columnheader', { name: /Contact/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /All cases/ }))

    // "All cases" — the column appears and names the case's contact.
    expect(await screen.findByRole('columnheader', { name: /Contact/ })).toBeInTheDocument()
    const marcusRow = screen.getByText('Payment webhook retries failing since Friday').closest('tr')
    expect(marcusRow).toHaveTextContent('Marcus Feld')
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
