import DOMPurify from 'dompurify'

/**
 * The single sanitize path for server-provided HTML (email bodies on the
 * case timeline). Beyond the DOMPurify html profile, links are forced to
 * open in a new tab with rel=noopener — a click inside an email must never
 * navigate the signed-in SPA away or hand the target page a window handle.
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
