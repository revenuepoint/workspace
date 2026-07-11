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

  it('maps UAT to In testing', () => {
    expect(statusLabelFor('UAT')).toBe('In testing')
  })

  it('maps Waiting on Customer to Waiting on you', () => {
    expect(statusKeyFor('Waiting on Customer')).toBe('waitingOnYou')
    expect(statusLabelFor('Waiting on Customer')).toBe('Waiting on you')
  })

  it('maps the remaining statuses', () => {
    expect(statusLabelFor('Waiting on Vendor')).toBe('Waiting on vendor')
    expect(statusLabelFor('On Hold')).toBe('On hold')
    expect(statusLabelFor('Deployed')).toBe('Deployed')
    expect(statusLabelFor('Closed')).toBe('Closed')
  })

  it('is case- and whitespace-insensitive', () => {
    expect(statusLabelFor('  in review ')).toBe('In review')
    expect(statusLabelFor('WAITING ON CUSTOMER')).toBe('Waiting on you')
  })

  it('passes unknown raw statuses through untouched', () => {
    expect(statusKeyFor('Escalated to Legal')).toBe('unknown')
    expect(statusLabelFor('Escalated to Legal')).toBe('Escalated to Legal')
  })

  it('gives Waiting on you the amber treatment and keeps everything else green-free', () => {
    expect(statusChipClassesFor('Waiting on Customer')).toContain('amber')
    // Positive/on-track signals use navy, never green.
    expect(statusChipClassesFor('Deployed')).toContain('navy')
    for (const raw of ['New', 'In Review', 'In Progress', 'UAT', 'Deployed', 'Closed', 'On Hold']) {
      expect(statusChipClassesFor(raw)).not.toMatch(/green|emerald|lime/)
    }
  })
})

describe('casePathFor (detail stepper)', () => {
  it('gives problem/change the full 5-step path', () => {
    const path = casePathFor('UAT', 'problem')
    expect(path?.stages.map((s) => s.label)).toEqual([
      'Received',
      'In review',
      'In progress',
      'In testing',
      'Deployed',
    ])
    expect(path?.currentIndex).toBe(3) // UAT → In testing
    expect(path?.paused).toBeNull()
  })

  it('gives support a 4-step path that skips the dev pipeline', () => {
    const path = casePathFor('In Progress', 'support')
    expect(path?.stages.map((s) => s.label)).toEqual(['Received', 'In review', 'In progress', 'Resolved'])
    expect(path?.currentIndex).toBe(2)
  })

  it('anchors a paused case to In progress and flags the reason', () => {
    const you = casePathFor('Waiting on Customer', 'problem')
    expect(you?.currentIndex).toBe(2)
    expect(you?.paused).toBe('you')

    expect(casePathFor('On Hold', 'change')?.paused).toBe('hold')
    expect(casePathFor('Waiting on Vendor', 'change')?.paused).toBe('vendor')
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
    const path = casePathFor('UAT', 'support')
    expect(path?.currentIndex).toBe((path?.stages.length ?? 0) - 1)
  })
})
