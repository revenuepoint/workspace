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
