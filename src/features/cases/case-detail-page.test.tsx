import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, seedSession } from '@/test/test-utils'
import { CaseDetailPage } from './case-detail-page'

function renderDetail(caseId: string) {
  seedSession()
  return renderWithProviders(<CaseDetailPage />, {
    route: `/cases/${caseId}`,
    path: '/cases/:id',
  })
}

describe('CaseDetailPage', () => {
  it('renders breadcrumb, subject, and the meta row', async () => {
    renderDetail('case-0001')

    expect(
      await screen.findByRole('heading', { name: 'Quarterly invoice shows duplicate line items' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toHaveTextContent('Cases·#00012341')
    expect(screen.getByText('Support request')).toBeInTheDocument()
    expect(screen.getByText(/Submitted by Dana Whitfield/)).toBeInTheDocument()
  })

  it('renders every timeline kind: created, comments, status change, email, file', async () => {
    renderDetail('case-0001')
    await screen.findByRole('heading', { name: /Quarterly invoice/ })

    // created — system pill
    expect(screen.getByText(/Case created by Dana Whitfield/)).toBeInTheDocument()
    // rp comment (left/paper) and client comment (right/navyTint)
    expect(screen.getByText(/we can reproduce this on our side/i)).toBeInTheDocument()
    expect(screen.getByText(/our finance close starts Monday/i)).toBeInTheDocument()
    // status change — mono pill "from → to"
    expect(screen.getByText('Received → In review')).toBeInTheDocument()
    // email — subject visible, body clamped behind a toggle
    expect(
      screen.getByText('Re: Quarterly invoice shows duplicate line items [ref:00012341]'),
    ).toBeInTheDocument()
    // file entry
    expect(screen.getAllByText('invoice-march-export.csv').length).toBeGreaterThanOrEqual(2)
  })

  it('sanitized email body expands and collapses', async () => {
    const user = userEvent.setup()
    renderDetail('case-0001')
    await screen.findByRole('heading', { name: /Quarterly invoice/ })

    const toggle = screen.getByRole('button', { name: 'Show full email' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/isolated the duplication/)).toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders client comments right-aligned and rp comments left-aligned', async () => {
    renderDetail('case-0001')
    await screen.findByRole('heading', { name: /Quarterly invoice/ })

    const clientBubble = screen.getByText(/our finance close starts Monday/i).closest('.flex')
    const rpBubble = screen.getByText(/we can reproduce this on our side/i).closest('.flex')
    expect(clientBubble?.className).toContain('justify-end')
    expect(rpBubble?.className).toContain('justify-start')
  })

  it('shows the files panel with name, size, and download affordance', async () => {
    renderDetail('case-0001')
    await screen.findByRole('heading', { name: /Quarterly invoice/ })

    expect(screen.getByRole('heading', { name: 'Files' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Download duplicate-lines-annotated\.pdf/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('403 KB')).toBeInTheDocument()
  })

  it('shows the amber Waiting on you banner only when waitingOnYou', async () => {
    renderDetail('case-0004')
    await screen.findByRole('heading', { name: /Read-only access/ })

    // Appears twice: the status chip AND the banner heading
    expect(screen.getAllByText('Waiting on you')).toHaveLength(2)
    expect(screen.getByText(/RevenuePoint needs something from you/)).toBeInTheDocument()
  })

  it('omits the banner on calm cases and shows the empty-timeline note', async () => {
    renderDetail('case-0006')
    await screen.findByRole('heading', { name: /Runbook for the month-end close/ })

    expect(screen.queryByText(/RevenuePoint needs something from you/)).not.toBeInTheDocument()
    expect(screen.getByText(/No activity yet/)).toBeInTheDocument()
  })

  it('shows the not-found state for a case outside this account', async () => {
    renderDetail('case-9999')

    expect(await screen.findByText(/This case doesn.t exist/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to cases' })).toBeInTheDocument()
  })
})
