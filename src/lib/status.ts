/**
 * Single source of truth for case status → client-facing label + chip
 * treatment. Raw Salesforce status values arrive on the wire; everything
 * the UI shows goes through this file. NO green anywhere — on-track and
 * positive signals use navy (brand rule).
 */

export type StatusKey =
  | 'received'
  | 'inReview'
  | 'inProgress'
  | 'inTesting'
  | 'waitingOnYou'
  | 'waitingOnVendor'
  | 'onHold'
  | 'deployed'
  | 'closed'
  | 'unknown'

const RAW_STATUS_TO_KEY: Record<string, StatusKey> = {
  // Received
  new: 'received',
  // In review
  'in review': 'inReview',
  // In progress bucket
  'in progress': 'inProgress',
  'selected for development': 'inProgress',
  'in development': 'inProgress',
  'awaiting deployment': 'inProgress',
  // In testing
  uat: 'inTesting',
  // Waiting states
  'waiting on customer': 'waitingOnYou',
  'waiting on you': 'waitingOnYou',
  'waiting on vendor': 'waitingOnVendor',
  'on hold': 'onHold',
  // Terminal-ish
  deployed: 'deployed',
  closed: 'closed',
}

export const STATUS_LABELS: Record<Exclude<StatusKey, 'unknown'>, string> = {
  received: 'Received',
  inReview: 'In review',
  inProgress: 'In progress',
  inTesting: 'In testing',
  waitingOnYou: 'Waiting on you',
  waitingOnVendor: 'Waiting on vendor',
  onHold: 'On hold',
  deployed: 'Deployed',
  closed: 'Closed',
}

export function statusKeyFor(rawStatus: string): StatusKey {
  return RAW_STATUS_TO_KEY[rawStatus.trim().toLowerCase()] ?? 'unknown'
}

/** Client-facing label for a raw status. Unknown raw values pass through untouched. */
export function statusLabelFor(rawStatus: string): string {
  const key = statusKeyFor(rawStatus)
  return key === 'unknown' ? rawStatus : STATUS_LABELS[key]
}

/**
 * Chip treatment per status key: tinted bg + darker text + subtle border.
 * Amber is reserved for "Waiting on you" (the only your-move signal);
 * Deployed is the navy positive.
 */
const CHIP_CLASSES: Record<StatusKey, string> = {
  received: 'bg-bone/60 text-inkMid border-rule/80',
  inReview: 'bg-navyTint/60 text-navySoft border-navySoft/30',
  inProgress: 'bg-navyTint text-navy border-navy/30',
  inTesting: 'bg-navyTint/80 text-navySoft border-navy/20',
  waitingOnYou: 'bg-amber/15 text-amber border-amber/40',
  waitingOnVendor: 'bg-paper text-mute border-rule/80',
  onHold: 'bg-paper text-inkMid border-rule/80',
  deployed: 'bg-navy text-snow border-navy',
  closed: 'bg-paper text-mute border-ruleSoft',
  unknown: 'bg-bone/60 text-inkMid border-rule/80',
}

export function statusChipClassesFor(rawStatus: string): string {
  return CHIP_CLASSES[statusKeyFor(rawStatus)]
}

// ---------------------------------------------------------------------------
// Case path — the ordered stages a case moves through, for the detail stepper.
// Support cases skip the dev pipeline; problem/change run the full length.
// Pauses (waiting-on-you/vendor, on hold) replace the raw status in Salesforce
// so the underlying stage is unknown — they render as a paused "In progress".
// ---------------------------------------------------------------------------

export type PathStageKey = 'received' | 'inReview' | 'inProgress' | 'inTesting' | 'shipped'

interface PathStage {
  key: PathStageKey
  label: string
}

const FULL_PATH: PathStage[] = [
  { key: 'received', label: 'Received' },
  { key: 'inReview', label: 'In review' },
  { key: 'inProgress', label: 'In progress' },
  { key: 'inTesting', label: 'In testing' },
  { key: 'shipped', label: 'Deployed' },
]

const SUPPORT_PATH: PathStage[] = [
  { key: 'received', label: 'Received' },
  { key: 'inReview', label: 'In review' },
  { key: 'inProgress', label: 'In progress' },
  { key: 'shipped', label: 'Resolved' },
]

/** Which status keys land on which stage index within a path (see resolver). */
const STAGE_FOR_STATUS: Partial<Record<StatusKey, PathStageKey>> = {
  received: 'received',
  inReview: 'inReview',
  inProgress: 'inProgress',
  inTesting: 'inTesting',
  deployed: 'shipped',
  closed: 'shipped',
}

export interface CasePathState {
  stages: PathStage[]
  /** Index of the case's current stage within `stages`. */
  currentIndex: number
  /** Paused cases sit on their current stage but can't advance. */
  paused: 'you' | 'vendor' | 'hold' | null
  /** Closed/deployed — the whole path is behind the case. */
  done: boolean
}

/**
 * Resolve the stepper state for a case. Returns null for statuses with no
 * meaningful place on the path (unknown), so the caller can omit the stepper.
 */
export function casePathFor(rawStatus: string, recordType: string): CasePathState | null {
  const key = statusKeyFor(rawStatus)
  if (key === 'unknown') return null

  const stages = recordType === 'support' || recordType === 'other' ? SUPPORT_PATH : FULL_PATH

  const paused: CasePathState['paused'] =
    key === 'waitingOnYou' ? 'you' : key === 'waitingOnVendor' ? 'vendor' : key === 'onHold' ? 'hold' : null

  // Pauses replace the underlying stage — they almost always happen mid-flight,
  // so anchor them to "In progress" rather than inventing a stage.
  const stageKey: PathStageKey = paused ? 'inProgress' : (STAGE_FOR_STATUS[key] ?? 'received')

  let currentIndex = stages.findIndex((s) => s.key === stageKey)
  // A pipeline-only stage (e.g. inTesting) on a support case falls back to the
  // last available step so the stepper never points past its own end.
  if (currentIndex === -1) currentIndex = stages.length - 1

  return { stages, currentIndex, paused, done: key === 'closed' || key === 'deployed' }
}
