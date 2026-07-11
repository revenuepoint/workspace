import { describe, expect, it } from 'vitest'
import { priorityLabelFor } from '@/lib/priority'

describe('priorityLabelFor', () => {
  it('strips the internal ordinal to a clean client label', () => {
    expect(priorityLabelFor('5. Blocker')).toBe('Blocker')
    expect(priorityLabelFor('4. High')).toBe('High')
    expect(priorityLabelFor('3. Medium')).toBe('Medium')
    expect(priorityLabelFor('2. Low')).toBe('Low')
    expect(priorityLabelFor('1. Lowest')).toBe('Lowest')
  })

  it('handles the alternate top band label', () => {
    expect(priorityLabelFor('5. High')).toBe('High')
  })

  it('strips the ordinal from an unmapped value rather than leaking the number', () => {
    expect(priorityLabelFor('6. Catastrophic')).toBe('Catastrophic')
  })

  it('returns null for blank/null', () => {
    expect(priorityLabelFor(null)).toBeNull()
    expect(priorityLabelFor(undefined)).toBeNull()
    expect(priorityLabelFor('')).toBeNull()
    expect(priorityLabelFor('   ')).toBeNull()
  })
})
