import { formatDistanceToNowStrict } from 'date-fns'

/**
 * A missing or unparseable timestamp must never take the page down — an
 * Invalid Date reaching Intl.format throws RangeError, which blanks the whole
 * React tree (hit in prod on 2026-07-02 via API field-name drift). Formatters
 * render an em-dash instead of throwing.
 */
function safeDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "3 hours ago" / "2 days ago" — used for last-activity columns and timeline stamps. */
export function relativeTime(iso: string | null | undefined): string {
  const d = safeDate(iso)
  return d ? formatDistanceToNowStrict(d, { addSuffix: true }) : '—'
}

/** "May 12, 2026" */
export function formatDate(iso: string | null | undefined): string {
  const d = safeDate(iso)
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(d)
}

/** "May 12, 2026, 3:41 PM" — timeline entry stamps. */
export function formatDateTime(iso: string | null | undefined): string {
  const d = safeDate(iso)
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

/** 18204 → "17.8 KB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}
