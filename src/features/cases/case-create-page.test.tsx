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

    // Support shows neither triage selects nor justification
    expect(screen.queryByLabelText('Impact')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Urgency')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Business justification')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send to RevenuePoint' })).toBeInTheDocument()
  })

  it('shows impact + urgency only for "Something\'s broken"', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.click(screen.getByRole('radio', { name: /Something.s broken/ }))

    const impact = await screen.findByLabelText('Impact')
    expect(impact).toBeInTheDocument()
    expect(screen.getByLabelText('Urgency')).toBeInTheDocument()
    expect(screen.queryByLabelText('Business justification')).not.toBeInTheDocument()

    // Exact contract values
    for (const option of ['Extensive / Widespread', 'Significant / Large', 'Moderate / Limited', 'Minor / Localized']) {
      expect(screen.getByRole('option', { name: option })).toBeInTheDocument()
    }
    for (const option of ['Critical', 'High', 'Medium', 'Low', 'Lowest']) {
      expect(screen.getByRole('option', { name: option })).toBeInTheDocument()
    }
    // Optional — helper copy present
    expect(screen.getByText(/Optional — your best guess helps us triage/)).toBeInTheDocument()
  })

  it('shows business justification only for change requests', async () => {
    const user = userEvent.setup()
    renderCreate()

    await user.click(screen.getByRole('radio', { name: /Change or new feature/ }))

    expect(await screen.findByLabelText('Business justification')).toBeInTheDocument()
    expect(screen.queryByLabelText('Impact')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Urgency')).not.toBeInTheDocument()
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

  it('redirects impersonated (read-only) sessions back to the list', () => {
    seedImpersonatedSession()
    renderWithProviders(<CaseCreatePage />, { route: '/cases/new', path: '/cases/new' })

    expect(screen.getByText('stub:/cases')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Create a case' })).not.toBeInTheDocument()
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
  })
})
