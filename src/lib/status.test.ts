import { describe, expect, it } from 'vitest'
import { statusChipClassesFor, statusKeyFor, statusLabelFor } from '@/lib/status'

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
