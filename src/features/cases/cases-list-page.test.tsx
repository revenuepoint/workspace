import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { renderWithProviders, seedSession } from '@/test/test-utils'
import { CasesListPage } from './cases-list-page'

function renderList() {
  seedSession()
  return renderWithProviders(<CasesListPage />, { route: '/cases', path: '/cases' })
}

describe('CasesListPage', () => {
  it('renders the account header, fixture rows, and counts', async () => {
    renderList()

    expect(await screen.findByRole('heading', { name: 'Acme Corp · Cases' })).toBeInTheDocument()
    expect(await screen.findByText('00012341')).toBeInTheDocument()
    expect(screen.getByText('Quarterly invoice shows duplicate line items')).toBeInTheDocument()

    // Filter pills with counts
    expect(screen.getByRole('button', { name: /Open \(6\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Closed \(4\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All \(10\)/ })).toBeInTheDocument()

    // Closed cases stay off the default (open) view
    expect(screen.queryByText('00012337')).not.toBeInTheDocument()

    // Proper table semantics
    expect(screen.getByRole('columnheader', { name: /Case #/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Last activity/ })).toBeInTheDocument()
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

    await user.click(await screen.findByRole('button', { name: /Closed \(4\)/ }))

    expect(await screen.findByText('00012337')).toBeInTheDocument()
    expect(screen.getByText('Reset MFA for the finance team lead')).toBeInTheDocument()
    expect(screen.queryByText('00012341')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Closed \(4\)/ })).toHaveAttribute('aria-pressed', 'true')
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
