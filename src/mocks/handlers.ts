import { http, HttpResponse } from 'msw'
import type {
  AccountContactsResponse,
  AddCommentResponse,
  AddParticipantResponse,
  AuthCompleteResponse,
  CaseBooking,
  CaseDetail,
  CaseParticipant,
  CaseSummary,
  CasesListResponse,
  CreateCaseResponse,
  FileMeta,
  StatusGroup,
  TimelineEntry,
  UploadFilesResponse,
} from '@/lib/api-types'
import {
  MOCK_IMPERSONATED_JWT,
  MOCK_SESSION_JWT,
  seedAccountContacts,
  seedCases,
  seedContact,
} from './fixtures'

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
let mockBookings = new Map<string, CaseBooking>()
let bookingSeq = 9_000

/** Reset in-memory state between tests. */
export function resetMockDb(): void {
  db = seedCases()
  caseSeq = 12_351
  entrySeq = 5_000
  docSeq = 5_000
  mockBookings = new Map<string, CaseBooking>()
}

/** A handful of upcoming slots (mock availability — the real tz math lives in the API). */
function mockSlots(): { startUtc: string; endUtc: string }[] {
  const out: { startUtc: string; endUtc: string }[] = []
  const now = new Date()
  for (let d = 1; d <= 4; d++) {
    for (const hourUtc of [13, 14, 17]) {
      const start = new Date(now)
      start.setUTCDate(start.getUTCDate() + d)
      start.setUTCHours(hourUtc, 0, 0, 0)
      out.push({ startUtc: start.toISOString(), endUtc: new Date(start.getTime() + 50 * 60_000).toISOString() })
    }
  }
  return out
}

function unauthorized() {
  return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
}

function notFound() {
  return HttpResponse.json({ error: 'not_found' }, { status: 404 })
}

function isAuthorized(request: Request): boolean {
  const header = request.headers.get('Authorization')
  if (header === null || !header.startsWith('Bearer ')) return false
  const token = header.slice(7)
  // e2e hook: a session stored with this JWT always 401s — exercises the
  // whole session-expired flow (clear, toast, /login?expired=1).
  return token.length > 0 && token !== 'expired-session-jwt'
}

const SEED_CONTACT_NAME = `${seedContact.firstName} ${seedContact.lastName}`

/** Submitter (seed contact) + the account-validated participant picks from the form. */
function participantsFromForm(form: FormData): CaseParticipant[] {
  const submitter = seedAccountContacts.find(
    (c) => c.email.toLowerCase() === seedContact.email.toLowerCase(),
  ) ?? { contactId: 'c-self', name: SEED_CONTACT_NAME, email: seedContact.email }
  const out: CaseParticipant[] = [submitter]
  const raw = form.get('participants')
  if (typeof raw === 'string') {
    try {
      const ids = JSON.parse(raw) as unknown
      if (Array.isArray(ids)) {
        for (const id of ids) {
          const c = seedAccountContacts.find((x) => x.contactId === id)
          if (c && !out.some((p) => p.contactId === c.contactId)) out.push(c)
        }
      }
    } catch {
      // ignore malformed participants in the mock
    }
  }
  return out
}

/** Mock "mine" = the seed contact submitted the case OR is a participant on it. */
function isMine(c: CaseDetail): boolean {
  if (c.submittedBy?.name === SEED_CONTACT_NAME) return true
  return (c.participants ?? []).some((p) => p.email.toLowerCase() === seedContact.email.toLowerCase())
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
    mine: isMine(c),
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
      case 'impersonate-token': {
        // Staff impersonation: writes are attributed to the actor (distinct
        // JWT so the comment handler can mirror the API's rp-side entries).
        const body: AuthCompleteResponse = {
          sessionJwt: MOCK_IMPERSONATED_JWT,
          contact: { ...seedContact, impersonated: true, actorName: 'Devon Staff' },
        }
        return HttpResponse.json(body)
      }
      default: {
        if (!token) {
          return HttpResponse.json(
            { error: 'invalid_link', message: 'This sign-in link isn’t valid.' },
            { status: 401 },
          )
        }
        // Email deep-link tokens carry a return path (e.g. "deeplink:/cases/case-0002").
        const deepLink = token.startsWith('deeplink:') ? token.slice('deeplink:'.length) : undefined
        const body: AuthCompleteResponse = {
          sessionJwt: MOCK_SESSION_JWT,
          contact: seedContact,
          ...(deepLink ? { returnTo: deepLink } : {}),
        }
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
    const mine = db.filter(isMine)
    const mineCounts = {
      open: mine.filter((c) => c.statusGroup === 'open').length,
      closed: mine.filter((c) => c.statusGroup === 'closed').length,
    }
    const cases =
      status === 'all' ? db : db.filter((c) => c.statusGroup === (status as StatusGroup))

    const body: CasesListResponse = {
      cases: cases
        .map(toSummary)
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
      counts,
      mineCounts,
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
      // Submitter is always a participant; add the account-validated picks.
      participants: participantsFromForm(form),
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

  // --- Participant picker: eligible account contacts -----------------------
  http.get('*/v1/client/contacts', ({ request }) => {
    if (!isAuthorized(request)) return unauthorized()
    return HttpResponse.json({ contacts: seedAccountContacts } satisfies AccountContactsResponse)
  }),

  // --- Participants: add / remove ------------------------------------------
  http.post('*/v1/client/cases/:id/participants', async ({ request, params }) => {
    if (!isAuthorized(request)) return unauthorized()
    const found = db.find((c) => c.id === params.id)
    if (!found) return notFound()
    const { contactId } = (await request.json()) as { contactId?: string }
    const contact = seedAccountContacts.find((c) => c.contactId === contactId)
    if (!contact) return notFound() // not an eligible account contact
    found.participants = found.participants ?? []
    if (!found.participants.some((p) => p.contactId === contact.contactId)) {
      found.participants.push(contact)
    }
    return HttpResponse.json({ participant: contact } satisfies AddParticipantResponse, { status: 201 })
  }),

  http.delete('*/v1/client/cases/:id/participants/:contactId', ({ request, params }) => {
    if (!isAuthorized(request)) return unauthorized()
    const found = db.find((c) => c.id === params.id)
    if (!found) return notFound()
    found.participants = (found.participants ?? []).filter((p) => p.contactId !== params.contactId)
    return new HttpResponse(null, { status: 204 })
  }),

  // --- Scheduling a call ---------------------------------------------------
  http.get('*/v1/client/cases/:id/booking', ({ request, params }) => {
    if (!isAuthorized(request)) return unauthorized()
    const found = db.find((c) => c.id === params.id)
    if (!found) return notFound()
    return HttpResponse.json({ booking: mockBookings.get(String(params.id)) ?? null })
  }),

  http.get('*/v1/client/cases/:id/booking/availability', ({ request, params }) => {
    if (!isAuthorized(request)) return unauthorized()
    const found = db.find((c) => c.id === params.id)
    if (!found) return notFound()
    if (found.owner.isQueue) return HttpResponse.json({ error: 'no_owner_mailbox' }, { status: 409 })
    return HttpResponse.json({ slots: mockSlots(), timeZone: 'America/New_York', durationMin: 50 })
  }),

  http.post('*/v1/client/cases/:id/booking', async ({ request, params }) => {
    if (!isAuthorized(request)) return unauthorized()
    const found = db.find((c) => c.id === params.id)
    if (!found) return notFound()
    const { startUtc } = (await request.json()) as { startUtc?: string }
    if (!startUtc) return HttpResponse.json({ error: 'validation_failed' }, { status: 400 })
    bookingSeq += 1
    const booking: CaseBooking = {
      ref: `ref-${bookingSeq}`,
      startUtc,
      endUtc: new Date(new Date(startUtc).getTime() + 50 * 60_000).toISOString(),
      joinUrl: 'https://teams.microsoft.com/l/meetup-join/mock',
    }
    mockBookings.set(String(params.id), booking)
    return HttpResponse.json(booking, { status: 201 })
  }),

  http.post('*/v1/client/cases/:id/booking/cancel', ({ request, params }) => {
    if (!isAuthorized(request)) return unauthorized()
    const found = db.find((c) => c.id === params.id)
    if (!found) return notFound()
    mockBookings.delete(String(params.id))
    return HttpResponse.json({ ok: true })
  }),

  http.post('*/v1/client/cases/:id/booking/reschedule', async ({ request, params }) => {
    if (!isAuthorized(request)) return unauthorized()
    const found = db.find((c) => c.id === params.id)
    if (!found) return notFound()
    const existing = mockBookings.get(String(params.id))
    if (!existing) return notFound()
    const { startUtc } = (await request.json()) as { startUtc?: string }
    if (!startUtc) return HttpResponse.json({ error: 'validation_failed' }, { status: 400 })
    const updated: CaseBooking = {
      ...existing,
      startUtc,
      endUtc: new Date(new Date(startUtc).getTime() + 50 * 60_000).toISOString(),
    }
    mockBookings.set(String(params.id), updated)
    return HttpResponse.json(updated)
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

    // Impersonated sessions mirror the API: attributed to the actor, rp-side.
    const impersonated = request.headers.get('Authorization') === `Bearer ${MOCK_IMPERSONATED_JWT}`
    const entry: TimelineEntry = {
      id: nextEntryId(),
      kind: 'comment',
      at: new Date().toISOString(),
      side: impersonated ? 'rp' : 'client',
      author: {
        name: impersonated ? 'Devon Staff' : `${seedContact.firstName} ${seedContact.lastName}`,
      },
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
