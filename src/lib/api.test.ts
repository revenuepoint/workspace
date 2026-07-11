import { beforeEach, describe, expect, it, vi } from 'vitest'
import { delay, http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { api, ApiError, buildMultipart } from '@/lib/api'
import { SESSION_STORAGE_KEY, useSessionStore } from '@/stores/session'
import { seedContact, MOCK_SESSION_JWT } from '@/mocks/fixtures'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

const { toast } = await import('sonner')

function signIn() {
  useSessionStore.getState().login(MOCK_SESSION_JWT, seedContact)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('api client', () => {
  it('attaches the bearer token to authenticated requests', async () => {
    signIn()
    let authHeader: string | null = null
    server.use(
      http.get('*/v1/client/cases', ({ request }) => {
        authHeader = request.headers.get('Authorization')
        return HttpResponse.json({ cases: [], counts: { open: 0, closed: 0 } })
      }),
    )

    await api.listCases('open')
    expect(authHeader).toBe(`Bearer ${MOCK_SESSION_JWT}`)
  })

  it('captures X-Session-Refresh and rotates the stored jwt', async () => {
    signIn()
    server.use(
      http.get('*/v1/client/cases', () =>
        HttpResponse.json(
          { cases: [], counts: { open: 0, closed: 0 } },
          { headers: { 'X-Session-Refresh': 'rotated-jwt-42' } },
        ),
      ),
    )

    await api.listCases('open')

    expect(useSessionStore.getState().jwt).toBe('rotated-jwt-42')
    const persisted = JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY)!) as {
      jwt: string
      contact: { email: string }
    }
    expect(persisted.jwt).toBe('rotated-jwt-42')
    expect(persisted.contact.email).toBe(seedContact.email)
  })

  it('on 401: clears the session, marks it expired, and toasts', async () => {
    signIn()
    server.use(
      http.get('*/v1/client/cases', () =>
        HttpResponse.json({ error: 'unauthorized' }, { status: 401 }),
      ),
    )

    await expect(api.listCases('open')).rejects.toMatchObject({ status: 401, code: 'unauthorized' })

    expect(useSessionStore.getState().jwt).toBeNull()
    expect(useSessionStore.getState().contact).toBeNull()
    // AuthGate reads this flag and redirects to /login?expired=1.
    expect(useSessionStore.getState().expired).toBe(true)
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    expect(toast.error).toHaveBeenCalledWith('Your session expired. Sign in again to keep going.')
  })

  it('only runs the session-expired flow once when parallel requests 401', async () => {
    signIn()
    server.use(
      http.get('*/v1/client/cases', () =>
        HttpResponse.json({ error: 'unauthorized' }, { status: 401 }),
      ),
    )

    const results = await Promise.allSettled([api.listCases('open'), api.listCases('all')])
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('does NOT treat auth/complete 401s as an expired session', async () => {
    await expect(api.authComplete('expired-token')).rejects.toMatchObject({
      status: 401,
      code: 'expired_link',
    })
    expect(useSessionStore.getState().expired).toBe(false)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('surfaces error codes from non-401 failures', async () => {
    signIn()
    await expect(api.getCase('case-does-not-exist')).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
    })
    await expect(api.getCase('nope')).rejects.toBeInstanceOf(ApiError)
  })

  it('lets caller cancellation through without triggering the session-expired flow', async () => {
    signIn()
    server.use(
      http.get('*/v1/client/cases', async () => {
        await delay(5_000)
        return HttpResponse.json({ cases: [], counts: { open: 0, closed: 0 } })
      }),
    )

    const controller = new AbortController()
    const promise = api.listCases('open', { signal: controller.signal })
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(useSessionStore.getState().jwt).toBe(MOCK_SESSION_JWT)
    expect(useSessionStore.getState().expired).toBe(false)
  })

  it('builds multipart bodies the contract expects (fields + files, empties dropped)', () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    const formData = buildMultipart({ subject: 'Hi', impact: undefined, urgency: '' }, [file])

    expect(formData.get('subject')).toBe('Hi')
    expect(formData.has('impact')).toBe(false)
    expect(formData.has('urgency')).toBe(false)
    const files = formData.getAll('files')
    expect(files).toHaveLength(1)
    expect((files[0] as File).name).toBe('notes.txt')
  })

  it('multipart XHR path carries the bearer and rotates X-Session-Refresh', async () => {
    signIn()
    let authHeader: string | null = null
    server.use(
      http.post('*/v1/client/cases/:id/files', ({ request }) => {
        authHeader = request.headers.get('Authorization')
        return HttpResponse.json(
          { files: [{ name: 'notes.txt', ok: true }] },
          { status: 201, headers: { 'X-Session-Refresh': 'rotated-jwt-99' } },
        )
      }),
    )

    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    const result = await api.uploadCaseFiles('case-0001', [file])

    expect(result.files[0]).toMatchObject({ name: 'notes.txt', ok: true })
    expect(authHeader).toBe(`Bearer ${MOCK_SESSION_JWT}`)
    expect(useSessionStore.getState().jwt).toBe('rotated-jwt-99')
  })

  it('multipart XHR path maps errors to ApiError and routes 401s through expiry', async () => {
    signIn()
    const file = new File(['x'], 'x.txt', { type: 'text/plain' })

    server.use(
      http.post('*/v1/client/cases/:id/files', () =>
        HttpResponse.json({ error: 'file_rejected', message: 'bad type' }, { status: 415 }),
      ),
    )
    await expect(api.uploadCaseFiles('case-0001', [file])).rejects.toMatchObject({
      status: 415,
      code: 'file_rejected',
    })

    server.use(
      http.post('*/v1/client/cases/:id/files', () =>
        HttpResponse.json({ error: 'unauthorized' }, { status: 401 }),
      ),
    )
    await expect(api.uploadCaseFiles('case-0001', [file])).rejects.toMatchObject({ status: 401 })
    expect(useSessionStore.getState().jwt).toBeNull()
    expect(useSessionStore.getState().expired).toBe(true)
  })

  it('creates a case through the multipart endpoint', async () => {
    signIn()
    const file = new File(['col_a,col_b'], 'export.csv', { type: 'text/csv' })
    const result = await api.createCase({
      recordType: 'problem',
      subject: 'Webhook retries fail',
      description: 'Retries started failing on Friday.',
      impact: 'Significant / Large',
      urgency: 'High',
      files: [file],
    })

    expect(result.caseNumber).toMatch(/^\d{8}$/)
    expect(result.files).toEqual([{ name: 'export.csv', ok: true }])

    const detail = await api.getCase(result.id)
    expect(detail.subject).toBe('Webhook retries fail')
    expect(detail.statusLabel).toBe('Received')
    expect(detail.files).toHaveLength(1)
  })
})
