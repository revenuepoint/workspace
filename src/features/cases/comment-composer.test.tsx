import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { renderWithProviders, seedSession } from '@/test/test-utils'
import { CaseDetailPage } from './case-detail-page'

function renderCase(caseId = 'case-0002') {
  seedSession()
  return renderWithProviders(<CaseDetailPage />, {
    route: `/cases/${caseId}`,
    path: '/cases/:id',
  })
}

describe('CommentComposer', () => {
  it('appends the comment optimistically before the server responds', async () => {
    // Slow the endpoint down so we can observe the optimistic bubble.
    server.use(
      http.post('*/v1/client/cases/:id/comments', async ({ request }) => {
        await delay(400)
        const { body } = (await request.json()) as { body: string }
        return HttpResponse.json(
          {
            entry: {
              id: 'tl-server-1',
              kind: 'comment',
              at: new Date().toISOString(),
              side: 'client',
              author: { name: 'Dana Whitfield' },
              bodyText: body,
            },
          },
          { status: 201 },
        )
      }),
    )

    const user = userEvent.setup()
    renderCase()
    await screen.findByRole('heading', { name: /Payment webhook retries/ })

    const textarea = screen.getByLabelText('Add a comment')
    await user.type(textarea, 'Confirmed — retries are flowing again on our side.')
    await user.click(screen.getByRole('button', { name: 'Add comment' }))

    // Optimistic: visible immediately, long before the 400ms server response.
    expect(screen.getByText('Confirmed — retries are flowing again on our side.')).toBeInTheDocument()
    // Composer cleared right away
    expect(textarea).toHaveValue('')

    // Still there once the server entry replaces the optimistic one.
    await waitFor(() =>
      expect(screen.getByText('Confirmed — retries are flowing again on our side.')).toBeInTheDocument(),
    )
  })

  it('persists the comment through the real mock endpoint', async () => {
    const user = userEvent.setup()
    renderCase()
    await screen.findByRole('heading', { name: /Payment webhook retries/ })

    await user.type(screen.getByLabelText('Add a comment'), 'Adding our webhook delivery logs tomorrow.')
    await user.click(screen.getByRole('button', { name: 'Add comment' }))

    expect(await screen.findByText('Adding our webhook delivery logs tomorrow.')).toBeInTheDocument()
    // The composer's send button disables once the field is empty again.
    expect(screen.getByRole('button', { name: 'Add comment' })).toBeDisabled()
  })

  it('rolls the optimistic bubble back and restores the draft on failure', async () => {
    server.use(
      http.post('*/v1/client/cases/:id/comments', async () => {
        await delay(100)
        return HttpResponse.json({ error: 'server_error' }, { status: 500 })
      }),
    )

    const user = userEvent.setup()
    renderCase()
    await screen.findByRole('heading', { name: /Payment webhook retries/ })

    await user.type(screen.getByLabelText('Add a comment'), 'This one will fail.')
    await user.click(screen.getByRole('button', { name: 'Add comment' }))

    // Optimistically appended as a timeline bubble…
    expect(screen.getByText('This one will fail.', { selector: 'p' })).toBeInTheDocument()

    // …then rolled back, with the draft restored so nothing is lost.
    // (React mirrors the textarea value into its text content, so scope to the bubble <p>.)
    await waitFor(() => expect(screen.getByLabelText('Add a comment')).toHaveValue('This one will fail.'))
    await waitFor(() =>
      expect(screen.queryByText('This one will fail.', { selector: 'p' })).not.toBeInTheDocument(),
    )
  })
})
