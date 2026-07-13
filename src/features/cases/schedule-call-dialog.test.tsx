import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, seedSession } from '@/test/test-utils'
import { CaseDetailPage } from './case-detail-page'

function render(route: string) {
  seedSession()
  return renderWithProviders(<CaseDetailPage />, { route, path: '/cases/:id' })
}

const firstSlot = (dialog: HTMLElement): HTMLElement => {
  const btn = within(dialog)
    .getAllByRole('button')
    .find((el) => /\d{1,2}:\d{2}\s?(AM|PM)/i.test(el.textContent ?? ''))
  if (!btn) throw new Error('no slot rendered yet')
  return btn
}

describe('schedule a call', () => {
  it('books a call and shows the join link', async () => {
    const user = userEvent.setup()
    render('/cases/case-0001')
    await screen.findByRole('heading', { name: /Quarterly invoice/ })

    await user.click(await screen.findByRole('button', { name: /schedule a call/i }))
    const dialog = await screen.findByRole('dialog')

    await user.click(await waitFor(() => firstSlot(dialog)))
    await user.click(within(dialog).getByRole('button', { name: /book call/i }))

    expect(await within(dialog).findByText(/your call is booked/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /join/i })).toBeInTheDocument()
  })

  it('auto-opens the picker from an email deep-link (?book=1)', async () => {
    render('/cases/case-0001?book=1')
    await screen.findByRole('heading', { name: /Quarterly invoice/ })
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/pick a time/i)).toBeInTheDocument()
  })

  it('hides scheduling for queue-owned cases', async () => {
    render('/cases/case-0006')
    await screen.findByRole('heading', { level: 1 })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /schedule a call/i })).not.toBeInTheDocument(),
    )
  })
})
