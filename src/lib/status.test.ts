import { describe, expect, it } from 'vitest'
import { casePathFor, statusChipClassesFor, statusKeyFor, statusLabelFor } from '@/lib/status'

describe('status mapping (single source of truth)', () => {
  it('maps New to Received', () => {
    expect(statusKeyFor('New')).toBe('received')
    expect(statusLabelFor('New')).toBe('Received')
  })

  it('maps In Review to In review', () => {
    expect(statusLabelFor('In Review')).toBe('In review')
  })

  it('collapses the whole development pipeline into In progress', () => {
    for (const raw of ['In Progress', 'Selected for Development', 'In Development', 'Awaiting Deployment']) {
      expect(statusKeyFor(raw)).toBe('inProgress')
      expect(statusLabelFor(raw)).toBe('In progress')
    }
  })

  // The org's ACTUAL Case.Status picklist values — these are what the API
  // echoes as raw `status`. Regression guard for the literal-mismatch bug.
  it('maps the real org status literals (not the SPA shorthand)', () => {
    expect(statusKeyFor('In UAT')).toBe('inTesting')
    expect(statusLabelFor('In UAT')).toBe('In testing')
    expect(statusKeyFor('Waiting for Customer')).toBe('waitingOnYou')
    expect(statusLabelFor('Waiting for Customer')).toBe('Waiting on you')
    expect(statusKeyFor('Waiting for Vendor')).toBe('waitingOnVendor')
    expect(statusLabelFor('Waiting for Vendor')).toBe('Waiting on vendor')
    expect(statusKeyFor('Blocked / On Hold')).toBe('onHold')
    expect(statusLabelFor('Blocked / On Hold')).toBe('On hold')
  })

  it('maps the remaining statuses', () => {
    expect(statusLabelFor('Deployed')).toBe('Deployed')
    expect(statusLabelFor('Closed')).toBe('Closed')
  })

  it('is case- and whitespace-insensitive', () => {
    expect(statusLabelFor('  in review ')).toBe('In review')
    expect(statusLabelFor('WAITING FOR CUSTOMER')).toBe('Waiting on you')
  })

  it('passes unknown raw statuses through untouched', () => {
    expect(statusKeyFor('Escalated to Legal')).toBe('unknown')
    expect(statusLabelFor('Escalated to Legal')).toBe('Escalated to Legal')
  })

  it('gives Waiting on you the amber treatment for the real org literal', () => {
    // The bug: 'Waiting for Customer' fell through to gray, losing amber.
    expect(statusChipClassesFor('Waiting for Customer')).toContain('amber')
    // Positive/on-track signals use navy, never green.
    expect(statusChipClassesFor('Deployed')).toContain('navy')
    for (const raw of [
      'New',
      'In Review',
      'In Progress',
      'In UAT',
      'Waiting for Vendor',
      'Blocked / On Hold',
      'Deployed',
      'Closed',
    ]) {
      expect(statusChipClassesFor(raw)).not.toMatch(/green|emerald|lime/)
      // And none of these fall through to the neutral "unknown" gray.
      expect(statusKeyFor(raw)).not.toBe('unknown')
    }
  })
})

describe('casePathFor (detail stepper)', () => {
  it('gives problem/change the full 5-step path', () => {
    const path = casePathFor('In UAT', 'problem')
    expect(path?.stages.map((s) => s.label)).toEqual([
      'Received',
      'In review',
      'In progress',
      'In testing',
      'Deployed',
    ])
    expect(path?.currentIndex).toBe(3) // In UAT → In testing
    expect(path?.paused).toBeNull()
  })

  it('gives support a 4-step path that skips the dev pipeline', () => {
    const path = casePathFor('In Progress', 'support')
    expect(path?.stages.map((s) => s.label)).toEqual(['Received', 'In review', 'In progress', 'Resolved'])
    expect(path?.currentIndex).toBe(2)
  })

  it('anchors a paused case to In progress and flags the reason (real org literals)', () => {
    const you = casePathFor('Waiting for Customer', 'problem')
    expect(you?.currentIndex).toBe(2)
    expect(you?.paused).toBe('you')

    expect(casePathFor('Blocked / On Hold', 'change')?.paused).toBe('hold')
    expect(casePathFor('Waiting for Vendor', 'change')?.paused).toBe('vendor')
  })

  it('renders the stepper for a Support case in a paused state (the reported bug)', () => {
    // Support cases most often sit in Waiting for Customer / Blocked / On Hold —
    // exactly the literals that used to fall through to null (no stepper).
    expect(casePathFor('Waiting for Customer', 'support')).not.toBeNull()
    expect(casePathFor('Blocked / On Hold', 'support')).not.toBeNull()
  })

  it('marks closed/deployed cases done', () => {
    expect(casePathFor('Closed', 'support')?.done).toBe(true)
    expect(casePathFor('Deployed', 'problem')?.done).toBe(true)
  })

  it('returns null for an unknown status so the stepper is omitted', () => {
    expect(casePathFor('Escalated to Legal', 'problem')).toBeNull()
  })

  it('never points a support case past its own last step', () => {
    // A pipeline-only status on a support case clamps to the final step.
    const path = casePathFor('In UAT', 'support')
    expect(path?.currentIndex).toBe((path?.stages.length ?? 0) - 1)
  })
})
