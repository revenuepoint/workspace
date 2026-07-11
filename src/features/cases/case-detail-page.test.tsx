import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, seedImpersonatedSession, seedSession } from '@/test/test-utils'
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

  it('shows the files panel with name, size, and a preview affordance', async () => {
    renderDetail('case-0001')
    await screen.findByRole('heading', { name: /Quarterly invoice/ })

    expect(screen.getByRole('heading', { name: 'Files' })).toBeInTheDocument()
    // PDF is previewable → the chip opens a preview (download lives inside it).
    expect(
      screen.getByRole('button', { name: /Preview duplicate-lines-annotated\.pdf/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('403 KB')).toBeInTheDocument()
  })

  it('orders activity newest-first with the composer above the feed', async () => {
    renderDetail('case-0001')
    await screen.findByRole('heading', { name: /Quarterly invoice/ })

    // Composer leads; the "Case created" system pill (oldest) is last.
    const composer = screen.getByLabelText('Add a comment')
    const created = screen.getByText(/Case created by Dana Whitfield/)
    expect(composer.compareDocumentPosition(created) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // Newest entry (the file chip, most recent `at`) precedes the oldest pill.
    const newest = screen.getAllByText('invoice-march-export.csv')[0]!
    expect(newest.compareDocumentPosition(created) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders the progress path with the current stage marked', async () => {
    renderDetail('case-0005') // problem case, status UAT → In testing
    await screen.findByRole('heading', { name: /Dashboard totals off/ })

    const path = screen.getByRole('navigation', { name: 'Case progress' })
    expect(path).toBeInTheDocument()
    // Full 5-step path for a problem case.
    for (const label of ['Received', 'In review', 'In progress', 'In testing', 'Deployed']) {
      expect(within(path).getByText(label)).toBeInTheDocument()
    }
    expect(within(path).getByText('(current stage)')).toBeInTheDocument()
  })

  it('shows urgency and clean-labelled priority', async () => {
    renderDetail('case-0002') // Critical / 5. Blocker
    await screen.findByRole('heading', { name: /Payment webhook retries/ })

    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('Blocker')).toBeInTheDocument() // ordinal stripped
    expect(screen.queryByText('5. Blocker')).not.toBeInTheDocument()
  })

  it('renders the description as Markdown', async () => {
    renderDetail('case-0001')
    await screen.findByRole('heading', { name: /Quarterly invoice/ })

    // **twice** → <strong>, the "- " lines → list items.
    const strong = screen.getByText('twice')
    expect(strong.tagName).toBe('STRONG')
    expect(screen.getByText('Duplicated rows inflate the invoice total')).toBeInTheDocument()
  })

  it('shows participants, locks the current user, and adds/removes colleagues', async () => {
    const user = userEvent.setup()
    renderDetail('case-0001') // seeded with Dana (you) + Marcus
    await screen.findByRole('heading', { name: /Quarterly invoice/ })

    const panel = screen.getByRole('region', { name: 'Participants' })
    expect(within(panel).getByText('Dana Whitfield')).toBeInTheDocument()
    expect(within(panel).getByText('you')).toBeInTheDocument() // can't remove yourself
    expect(within(panel).getByText('Marcus Feld')).toBeInTheDocument()

    // Remove Marcus.
    await user.click(within(panel).getByRole('button', { name: /Remove Marcus Feld/ }))
    await waitFor(() => expect(within(panel).queryByText('Marcus Feld')).not.toBeInTheDocument())

    // Add a colleague from the picker.
    await user.selectOptions(within(panel).getByLabelText('Add a colleague'), 'c-priya')
    expect(await within(panel).findByText('Priya Anand')).toBeInTheDocument()
  })

  it('shows who has the case when it is with a person, not a queue', async () => {
    renderDetail('case-0001')
    await screen.findByRole('heading', { name: /Quarterly invoice/ })

    expect(screen.getByText('With Priya Raman')).toBeInTheDocument()
  })

  it('omits the owner for queue-owned cases', async () => {
    renderDetail('case-0006')
    await screen.findByRole('heading', { name: /Runbook for the month-end close/ })

    expect(screen.queryByText(/With Client Success/)).not.toBeInTheDocument()
  })

  it('makes timeline file entries previewable', async () => {
    renderDetail('case-0001')
    await screen.findByRole('heading', { name: /Quarterly invoice/ })

    // CSV is previewable → both the Files panel chip and the timeline entry
    // chip open a preview.
    expect(screen.getAllByRole('button', { name: /Preview invoice-march-export\.csv/ })).toHaveLength(2)
  })

  it('lets the client mark an open case resolved via a structured note', async () => {
    const user = userEvent.setup()
    renderDetail('case-0002')
    await screen.findByRole('heading', { name: /Payment webhook retries/ })

    await user.click(screen.getByRole('button', { name: 'Mark as resolved' }))
    await user.click(screen.getByRole('button', { name: 'Post the note' }))

    expect(await screen.findByText(/please close this case/)).toBeInTheDocument()
    // The row resets; the team closes the case in Salesforce.
    expect(screen.getByRole('button', { name: 'Mark as resolved' })).toBeInTheDocument()
  })

  it('offers no resolve affordance on closed cases', async () => {
    renderDetail('case-0007')
    await screen.findByRole('heading', { name: /Reset MFA/ })

    expect(screen.queryByRole('button', { name: 'Mark as resolved' })).not.toBeInTheDocument()
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

  it('keeps the composer for impersonated (acting) sessions', async () => {
    seedImpersonatedSession()
    renderWithProviders(<CaseDetailPage />, { route: '/cases/case-0001', path: '/cases/:id' })

    await screen.findByRole('heading', { name: /Quarterly invoice/ })
    expect(screen.getByLabelText('Add a comment')).toBeInTheDocument()
  })

  it('shows the not-found state for a case outside this account', async () => {
    renderDetail('case-9999')

    expect(await screen.findByText(/This case doesn.t exist/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to cases' })).toBeInTheDocument()
  })
})
