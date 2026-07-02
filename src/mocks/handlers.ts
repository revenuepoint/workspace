import { http, HttpResponse } from 'msw'
import type {
  AddCommentResponse,
  AuthCompleteResponse,
  CaseDetail,
  CaseSummary,
  CasesListResponse,
  CreateCaseResponse,
  FileMeta,
  StatusGroup,
  TimelineEntry,
  UploadFilesResponse,
} from '@/lib/api-types'
import { MOCK_SESSION_JWT, seedCases, seedContact } from './fixtures'

// MSW handlers implementing the FROZEN v1 client API contract exactly.
// Paths are origin-agnostic (a leading "*" wildcard before "/v1/...") so the
// same handlers serve the dev server, `vite preview` (e2e), and the node test
// server regardless of VITE_API_BASE_URL.
//
// Magic-link tokens with special behavior (everything else succeeds):
//   expired-token  → 401 expired_link
//   invalid-token  → 401 invalid_link
//   used-token     → 401 link_already_used

let db: CaseDetail[] = seedCases()
let caseSeq = 12_351
let entrySeq = 5_000
let docSeq = 5_000

/** Reset in-memory state between tests. */
export function resetMockDb(): void {
  db = seedCases()
  caseSeq = 12_351
  entrySeq = 5_000
  docSeq = 5_000
}

function unauthorized() {
  return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
}

function notFound() {
  return HttpResponse.json({ error: 'not_found' }, { status: 404 })
}

function isAuthorized(request: Request): boolean {
  const header = request.headers.get('Authorization')
  return header !== null && header.startsWith('Bearer ') && header.slice(7).length > 0
}

function toSummary(c: CaseDetail): CaseSummary {
  return {
    id: c.id,
    caseNumber: c.caseNumber,
    subject: c.subject,
    status: c.status,
    statusLabel: c.statusLabel,
    statusGroup: c.statusGroup,
    waitingOnYou: c.waitingOnYou,
    recordType: c.recordType,
    recordTypeLabel: c.recordTypeLabel,
    createdAt: c.createdAt,
    lastActivityAt: c.lastActivityAt,
    submittedBy: c.submittedBy,
  }
}

const RECORD_TYPE_LABELS: Record<string, string> = {
  support: 'Support request',
  problem: 'Problem report',
  change: 'Change request',
}

function nextEntryId(): string {
  entrySeq += 1
  return `tl-${entrySeq}`
}

function fileMetaFor(file: File, uploadedBy: 'client' | 'rp'): FileMeta {
  docSeq += 1
  const dot = file.name.lastIndexOf('.')
  return {
    contentDocumentId: `doc-${docSeq}`,
    title: file.name,
    extension: dot === -1 ? '' : file.name.slice(dot + 1).toLowerCase(),
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
  }
}

export const handlers = [
  // --- Auth ------------------------------------------------------------
  http.post('*/v1/client/auth/start', () => {
    // Always 200 — never leaks whether the email has an account.
    return HttpResponse.json({ ok: true })
  }),

  http.post('*/v1/client/auth/complete', async ({ request }) => {
    const { token } = (await request.json()) as { token?: string }
    switch (token) {
      case 'expired-token':
        return HttpResponse.json(
          { error: 'expired_link', message: 'This sign-in link has expired.' },
          { status: 401 },
        )
      case 'invalid-token':
        return HttpResponse.json(
          { error: 'invalid_link', message: 'This sign-in link isn’t valid.' },
          { status: 401 },
        )
      case 'used-token':
        return HttpResponse.json(
          { error: 'link_already_used', message: 'This sign-in link was already used.' },
          { status: 401 },
        )
      default: {
        if (!token) {
          return HttpResponse.json(
            { error: 'invalid_link', message: 'This sign-in link isn’t valid.' },
            { status: 401 },
          )
        }
        const body: AuthCompleteResponse = { sessionJwt: MOCK_SESSION_JWT, contact: seedContact }
        return HttpResponse.json(body)
      }
    }
  }),

  // --- Cases: list -------------------------------------------------------
  http.get('*/v1/client/cases', ({ request }) => {
    if (!isAuthorized(request)) return unauthorized()

    const status = new URL(request.url).searchParams.get('status') ?? 'open'
    const counts = {
      open: db.filter((c) => c.statusGroup === 'open').length,
      closed: db.filter((c) => c.statusGroup === 'closed').length,
    }
    const cases =
      status === 'all' ? db : db.filter((c) => c.statusGroup === (status as StatusGroup))

    const body: CasesListResponse = {
      cases: cases
        .map(toSummary)
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
      counts,
    }
    return HttpResponse.json(body)
  }),

  // --- Cases: create -------------------------------------------------------
  http.post('*/v1/client/cases', async ({ request }) => {
    if (!isAuthorized(request)) return unauthorized()

    const form = await request.formData()
    const recordType = String(form.get('recordType') ?? '')
    const subject = String(form.get('subject') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()
    if (!RECORD_TYPE_LABELS[recordType] || !subject || !description) {
      return HttpResponse.json(
        { error: 'invalid_request', message: 'recordType, subject and description are required.' },
        { status: 400 },
      )
    }

    const uploads = form.getAll('files').filter((v): v is File => v instanceof File)
    const now = new Date().toISOString()
    caseSeq += 1
    const caseNumber = String(caseSeq).padStart(8, '0')
    const id = `case-${caseSeq}`

    const fileMetas = uploads.map((f) => fileMetaFor(f, 'client'))
    const timeline: TimelineEntry[] = [
      {
        id: nextEntryId(),
        kind: 'created',
        at: now,
        side: 'system',
        author: { name: `${seedContact.firstName} ${seedContact.lastName}` },
      },
      ...fileMetas.map(
        (file): TimelineEntry => ({
          id: nextEntryId(),
          kind: 'file',
          at: now,
          side: 'client',
          author: { name: `${seedContact.firstName} ${seedContact.lastName}` },
          file,
        }),
      ),
    ]

    const detail: CaseDetail = {
      id,
      caseNumber,
      subject,
      status: 'New',
      statusLabel: 'Received',
      statusGroup: 'open',
      waitingOnYou: false,
      recordType: recordType as CaseDetail['recordType'],
      recordTypeLabel: RECORD_TYPE_LABELS[recordType],
      createdAt: now,
      lastActivityAt: now,
      lastModifiedAt: now,
      submittedBy: { name: `${seedContact.firstName} ${seedContact.lastName}` },
      owner: { name: 'Client Success', isQueue: true },
      description,
      timeline,
      files: fileMetas,
    }
    db = [detail, ...db]

    const body: CreateCaseResponse = {
      id,
      caseNumber,
      files: uploads.map((f) => ({ name: f.name, ok: true })),
    }
    return HttpResponse.json(body, { status: 201 })
  }),

  // --- Cases: detail -------------------------------------------------------
  http.get('*/v1/client/cases/:id', ({ request, params }) => {
    if (!isAuthorized(request)) return unauthorized()
    const found = db.find((c) => c.id === params.id)
    if (!found) return notFound()
    return HttpResponse.json(found)
  }),

  // --- Comments ------------------------------------------------------------
  http.post('*/v1/client/cases/:id/comments', async ({ request, params }) => {
    if (!isAuthorized(request)) return unauthorized()
    const found = db.find((c) => c.id === params.id)
    if (!found) return notFound()

    const { body: commentBody } = (await request.json()) as { body?: string }
    if (!commentBody || !commentBody.trim()) {
      return HttpResponse.json(
        { error: 'invalid_request', message: 'A comment body is required.' },
        { status: 400 },
      )
    }

    const entry: TimelineEntry = {
      id: nextEntryId(),
      kind: 'comment',
      at: new Date().toISOString(),
      side: 'client',
      author: { name: `${seedContact.firstName} ${seedContact.lastName}` },
      bodyText: commentBody.trim(),
    }
    found.timeline.push(entry)
    found.lastActivityAt = entry.at
    found.lastModifiedAt = entry.at

    const body: AddCommentResponse = { entry }
    return HttpResponse.json(body, { status: 201 })
  }),

  // --- File upload -----------------------------------------------------------
  http.post('*/v1/client/cases/:id/files', async ({ request, params }) => {
    if (!isAuthorized(request)) return unauthorized()
    const found = db.find((c) => c.id === params.id)
    if (!found) return notFound()

    const form = await request.formData()
    const uploads = form.getAll('files').filter((v): v is File => v instanceof File)
    const now = new Date().toISOString()

    const results: UploadFilesResponse['files'] = uploads.map((f) => {
      const file = fileMetaFor(f, 'client')
      found.files.push(file)
      found.timeline.push({
        id: nextEntryId(),
        kind: 'file',
        at: now,
        side: 'client',
        author: { name: `${seedContact.firstName} ${seedContact.lastName}` },
        file,
      })
      return { name: f.name, ok: true, file }
    })
    if (uploads.length > 0) {
      found.lastActivityAt = now
      found.lastModifiedAt = now
    }

    return HttpResponse.json({ files: results } satisfies UploadFilesResponse, { status: 201 })
  }),

  // --- File download -----------------------------------------------------------
  http.get('*/v1/client/cases/:id/files/:docId/download', ({ request, params }) => {
    if (!isAuthorized(request)) return unauthorized()
    const found = db.find((c) => c.id === params.id)
    const file = found?.files.find((f) => f.contentDocumentId === params.docId)
    if (!found || !file) return notFound()

    return new HttpResponse(`RevenuePoint mock download — ${file.title}\n`, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${file.title}"`,
      },
    })
  }),
]
