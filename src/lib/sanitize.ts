import DOMPurify from 'dompurify'
import { Marked } from 'marked'

/**
 * The single sanitize path for rich content the app renders as HTML:
 * server-provided email bodies (timeline) and client-authored case
 * descriptions (rendered from Markdown). Beyond the DOMPurify html profile,
 * links are forced to open in a new tab with rel=noopener — a click inside
 * this content must never navigate the signed-in SPA away or hand the target
 * page a window handle.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

/** Generic HTML sanitize — e.g. the SheetJS-generated spreadsheet table. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

// GFM for tables/strikethrough; breaks:true so a single newline is a <br>
// (clients write plain paragraphs, not double-newline Markdown). Raw HTML in
// the source is left for DOMPurify to strip rather than trusting marked.
const md = new Marked({ gfm: true, breaks: true })

/** Render client-authored Markdown to sanitized HTML for the case description. */
export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(md.parse(source, { async: false }), { USE_PROFILES: { html: true } })
}
