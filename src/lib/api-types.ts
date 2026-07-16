/**
 * Frozen API contract types for the RevenuePoint Workspace client API (v1).
 * These mirror the middleware contract exactly — do not extend or reshape
 * them client-side. If the server contract changes, it changes here first.
 */

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface Contact {
  firstName: string
  lastName: string
  email: string
  accountId: string
  accountName: string
  /** Present (true) on staff impersonation sessions — writes are attributed to the actor. */
  impersonated?: boolean
  /** Impersonation actor display name (the staff member acting). */
  actorName?: string
}

/** POST /v1/client/auth/start — always 200 (no account enumeration). */
export interface AuthStartResponse {
  ok: true
}

/** POST /v1/client/auth/complete — 200. */
export interface AuthCompleteResponse {
  sessionJwt: string
  contact: Contact
  /** Present for email deep-links: the in-app path to land on (e.g. "/cases/…"). */
  returnTo?: string
}

export type AuthCompleteErrorCode = 'expired_link' | 'invalid_link' | 'link_already_used'

/** POST /v1/client/auth/complete — 401 body. */
export interface AuthCompleteError {
  error: AuthCompleteErrorCode
  message: string
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export type StatusGroup = 'open' | 'closed'
export type CaseRecordType = 'support' | 'problem' | 'change' | 'other'
/** Record types a client can create (no 'other'). */
export type CreatableRecordType = Exclude<CaseRecordType, 'other'>
export type CaseListFilter = 'open' | 'closed' | 'all'

export interface CaseSummary {
  id: string
  caseNumber: string
  subject: string
  status: string
  statusLabel: string
  statusGroup: StatusGroup
  waitingOnYou: boolean
  recordType: CaseRecordType
  recordTypeLabel: string
  createdAt: string
  lastActivityAt: string
  submittedBy: { name: string } | null
  /** True when the signed-in contact is the case's primary contact ("mine"). */
  mine?: boolean
  /**
   * Sensitive case — visible only to the case contact and participants. Cases
   * you're not on never appear at all, so true here always means "yours".
   */
  sensitive?: boolean
}

/** GET /v1/client/cases?status=open|closed|all — 200. */
export interface CasesListResponse {
  cases: CaseSummary[]
  counts: { open: number; closed: number }
  /** Counts restricted to the signed-in contact's own cases (the default view). */
  mineCounts?: { open: number; closed: number }
}

export type TimelineKind = 'comment' | 'email' | 'status' | 'file' | 'created'
export type TimelineSide = 'client' | 'rp' | 'system'

export interface FileMeta {
  contentDocumentId: string
  title: string
  extension: string
  sizeBytes: number
  uploadedAt: string
  uploadedBy: 'client' | 'rp'
}

export interface TimelineEntry {
  id: string
  kind: TimelineKind
  at: string
  side: TimelineSide
  author?: { name: string }
  bodyText?: string
  bodyHtml?: string
  emailSubject?: string
  status?: { fromLabel: string; toLabel: string }
  file?: FileMeta
}

/** A case participant (CC'd colleague) — a contact linked via CaseContactLink__c. */
export interface CaseParticipant {
  contactId: string
  name: string
  email: string
}

/** GET /v1/client/cases/:id — 200. */
export interface CaseDetail extends CaseSummary {
  description: string
  lastModifiedAt: string
  owner: { name: string; isQueue: boolean }
  /** Raw SF values; the SPA maps them to client-facing labels. Null when blank. */
  urgency?: string | null
  priority?: string | null
  participants?: CaseParticipant[]
  timeline: TimelineEntry[]
  files: FileMeta[]
}

/** GET /v1/client/contacts — eligible colleagues at the account (participant picker). */
export interface AccountContactsResponse {
  contacts: CaseParticipant[]
}

/** POST /v1/client/cases/:id/participants — 201. */
export interface AddParticipantResponse {
  participant: CaseParticipant
}

// ---------------------------------------------------------------------------
// Scheduling a call (Case Escalation Call, on the owner's calendar)
// ---------------------------------------------------------------------------

/** An open slot — absolute UTC instants; the UI renders them in the viewer's local zone. */
export interface AvailabilitySlot {
  startUtc: string
  endUtc: string
}

/** GET /v1/client/cases/:id/booking/availability — 200. */
export interface AvailabilityResponse {
  slots: AvailabilitySlot[]
  /** IANA zone the slots were computed in (the host's) — for reference only. */
  timeZone: string
  durationMin: number
}

/** A booked call. `ref` is the signed capability token for cancel/reschedule. */
export interface CaseBooking {
  ref: string
  startUtc: string
  endUtc: string
  joinUrl: string | null
}

/** GET /v1/client/cases/:id/booking — the case's current upcoming call (or null). */
export interface CaseBookingResponse {
  booking: CaseBooking | null
}

/** POST /v1/client/cases (multipart) — 201. */
export interface CreateCaseResponse {
  id: string
  caseNumber: string
  files: Array<{ name: string; ok: boolean; error?: string }>
}

/** POST /v1/client/cases/:id/comments — 201. */
export interface AddCommentResponse {
  entry: TimelineEntry
}

/** POST /v1/client/cases/:id/files (multipart) — 201. */
export interface UploadFilesResponse {
  files: Array<{ name: string; ok: boolean; error?: string; file?: FileMeta }>
}

/** Generic authenticated error bodies. */
export interface ApiErrorBody {
  error: string
  message?: string
}
