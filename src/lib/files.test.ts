import { describe, expect, it } from 'vitest'
import { previewKindFor } from '@/lib/files'

describe('previewKindFor', () => {
  it('classifies previewable types', () => {
    expect(previewKindFor('png')).toBe('image')
    expect(previewKindFor('JPG')).toBe('image') // case-insensitive
    expect(previewKindFor('pdf')).toBe('pdf')
    expect(previewKindFor('txt')).toBe('text')
    expect(previewKindFor('json')).toBe('text')
    expect(previewKindFor('csv')).toBe('spreadsheet')
    expect(previewKindFor('xlsx')).toBe('spreadsheet')
    expect(previewKindFor('docx')).toBe('word')
  })

  it('returns none for types with no inline preview (download-only)', () => {
    for (const ext of ['zip', 'doc', 'ppt', 'pptx', 'eml', 'msg', '']) {
      expect(previewKindFor(ext)).toBe('none')
    }
  })
})
