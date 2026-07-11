import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, seedImpersonatedSession, seedSession } from '@/test/test-utils'
import { CaseCreatePage } from './case-create-page'

function renderCreate() {
  seedSession()
  return renderWithProviders(<CaseCreatePage />, { route: '/cases/new', path: '/cases/new' })
}

function fileOf(name: string, sizeBytes = 1024): File {
  const file = new File(['x'], name, { type: 'application/octet-stream' })
  Object.defineProperty(file, 'size', { value: sizeBytes })
  return file
}

const dropInput = () => screen.getByLabelText('Attach files')

describe('CaseCreatePage', () => {
  it('shows the three record type cards with support selected by default', () => {
    renderCreate()

    expect(screen.getByRole('radio', { name: /Support request/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Something.s broken/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /Change or new feature/ })).not.toBeChecked()

    // Impact/urgency ride along on every type; justification is change-only.
    expect(screen.getByLabelText('Impact')).toBeInTheDocument()
    expect(screen.getByLabelText('Urgency')).toBeInTheDocument()
    expect(screen.queryByLabelText('Business justification')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send to RevenuePoint' })).toBeInTheDocument()
  })

  it('offers impact + urgency on every record type', async () => {
    const user = userEvent.setup()
    renderCreate()

    // Present on the default (support) type with the exact contract values.
    for (const option of ['Extensive / Widespread', 'Significant / Large', 'Moderate / Limited', 'Minor / Localized']) {
      expect(screen.getByRole('option', { name: option })).toBeInTheDocument()
    }
    for (const option of ['Critical', 'High', 'Medium', 'Low', 'Lowest']) {
      expect(screen.getByRole('option', { name: option })).toBeInTheDocument()
    }
    expect(screen.getByText(/Optional — your best guess helps us triage/)).toBeInTheDocument()

    // Still present alongside the change-only justification field.
    await user.click(screen.getByRole('radio', { name: /Change or new feature/ }))
    expect(await screen.findByLabelText('Business justification')).toBeInTheDocument()
    expect(screen.getByLabelText('Impact')).toBeInTheDocument()
    expect(screen.getByLabelText('Urgency')).toBeInTheDocument()
  })

  it('validates subject and description before sending', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.click(screen.getByRole('button', { name: 'Send to RevenuePoint' }))

    expect(await screen.findByText(/Give this case a subject/)).toBeInTheDocument()
    expect(screen.getByText(/Tell us what.s going on/)).toBeInTheDocument()
  })

  it('rejects files over 10 MB with a reason', () => {
    renderCreate()

    fireEvent.change(dropInput(), { target: { files: [fileOf('big-dump.pdf', 11 * 1024 * 1024)] } })

    expect(screen.getByText(/big-dump\.pdf: over the 10 MB limit\./)).toBeInTheDocument()
    expect(screen.queryByText('big-dump.pdf')).not.toBeInTheDocument()
  })

  it('rejects unsupported extensions', () => {
    renderCreate()

    fireEvent.change(dropInput(), { target: { files: [fileOf('installer.exe')] } })

    expect(screen.getByText(/installer\.exe: \.exe files aren.t supported\./)).toBeInTheDocument()
  })

  it('caps attachments at 5 files', () => {
    renderCreate()

    const files = [1, 2, 3, 4, 5, 6].map((n) => fileOf(`log-${n}.txt`))
    fireEvent.change(dropInput(), { target: { files } })

    expect(screen.getByText(/log-6\.txt: only 5 files per case\./)).toBeInTheDocument()
    expect(screen.getByText('log-5.txt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove log-1.txt' })).toBeInTheDocument()
  })

  it('autosaves a draft and restores it on return', async () => {
    const user = userEvent.setup()
    const first = renderCreate()
    await user.type(screen.getByLabelText('Subject'), 'Half-written case')
    first.unmount()

    renderCreate()
    expect(screen.getByLabelText('Subject')).toHaveValue('Half-written case')
    expect(screen.getByText(/Picked up where you left off/)).toBeInTheDocument()
  })

  it('start fresh clears the restored draft', async () => {
    window.sessionStorage.setItem(
      'rp:workspace:case-draft',
      JSON.stringify({
        recordType: 'support',
        subject: 'Old draft',
        description: '',
        impact: '',
        urgency: '',
        businessJustification: '',
      }),
    )
    const user = userEvent.setup()
    renderCreate()
    expect(screen.getByLabelText('Subject')).toHaveValue('Old draft')

    await user.click(screen.getByRole('button', { name: 'Start fresh' }))

    expect(screen.getByLabelText('Subject')).toHaveValue('')
    expect(screen.queryByText(/Picked up where you left off/)).not.toBeInTheDocument()
  })

  it('cancel without files leaves immediately with the draft retained', async () => {
    const user = userEvent.setup()
    renderCreate()
    await user.type(screen.getByLabelText('Subject'), 'Keep me')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('stub:/cases')).toBeInTheDocument()
    expect(window.sessionStorage.getItem('rp:workspace:case-draft')).toContain('Keep me')
  })

  it('confirms before leaving when files are attached', async () => {
    const user = userEvent.setup()
    renderCreate()
    fireEvent.change(dropInput(), { target: { files: [fileOf('notes.txt')] } })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText(/Attached files aren.t saved with drafts/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Keep writing' }))
    expect(screen.queryByText(/Attached files aren.t saved with drafts/)).not.toBeInTheDocument()
  })

  it('adds a colleague as a participant and sends them with the case', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.type(screen.getByLabelText('Subject'), 'Need a hand')
    await user.type(screen.getByLabelText('Description'), 'Please loop in my colleague.')
    // The picker offers account colleagues (minus Dana herself).
    await user.selectOptions(await screen.findByLabelText('Add a colleague'), 'c-marcus')
    expect(await screen.findByText('Marcus Feld')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Send to RevenuePoint' }))
    expect(await screen.findByText('Case created')).toBeInTheDocument()
  })

  it('renders the form for impersonated (acting) sessions', () => {
    seedImpersonatedSession()
    renderWithProviders(<CaseCreatePage />, { route: '/cases/new', path: '/cases/new' })

    expect(screen.getByRole('heading', { name: 'Create a case' })).toBeInTheDocument()
  })

  it('submits a problem case and lands on the success screen with the case number', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.click(screen.getByRole('radio', { name: /Something.s broken/ }))
    await user.type(screen.getByLabelText('Subject'), 'Exports hang at 99%')
    await user.type(
      screen.getByLabelText('Description'),
      'Since Tuesday the ledger export sits at 99% and never finishes.',
    )
    await user.selectOptions(await screen.findByLabelText('Urgency'), 'High')
    fireEvent.change(dropInput(), { target: { files: [fileOf('export-stuck.png')] } })
    await user.click(screen.getByRole('button', { name: 'Send to RevenuePoint' }))

    expect(await screen.findByText('Case created')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /#\d{8}/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View case' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to cases' })).toBeInTheDocument()
    // A sent case never leaves a stale draft behind.
    expect(window.sessionStorage.getItem('rp:workspace:case-draft')).toBeNull()
  })
})
