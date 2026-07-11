import { describe, expect, it } from 'vitest'
import { renderMarkdown, sanitizeEmailHtml } from '@/lib/sanitize'

describe('sanitizeEmailHtml', () => {
  it('strips scripts and event handlers', () => {
    const dirty = '<p onclick="steal()">hi</p><script>alert(1)</script><img src="x" onerror="alert(1)">'
    const clean = sanitizeEmailHtml(dirty)

    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('onerror')
    expect(clean).toContain('hi')
  })

  it('strips javascript: URLs', () => {
    expect(sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:')
  })

  it('forces links to open in a new tab without an opener', () => {
    const clean = sanitizeEmailHtml('<a href="https://example.com">the docs</a>')

    expect(clean).toContain('target="_blank"')
    expect(clean).toContain('rel="noopener noreferrer"')
    expect(clean).toContain('href="https://example.com"')
  })

  it('keeps the formatting tags email bodies actually use', () => {
    const clean = sanitizeEmailHtml('<p>Hi</p><ul><li><strong>bold</strong></li></ul><blockquote>q</blockquote>')

    expect(clean).toContain('<ul>')
    expect(clean).toContain('<strong>')
    expect(clean).toContain('<blockquote>')
  })
})

describe('renderMarkdown', () => {
  it('renders common Markdown to HTML', () => {
    const html = renderMarkdown('This is **bold** and a list:\n\n- one\n- two')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<li>one</li>')
    expect(html).toContain('<li>two</li>')
  })

  it('turns a single newline into a line break', () => {
    expect(renderMarkdown('line one\nline two')).toContain('<br>')
  })

  it('sanitizes embedded HTML and dangerous links', () => {
    const html = renderMarkdown('normal <script>alert(1)</script> [x](javascript:alert(1))')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('javascript:')
  })

  it('hardens rendered links to open safely in a new tab', () => {
    const html = renderMarkdown('[docs](https://example.com)')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })
})
