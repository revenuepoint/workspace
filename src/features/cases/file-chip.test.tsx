import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { renderWithProviders, seedSession } from '@/test/test-utils'
import type { FileMeta } from '@/lib/api-types'
import { FileChip } from './file-chip'

function fileOf(partial: Partial<FileMeta>): FileMeta {
  return {
    contentDocumentId: 'doc-1',
    title: 'thing.pdf',
    extension: 'pdf',
    sizeBytes: 1024,
    uploadedAt: new Date('2026-06-01').toISOString(),
    uploadedBy: 'client',
    ...partial,
  }
}

describe('FileChip', () => {
  it('opens an inline preview for a previewable file', async () => {
    seedSession()
    const user = userEvent.setup()
    renderWithProviders(<FileChip caseId="case-0001" file={fileOf({ title: 'report.pdf', extension: 'pdf' })} />)

    await user.click(screen.getByRole('button', { name: /Preview report\.pdf/ }))

    // The <dialog> preview mounts with a download affordance inside it.
    expect(await screen.findByRole('button', { name: 'Download' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close preview' })).toBeInTheDocument()
  })

  it('renders text-file contents inline', async () => {
    seedSession()
    server.use(
      http.get('*/v1/client/cases/:id/files/:docId/download', () =>
        new HttpResponse('col_a,col_b\n1,2\n', { headers: { 'Content-Type': 'text/plain' } }),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<FileChip caseId="case-0001" file={fileOf({ title: 'notes.txt', extension: 'txt' })} />)

    await user.click(screen.getByRole('button', { name: /Preview notes\.txt/ }))
    expect(await screen.findByText(/col_a,col_b/)).toBeInTheDocument()
  })

  it('downloads directly (no preview) for a non-previewable file', async () => {
    seedSession()
    server.use(
      http.get('*/v1/client/cases/:id/files/:docId/download', () =>
        new HttpResponse('zip-bytes', { headers: { 'Content-Type': 'application/octet-stream' } }),
      ),
    )
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = userEvent.setup()
    renderWithProviders(<FileChip caseId="case-0001" file={fileOf({ title: 'bundle.zip', extension: 'zip' })} />)

    await user.click(screen.getByRole('button', { name: /Download bundle\.zip/ }))

    await waitFor(() => expect(anchorClick).toHaveBeenCalled())
    // No preview dialog for download-only types.
    expect(screen.queryByRole('button', { name: 'Close preview' })).not.toBeInTheDocument()
    anchorClick.mockRestore()
  })
})
