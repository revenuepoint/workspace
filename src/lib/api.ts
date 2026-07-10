import { toast } from 'sonner'
import { RETURN_TO_KEY, useSessionStore } from '@/stores/session'
import type {
  AddCommentResponse,
  ApiErrorBody,
  AuthCompleteResponse,
  AuthStartResponse,
  CaseDetail,
  CaseListFilter,
  CasesListResponse,
  CreatableRecordType,
  CreateCaseResponse,
  UploadFilesResponse,
} from '@/lib/api-types'

/**
 * The ONLY fetch path in the app. Every request goes through `request()`:
 * it attaches the bearer token, captures `X-Session-Refresh` rotations, and
 * funnels 401s into the single session-expired flow.
 */

// Default '' = same-origin: the Heroku api app serves both the SPA and /v1/*,
// so an unset env in a prod build does the right thing. Dev overrides live in
// .env.development / .env.local; vitest pins an absolute base (vitest.config).
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message?: string) {
    super(message ?? code)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function handleSessionExpired(): void {
  const { jwt, expireSession } = useSessionStore.getState()
  // Parallel queries can all 401 at once — only the first one gets to
  // clear the session and toast.
  if (!jwt) return
  const here = window.location.pathname + window.location.search
  if (here.startsWith('/cases')) {
    try {
      window.localStorage.setItem(RETURN_TO_KEY, here)
    } catch {
      // non-fatal
    }
  }
  // No navigation here — AuthGate owns the redirect. It sees the expired
  // flag and lands on /login?expired=1; a second navigation source would
  // race the gate's own <Navigate> and lose the explanation.
  expireSession()
  toast.error('Your session expired. Sign in again to keep going.')
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  /** JSON body — sets Content-Type. Mutually exclusive with formData. */
  json?: unknown
  /** Multipart body — browser sets the boundary header itself. */
  formData?: FormData
  /** false for the auth endpoints, where a 401 is a link problem, not an expired session. */
  auth?: boolean
  /** Caller cancellation (TanStack Query hands queries its own signal). */
  signal?: AbortSignal
  /** false disables the 30s guard (downloads; multipart uploads are always exempt). */
  timeout?: boolean
}

const REQUEST_TIMEOUT_MS = 30_000

/** Prefer combining; on browsers without AbortSignal.any, caller cancellation wins. */
function combineSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (a && b) return typeof AbortSignal.any === 'function' ? AbortSignal.any([a, b]) : a
  return a ?? b
}

async function rawRequest(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', json, formData, auth = true, signal: callerSignal, timeout = true } = options

  const headers = new Headers()
  if (json !== undefined) headers.set('Content-Type', 'application/json')
  if (auth) {
    const jwt = useSessionStore.getState().jwt
    if (jwt) headers.set('Authorization', `Bearer ${jwt}`)
  }

  // A hung request must not spin forever — 30s guard on JSON traffic.
  // Uploads (and downloads via timeout: false) can legitimately run longer.
  const guard = timeout && formData === undefined ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: json !== undefined ? JSON.stringify(json) : formData,
      signal: combineSignals(callerSignal, guard),
    })
  } catch (error) {
    // Query cancellations pass through untouched (TanStack swallows its own
    // aborts); real failures become typed ApiErrors for the UI error states.
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    throw new ApiError(
      0,
      timedOut ? 'timeout' : 'network_error',
      timedOut ? 'The request timed out.' : 'We couldn’t reach RevenuePoint — check your connection.',
    )
  }

  // Sliding sessions: the server may rotate the JWT on any response.
  const refreshedJwt = response.headers.get('X-Session-Refresh')
  if (refreshedJwt && useSessionStore.getState().jwt) {
    useSessionStore.getState().setJwt(refreshedJwt)
  }

  if (response.status === 401 && auth) {
    handleSessionExpired()
    throw new ApiError(401, 'unauthorized', 'Your session expired.')
  }

  if (!response.ok) {
    let code = 'request_failed'
    let message: string | undefined
    try {
      const body = (await response.json()) as ApiErrorBody
      if (body.error) code = body.error
      message = body.message
    } catch {
      // Non-JSON error body — keep the generic code.
    }
    throw new ApiError(response.status, code, message)
  }

  return response
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await rawRequest(path, options)
  return (await response.json()) as T
}

export interface CreateCaseInput {
  recordType: CreatableRecordType
  subject: string
  description: string
  impact?: string
  urgency?: string
  businessJustification?: string
  files: File[]
}

/** Multipart helper — shared by case create and file upload. */
export function buildMultipart(fields: Record<string, string | undefined>, files: File[]): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== '') formData.append(key, value)
  }
  for (const file of files) {
    formData.append('files', file, file.name)
  }
  return formData
}

export const api = {
  authStart(email: string): Promise<AuthStartResponse> {
    return request('/v1/client/auth/start', { method: 'POST', json: { email }, auth: false })
  },

  authComplete(token: string): Promise<AuthCompleteResponse> {
    return request('/v1/client/auth/complete', { method: 'POST', json: { token }, auth: false })
  },

  listCases(status: CaseListFilter, init?: { signal?: AbortSignal }): Promise<CasesListResponse> {
    return request(`/v1/client/cases?status=${status}`, { signal: init?.signal })
  },

  getCase(id: string, init?: { signal?: AbortSignal }): Promise<CaseDetail> {
    return request(`/v1/client/cases/${encodeURIComponent(id)}`, { signal: init?.signal })
  },

  createCase(input: CreateCaseInput): Promise<CreateCaseResponse> {
    const formData = buildMultipart(
      {
        recordType: input.recordType,
        subject: input.subject,
        description: input.description,
        impact: input.impact,
        urgency: input.urgency,
        businessJustification: input.businessJustification,
      },
      input.files,
    )
    return request('/v1/client/cases', { method: 'POST', formData })
  },

  addComment(caseId: string, body: string): Promise<AddCommentResponse> {
    return request(`/v1/client/cases/${encodeURIComponent(caseId)}/comments`, {
      method: 'POST',
      json: { body },
    })
  },

  uploadCaseFiles(caseId: string, files: File[]): Promise<UploadFilesResponse> {
    return request(`/v1/client/cases/${encodeURIComponent(caseId)}/files`, {
      method: 'POST',
      formData: buildMultipart({}, files),
    })
  },

  async downloadCaseFile(caseId: string, contentDocumentId: string): Promise<Blob> {
    // No timeout: a 10 MB file on a slow link can honestly take minutes.
    const response = await rawRequest(
      `/v1/client/cases/${encodeURIComponent(caseId)}/files/${encodeURIComponent(contentDocumentId)}/download`,
      { timeout: false },
    )
    return response.blob()
  },
}

/** Fetch a case file and hand it to the browser as a download. */
export async function saveCaseFile(caseId: string, contentDocumentId: string, title: string): Promise<void> {
  const blob = await api.downloadCaseFile(caseId, contentDocumentId)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = title
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
